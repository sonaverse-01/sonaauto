// src/w4/orchestrator.ts
import path from 'node:path';
import chalk from 'chalk';

import type { Config, Platform, SheetRow, RunOptions } from '../types.js';
import { normalizePlatform, parseImageFiles } from '../utils/parse.js';
import { renderRowToHtml } from './render.js';
import { getUploaders, type UploadResult } from '../uploaders/base.js';

/** 시트에 되돌려쓸 플랫폼별 결과 맵 */
type PerPlatformResult = Record<
  string,
  { ok: boolean; url?: string; error?: string; log?: string }
>;

/** ──────────────────────────────────────────────────────────────────────────
 *  시트 쓰기(업로드 결과 반영): GAS doPost(update) 호출
 *  cfg.sheets.webAppUrl / cfg.sheets.token 을 사용 (Config 타입 기준)
 *  ────────────────────────────────────────────────────────────────────────── */
async function writeBackToSheet(
  cfg: Config,
  contentId: string,
  results: PerPlatformResult,
  status: 'done' | 'error',
  attemptsDelta = 1,
) {
  const body = {
    token: cfg.sheetsToken,
    contentId,
    results,       // { [platform]: { ok, url, error, log } }
    status,        // 'done' | 'error'
    attemptsDelta, // 시도횟수 +1
  };

  const r = await fetch(cfg.sheetsWebAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error(`write-back failed: ${r.status} ${JSON.stringify(json)}`);
  }
  return json;
}

/** 원시 데이터를 평탄화된 SheetRow 배열로 변환 */
function flattenSheetData(rawGroups: any[]): SheetRow[] {
  const flatRows: SheetRow[] = [];
  
  for (const group of rawGroups) {
    if (group.rows && Array.isArray(group.rows)) {
      for (const row of group.rows) {
        if (row.blog) {
          // blog 데이터를 최상위로 끌어올림
          flatRows.push({
            ...row.blog,
            콘텐츠ID: group.콘텐츠ID || row.blog.콘텐츠ID,
            플랫폼: row.플랫폼 || row.blog.플랫폼
          });
        }
      }
    }
  }
  
  return flatRows;
}

/** ──────────────────────────────────────────────────────────────────────────
 *  시트 읽기(GAS doGet(rows))
 *  ────────────────────────────────────────────────────────────────────────── */
