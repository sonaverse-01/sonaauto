// src/w4/orchestrator.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import type { Config, Platform, SheetRow, RunOptions } from '../types.js';
import { normalizePlatform, parseImageFiles, pickHtml } from '../utils/parse.js';
import { renderRowToHtml } from './render.js';
import { getUploaders, type UploadResult } from '../uploaders/base.js';

async function loadRows(sheetPath: string): Promise<SheetRow[]> {
  const raw = await fs.readFile(sheetPath, 'utf8');
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data as SheetRow[];
    throw new Error('sheet JSON is not an array');
  } catch (e) {
    throw new Error(`Failed to parse sheet JSON (${sheetPath}): ${(e as Error).message}`);
  }
}

export async function runWorkflow(
  cfg: Config,
  selected: Platform[],
  opts: RunOptions = {},
) {
  const rows = await loadRows(cfg.sheetPath);

  const targets = rows.filter((r) => {
    const p = normalizePlatform(String(r["플랫폼"] ?? r.platform ?? ''));
    if (!p) return false;
    if (!selected.includes(p)) return false;
    const status = String(r["상태"] ?? '').toLowerCase();
    // 상태가 비어있거나 pending인 것만 업로드 대상으로 본다
    return status === '' || status === 'pending';
  });

  const limited = typeof opts.limit === 'number' ? targets.slice(0, opts.limit) : targets;

  const uploaders = getUploaders(selected);
  const byPlatform = new Map<Platform, ReturnType<typeof getUploaders>[number]>();
  for (const u of uploaders) byPlatform.set(u.platform, u);

  const results: UploadResult[] = [];

  for (const row of limited) {
    const platform = normalizePlatform(String(row["플랫폼"] ?? row.platform ?? ''));
    if (!platform) continue;

    const { html, imagesUsed } = renderRowToHtml(row, cfg);

    if (opts.dryRun) {
      console.log(chalk.cyan(`[dry-run] ${platform} ${row["콘텐츠ID"] ?? ''}`));
      results.push({ ok: true, platform, url: 'dry-run://', id: row["콘텐츠ID"] });
      continue;
    }

    const uploader = byPlatform.get(platform);
    if (!uploader) {
      results.push({ ok: false, platform, error: 'no-uploader' });
      continue;
    }

    const rels = parseImageFiles(row);
    const abs = rels.map((r) => path.join(cfg.imageRoot, r));

    const res = await uploader.upload({ row, html, imagePaths: abs });
    results.push(res);

    const tag = res.ok ? chalk.green('OK') : chalk.red('FAIL');
    console.log(`${tag} ${platform} ${row["콘텐츠ID"] ?? ''} ${res.url ?? ''} ${res.error ?? ''}`);
  }

  return results;
}