async function loadRows(cfg: Config): Promise<SheetRow[]> {
  if (!cfg.sheetsWebAppUrl) {
    throw new Error('cfg.sheetsWebAppUrl is not set (SHEETS_WEB_APP_URL)');
  }
  if (!cfg.sheetsToken) {
    throw new Error('cfg.sheetsToken is not set (SHEETS_TOKEN)');
  }

  const url = new URL(cfg.sheetsWebAppUrl);
  url.searchParams.set('mode', 'rows');
  url.searchParams.set('token', cfg.sheetsToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet rows: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (!json?.ok || !Array.isArray(json.list)) {
    throw new Error(`Sheet API bad response: ${JSON.stringify(json)}`);
  }
  
  return flattenSheetData(json.list);
}

/** 콘텐츠ID → SheetRow[] 그룹핑 헬퍼 */
function groupByContentId(flatRows: any[]): Map<string, any[]> {
  const m = new Map<string, any[]>();
  for (const row of flatRows) {
    // loadRows()는 이제 완전히 평탄화된 SheetRow 배열을 반환
    const cid = String(row?.['콘텐츠ID'] ?? '');
    if (!cid) continue;
    const arr = m.get(cid) ?? [];
    arr.push(row);
    m.set(cid, arr);
  }
  return m;
}

/** 한 행에서 플랫폼 문자열을 정규화해서 얻기 */
function platformFromRow(row: any): Platform | '' {
  const raw = String(row?.['플랫폼'] ?? row?.platform ?? '').trim();
  return normalizePlatform(raw);
}

/** 상태 필터: contentIds가 지정되지 않았을 때만 'pending/빈값' 필터 적용 */
function passStatus(row: any, hasExplicitIds: boolean): boolean {
  console.log(`passStatus 호출: hasExplicitIds=${hasExplicitIds}, 상태="${row?.['상태'] ?? ''}"`);
  if (hasExplicitIds) {
    console.log('명시적 ID 있음 -> true 반환');
    return true;
  }
  const s = String(row?.['상태'] ?? '').toLowerCase().trim();
  const result = s === '' || s === 'pending';
  console.log(`상태 체크 결과: "${s}" -> ${result}`);
  return result;
}

/** 메인: 선택 플랫폼/옵션 기준으로 실행 */
export async function runWorkflow(
  cfg: Config,
  selected: Platform[],
  opts: RunOptions = {},
) {
  if (!selected?.length) throw new Error('no platforms selected');

  // 1) 시트 데이터 로드(or 인젝션) - 항상 평탄화 적용
  let sheetGroups: SheetRow[];
  if (opts.sheetData) {
    console.log('opts.sheetData 제공됨 - 평탄화 적용');
    sheetGroups = flattenSheetData(opts.sheetData);
  } else {
    console.log('시트에서 데이터 로드');
    sheetGroups = await loadRows(cfg);
  }
  
  const groupsMap = groupByContentId(sheetGroups);

  // 2) 대상 콘텐츠ID 선별 (우측 UI에서 체크했으면 그 ID만)
  const wantedIds = Array.isArray(opts.contentIds) && opts.contentIds.length
    ? new Set(opts.contentIds.map(String))
    : null;

  // 3) 업로더 준비
  const uploaders = await getUploaders(selected, cfg.storageStates, cfg.platformSettings);
  const byPlatform = new Map<Platform, Awaited<ReturnType<typeof getUploaders>>[number]>();
  for (const u of uploaders) byPlatform.set(u.platform, u);

  const perContentReports: Array<{
    contentId: string;
    platformResults: PerPlatformResult;
    status: 'done'|'error';
    writeBack?: unknown;
  }> = [];

  const flatResults: UploadResult[] = [];

  // 4) 그룹 단위 실행
  for (const [contentId, rows] of groupsMap) {
    if (wantedIds && !wantedIds.has(contentId)) continue;

    // 디버깅: 그룹 정보
    console.log(`=== 콘텐츠ID ${contentId} 처리 ===`);
    console.log(`총 rows 개수: ${rows.length}`);
    console.log(`각 row 키들:`, rows.map(r => Object.keys(r)));

    // 이 콘텐츠ID에서 돌릴 플랫폼별 결과 맵
    const platformResults: PerPlatformResult = {};

    // limit 처리: opts.limit 는 "선택된 전체 작업 개수 제한"으로 해석
    if (typeof opts.limit === 'number' && flatResults.length >= opts.limit) break;

    // 행들 중에서, 상태/플랫폼 필터 통과하는 것만 실행
    const candidates = rows.filter((row) => {
      console.log(`Row 필터링 중... 상태: "${row?.['상태'] ?? ''}", 플랫폼: "${row?.['플랫폼'] ?? ''}"`);
      
      if (!passStatus(row, !!wantedIds)) {
        console.log('상태 필터 실패');
        return false;
      }

      const p = platformFromRow(row) || selected[0]; // 플랫폼 비어있으면 첫 선택 플랫폼으로 보정
      console.log(`플랫폼 정규화 결과: "${p}"`);
      if (!p) {
        console.log('플랫폼 없음');
        return false;
      }
      const included = selected.includes(p);
      console.log(`선택된 플랫폼에 포함: ${included}`);
      return included;
    });

    console.log(`필터링 후 candidates 개수: ${candidates.length}`);
    if (candidates.length > 0) {
      console.log('첫 번째 candidate 키들:', Object.keys(candidates[0]));
      console.log('첫 번째 candidate 제목:', candidates[0]?.['제목']?.substring(0, 50));
    }

    if (!candidates.length) {
      // 실행할 행이 없으면 스킵 (그래도 report 는 남긴다)
      perContentReports.push({ contentId, platformResults, status: 'done' });
      continue;
    }

    // 각 행(=플랫폼 1건) 처리
    for (const row of candidates) {
      const platform = platformFromRow(row) || selected[0];

      // limit: 개수 제한이 있는 경우, 이미 채우면 더 안 돈다
      if (typeof opts.limit === 'number' && flatResults.length >= opts.limit) break;

      // HTML 렌더 (디버깅 로그 추가)
      console.log('=== 디버깅: row 객체 분석 ===');
      console.log('row 키들:', Object.keys(row));
      console.log('콘텐츠ID:', row['콘텐츠ID']);
      console.log('제목:', row['제목']?.substring(0, 50) || 'EMPTY');
      console.log('본문HTML 길이:', row['본문HTML']?.length || 0);
      console.log('본문HTML 첫 200자:', row['본문HTML']?.substring(0, 200) || 'EMPTY');
      console.log('본문HTML에서 [이미지# 검색:', row['본문HTML']?.includes('[이미지#'));
      console.log('이미지파일(JSON):', row['이미지파일(JSON)']?.substring(0, 100) || 'EMPTY');
      console.log('==========================');
      
      const { html /*, imagesUsed*/ } = renderRowToHtml(row, cfg);

      if (opts.dryRun) {
        const ok: UploadResult = {
          ok: true,
          platform,
          url: `dry-run://${contentId}/${platform}`,
          id: contentId,
        };
        flatResults.push(ok);
        platformResults[platform] = { ok: true, url: ok.url, log: 'dry-run' };
        continue;
      }

      // 실제 업로더
      const uploader = byPlatform.get(platform);
      if (!uploader) {
        const fail: UploadResult = {
          ok: false,
          platform,
          id: contentId,
          error: 'no-uploader',
        };
        flatResults.push(fail);
        platformResults[platform] = { ok: false, error: 'no-uploader' };
        continue;
      }

      const rels = parseImageFiles(row);                 // 시트의 이미지 상대경로들
      const absPaths = rels.map((r) => path.join(cfg.imageRoot, r));

      try {
        const res = await uploader.upload({ row, html, imagePaths: absPaths });
        flatResults.push({ ...res, id: contentId });

        const tag = res.ok ? chalk.green('OK') : chalk.red('FAIL');
        console.log(`${tag} ${platform} ${contentId} ${res.url ?? ''} ${res.error ?? ''}`);

        platformResults[platform] = res.ok
          ? { ok: true, url: res.url }
          : { ok: false, error: res.error ?? 'unknown' };
      } catch (e: any) {
        console.error('upload error:', e);
        flatResults.push({ ok: false, platform, id: contentId, error: String(e?.message || e) });
        platformResults[platform] = { ok: false, error: String(e?.message || e) };
      }
    }

    // 이 콘텐츠ID 묶음 완료 → 시트에 결과 반영
    const anyFail = Object.values(platformResults).some((r) => !r?.ok);
    const status: 'done' | 'error' = anyFail ? 'error' : 'done';

    try {
      const wb = await writeBackToSheet(cfg, contentId, platformResults, status, 1);
      perContentReports.push({ contentId, platformResults, status, writeBack: wb });
    } catch (e: any) {
      console.error('write-back error:', e);
      perContentReports.push({ contentId, platformResults, status, writeBack: { ok: false, error: String(e?.message || e) } });
    }
  }

  // 리턴 형식: UI는 그냥 덤프해서 보여주므로 가독성 좋게 반환
  return {
    ok: true,
    dryRun: !!opts.dryRun,
    limited: typeof opts.limit === 'number' ? opts.limit : null,
    selectedPlatforms: selected,
    totalTried: flatResults.length,
    perContent: perContentReports,
    resultsFlat: flatResults, // 예전 호환용
  };
}
