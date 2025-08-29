// src/server/index.ts
import http from 'node:http';
import { runWorkflow } from '../w4/orchestrator.js';
import { loadConfig } from '../utils/config-loader.js';
import type { Platform } from '../types.js';
import 'dotenv/config';

// config.yaml 파일 로드 (환경변수 치환 포함)
const CONFIG = loadConfig('./config.yaml');

const PORT = Number(process.env.PORT || 8787);

const HTML = String.raw`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>W4 포스팅 콘솔</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  
  * { box-sizing: border-box; }
  
  body { 
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
    margin: 0; 
    padding: 0;
    line-height: 1.6; 
    background: #ffffff;
    min-height: 100vh;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
  }
  
  .header {
    background: #f8fafc;
    color: #2d3748;
    padding: 40px 0;
    margin: -24px -24px 32px -24px;
    text-align: center;
    position: relative;
    overflow: hidden;
    border-bottom: 3px solid #4a5568;
  }
  
  .header h1 { 
    margin: 0; 
    font-size: 2.5rem; 
    font-weight: 700;
    position: relative;
    z-index: 1;
  }
  
  .header p { 
    margin: 12px 0 0 0; 
    opacity: 0.9; 
    font-size: 1.1rem;
    position: relative;
    z-index: 1;
  }
  
  .main-grid {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 32px;
    align-items: start;
  }
  
  @media (max-width: 768px) {
    .main-grid {
      grid-template-columns: 1fr;
    }
  }
  
  .card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    padding: 24px;
    margin-bottom: 24px;
    border: 1px solid #e2e8f0;
  }
  
  .card h2 {
    margin-top: 0;
    margin-bottom: 20px;
    color: #2d3748;
    font-size: 1.4rem;
    font-weight: 600;
  }
  
  .platforms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }
  
  .platform-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    transition: all 0.2s ease;
    cursor: pointer;
    background: #fafafa;
  }
  
  .platform-item:hover {
    border-color: #667eea;
    background: #f0f4ff;
  }
  
  .platform-item input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #667eea;
  }
  
  .platform-item label {
    flex: 1;
    cursor: pointer;
    font-weight: 500;
    color: #4a5568;
  }
  
  .options-row {
    display: flex;
    gap: 24px;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .option-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f7fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
  
  .option-item input[type="checkbox"] {
    accent-color: #667eea;
  }
  
  .option-item input[type="number"] {
    width: 80px;
    padding: 6px 10px;
    border: 1px solid #cbd5e0;
    border-radius: 6px;
    font-size: 14px;
  }
  
  .btn-group {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }
  
  button { 
    padding: 12px 24px; 
    border-radius: 10px; 
    border: 0; 
    cursor: pointer; 
    font-weight: 600;
    font-size: 14px;
    transition: all 0.2s ease;
    min-width: 120px;
  }
  
  button.primary { 
    background: #4a5568; 
    color: #fff; 
    box-shadow: 0 4px 12px rgba(74, 85, 104, 0.3);
  }
  
  button.primary:hover {
    background: #2d3748;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(74, 85, 104, 0.4);
  }
  
  button.secondary {
    background: #f7fafc;
    color: #4a5568;
    border: 1px solid #e2e8f0;
  }
  
  button.secondary:hover {
    background: #edf2f7;
  }
  
  button:disabled { 
    opacity: .6; 
    cursor: not-allowed; 
    transform: none !important;
  }
  
  .results-section {
    margin-top: 32px;
  }
  
  pre { 
    background: #2d3748; 
    color: #e2e8f0;
    padding: 20px; 
    border-radius: 12px; 
    overflow: auto; 
    font-family: 'Fira Code', Consolas, monospace;
    font-size: 13px;
    line-height: 1.4;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.1);
  }
  
  .status {
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-weight: 500;
  }
  
  .status.success {
    background: #f0fff4;
    color: #22543d;
    border: 1px solid #9ae6b4;
  }
  
  .status.error {
    background: #fed7d7;
    color: #742a2a;
    border: 1px solid #feb2b2;
  }
  
  .status.running {
    background: #ebf8ff;
    color: #2a69ac;
    border: 1px solid #90cdf4;
  }
  
  .ok { color: #22543d; }
  .err { color: #742a2a; }
  
  .content-list {
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    border: 1px solid #e2e8f0;
    overflow: hidden;
  }
  
  .content-list-header {
    background: #4a5568;
    color: white;
    padding: 20px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .content-list-header h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }
  
  .refresh-btn {
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
  }
  
  .refresh-btn:hover {
    background: rgba(255,255,255,0.3);
  }
  
  .content-items {
    height: calc(100vh - 380px);
    min-height: 250px;
    overflow-y: auto;
  }
  
  .content-item {
    padding: 12px 24px;
    border-bottom: 1px solid #f1f5f9;
    font-family: monospace;
    font-size: 14px;
    color: #4a5568;
    transition: background 0.2s ease;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .content-item input[type="checkbox"] {
    accent-color: #4a5568;
  }

  .content-item label {
    cursor: pointer;
    flex: 1;
  }
  
  .content-item:hover {
    background: #f8fafc;
  }
  
  .content-item:last-child {
    border-bottom: none;
  }
  
  .loading {
    text-align: center;
    padding: 24px;
    color: #718096;
  }
  
  .loading::after {
    content: '';
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top: 2px solid #4299e1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-left: 8px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .empty-state {
    text-align: center;
    padding: 40px 24px;
    color: #718096;
  }
  
  .empty-state svg {
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
    opacity: 0.5;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>W4 포스팅 콘솔</h1>
      <p>체크한 플랫폼만 포스팅합니다. 드라이런은 실제 업로드 없이 렌더/검증만 수행합니다.</p>
    </div>

    <div class="main-grid">
      <div class="main-content">
        <form id="form">
          <div class="card">
            <h2>플랫폼 선택</h2>
            <div class="platforms-grid">
              <div class="platform-item">
                <input type="checkbox" id="selectAllPlatforms" />
                <label for="selectAllPlatforms">🌐 모든 플랫폼 선택</label>
              </div>
              <div class="platform-item">
                <input type="checkbox" name="platforms" value="naver_blog" id="naver_blog" />
                <label for="naver_blog">Naver Blog</label>
              </div>
              <div class="platform-item">
                <input type="checkbox" name="platforms" value="tistory" id="tistory" />
                <label for="tistory">Tistory</label>
              </div>
              <div class="platform-item">
                <input type="checkbox" name="platforms" value="cafe24_blog" id="cafe24_blog" />
                <label for="cafe24_blog">Cafe24 Blog</label>
              </div>
              <div class="platform-item">
                <input type="checkbox" name="platforms" value="sonaverse_blog" id="sonaverse_blog" />
                <label for="sonaverse_blog">Sonaverse Blog</label>
              </div>
              <div class="platform-item">
                <input type="checkbox" name="platforms" value="threads" id="threads" />
                <label for="threads">Threads</label>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>실행 옵션</h2>
            <div class="options-row">
              <div class="option-item">
                <input type="checkbox" id="dryRun" checked />
                <label for="dryRun">드라이런</label>
              </div>
              <div class="option-item">
                <label for="limit">개수 제한:</label>
                <input type="number" id="limit" min="1" placeholder="예: 3" />
              </div>
            </div>
            
            <div class="btn-group">
              <button type="submit" class="primary" id="runBtn">포스팅 시작</button>
              <button type="button" class="secondary" id="clearBtn">결과 지우기</button>
            </div>
          </div>
        </form>

        <div class="results-section">
          <div class="card">
            <h2>실행 결과</h2>
            <div id="status"></div>
            <pre id="out"></pre>
          </div>
        </div>
      </div>
      
      <div class="sidebar">
        <div class="content-list">
          <div class="content-list-header">
            <h3>콘텐츠 ID 목록</h3>
            <button class="refresh-btn" id="refreshContentBtn">새로고침</button>
          </div>
          <div style="padding: 12px 24px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <input type="text" id="searchInput" placeholder="콘텐츠 ID로 검색..." style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 14px; margin-bottom: 8px;" />
            <div style="display: flex; gap: 8px; font-size: 12px;">
              <button type="button" id="selectAllContent" style="padding: 4px 8px; background: #e2e8f0; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer;">전체 선택</button>
              <button type="button" id="clearAllContent" style="padding: 4px 8px; background: #e2e8f0; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer;">전체 해제</button>
            </div>
          </div>
          <div class="content-items" id="contentList">
            <div class="loading">로딩 중...</div>
          </div>
        </div>
      </div>
    </div>
  </div>

<script>
  const $ = (s)=>document.querySelector(s);
  const form = $('#form');
  const out = $('#out');
  const status = $('#status');
  const runBtn = $('#runBtn');
  const clearBtn = $('#clearBtn');
  const contentList = $('#contentList');
  const refreshContentBtn = $('#refreshContentBtn');

  let allContentIds = [];

  // 콘텐츠 ID 목록 로드 함수
  async function loadContentList() {
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = '로딩 중';
    contentList.innerHTML = '';
    contentList.appendChild(loading);

    try {
      const res = await fetch('/api/sheets/rows');
      const data = await res.json();
      
      contentList.innerHTML = '';
      
      if (data.ok && data.list && data.list.length > 0) {
        const contentIds = data.list
          .map(row => row['콘텐츠ID'])
          .filter(id => id && id.trim())
          .slice(0, 50); // 최대 50개만 표시
        
        if (contentIds.length > 0) {
          allContentIds = contentIds;
          renderContentList(contentIds);
        } else {
          showEmptyState();
        }
      } else {
        showErrorState(data.error || '데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('콘텐츠 목록 로드 실패:', err);
      showErrorState('네트워크 오류가 발생했습니다.');
    }
  }

  function showEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '콘텐츠가 없습니다';
    contentList.appendChild(empty);
  }

  function showErrorState(message) {
    const error = document.createElement('div');
    error.className = 'empty-state';
    error.style.color = '#e53e3e';
    error.textContent = message;
    contentList.appendChild(error);
  }

  // 이벤트 리스너
  clearBtn.addEventListener('click', () => { 
    out.textContent = ''; 
    status.innerHTML = '';
  });

  refreshContentBtn.addEventListener('click', loadContentList);

  // 콘텐츠 리스트 렌더링 함수
  function renderContentList(contentIds) {
    contentList.innerHTML = '';
    contentIds.forEach(id => {
      const item = document.createElement('div');
      item.className = 'content-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'contentIds';
      checkbox.value = id;
      checkbox.id = 'content_' + id;
      
      const label = document.createElement('label');
      label.textContent = id;
      label.htmlFor = 'content_' + id;
      
      item.appendChild(checkbox);
      item.appendChild(label);
      contentList.appendChild(item);
    });
  }

  // 검색 기능
  function filterContentList() {
    const query = $('#searchInput').value.toLowerCase();
    const filtered = allContentIds.filter(id => 
      id.toLowerCase().includes(query)
    );
    renderContentList(filtered);
  }

  // 검색 입력 이벤트 리스너
  document.addEventListener('input', (e) => {
    if (e.target.id === 'searchInput') {
      filterContentList();
    }
  });

  // 콘텐츠 전체 선택/해제
  document.addEventListener('click', (e) => {
    if (e.target.id === 'selectAllContent') {
      document.querySelectorAll('input[name="contentIds"]').forEach(cb => cb.checked = true);
    } else if (e.target.id === 'clearAllContent') {
      document.querySelectorAll('input[name="contentIds"]').forEach(cb => cb.checked = false);
    }
  });

  // 플랫폼 전체 선택/해제
  document.addEventListener('change', (e) => {
    if (e.target.id === 'selectAllPlatforms') {
      const isChecked = e.target.checked;
      document.querySelectorAll('input[name="platforms"]').forEach(cb => cb.checked = isChecked);
    }
  });

  // 상태 업데이트 함수 개선
  function updateStatus(message, type = 'running') {
    const statusDiv = $('#status');
    statusDiv.className = 'status ' + type;
    statusDiv.innerHTML = message;
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const platforms = Array.from(document.querySelectorAll('input[name="platforms"]:checked')).map(i=>i.value);
    const contentIds = Array.from(document.querySelectorAll('input[name="contentIds"]:checked')).map(i=>i.value);
    const dryRun = document.querySelector('#dryRun').checked;
    const limitStr = document.querySelector('#limit').value.trim();
    const limit = limitStr ? Number(limitStr) : undefined;

    if (!platforms.length) {
      alert('플랫폼을 하나 이상 선택하세요.');
      return;
    }

    if (!contentIds.length) {
      alert('포스팅할 콘텐츠를 하나 이상 선택하세요.');
      return;
    }

    runBtn.disabled = true;
    updateStatus('실행 중... 잠시만요.', 'running');
    out.textContent = '';

    try {
      const res = await fetch('/run', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ platforms, contentIds, dryRun, limit }),
      });
      const txt = await res.text();
      try {
        const json = JSON.parse(txt);
        out.textContent = JSON.stringify(json, null, 2);
        updateStatus(res.ok ? '성공적으로 완료되었습니다.' : '실패 (HTTP ' + res.status + ')', res.ok ? 'success' : 'error');
      } catch {
        out.textContent = txt;
        updateStatus(res.ok ? '성공적으로 완료되었습니다.' : '실패 (HTTP ' + res.status + ')', res.ok ? 'success' : 'error');
      }
    } catch (err) {
      updateStatus('요청 실패: 네트워크 오류가 발생했습니다.', 'error');
      out.textContent = String(err?.stack || err);
    } finally {
      runBtn.disabled = false;
    }
  });

  // 페이지 로드시 콘텐츠 목록 자동 로드
  document.addEventListener('DOMContentLoaded', loadContentList);
  
  // 페이지가 이미 로드된 경우를 위해
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadContentList);
  } else {
    loadContentList();
  }
</script>
</body>
</html>`;

function send(res: http.ServerResponse, code: number, body: string, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}
function sendJSON(res: http.ServerResponse, code: number, data: any) {
  send(res, code, JSON.stringify(data), 'application/json; charset=utf-8');
}
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // UI
    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, HTML, 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/healthz') {
      return send(res, 200, 'ok');
    }

    // 워크플로우 실행
    if (req.method === 'POST' && url.pathname === '/run') {
      const raw = await readBody(req);
      let payload: any = {};
      try { payload = JSON.parse(raw || '{}'); } catch {}
      const platforms = Array.isArray(payload.platforms) ? (payload.platforms as Platform[]) : [];
      const contentIds = Array.isArray(payload.contentIds) ? (payload.contentIds as string[]) : [];
      const dryRun = !!payload.dryRun;
      const limit =
        typeof payload.limit === 'number' && Number.isFinite(payload.limit) && payload.limit > 0
          ? (payload.limit as number)
          : undefined;

      if (!platforms.length) return sendJSON(res, 400, { error: 'platforms required' });
      if (!contentIds.length) return sendJSON(res, 400, { error: 'contentIds required' });

      // 서버에서 시트 데이터를 직접 가져옴
      try {
        const base = process.env.SHEETS_WEB_APP_URL!;
        const token = process.env.SHEETS_TOKEN!;
        if (!base || !token) return sendJSON(res, 500, { ok: false, error: 'missing SHEETS_WEB_APP_URL or SHEETS_TOKEN' });

        const sheetUrl = new URL(base);
        sheetUrl.searchParams.set('mode', 'rows');
        sheetUrl.searchParams.set('token', token);

        const sheetResponse = await fetch(sheetUrl.toString());
        const sheetData = await sheetResponse.json();
        
        if (!sheetData.ok) {
          return sendJSON(res, 500, { ok: false, error: 'Sheet API error: ' + (sheetData.error || 'Unknown error') });
        }

        // 디버깅: 시트 데이터 확인
        console.log('=== 서버에서 받은 시트 데이터 ===');
        console.log('전체 sheetData 구조:');
        console.log(JSON.stringify(sheetData, null, 2));
        console.log(`시트 행 수: ${sheetData.list?.length || 0}`);
        if (sheetData.list?.length > 0) {
          console.log('첫 번째 행 데이터:');
          console.log('콘텐츠ID:', sheetData.list[0]['콘텐츠ID']);
          console.log('플랫폼:', sheetData.list[0]['플랫폼']);
          console.log('상태:', sheetData.list[0]['상태']);
          console.log('전체 필드명들:', Object.keys(sheetData.list[0]));
          console.log('rows 필드 내용:', sheetData.list[0]['rows']);
        }

        const result = await runWorkflow(CONFIG, platforms, { dryRun, limit, contentIds, sheetData: sheetData.list });
        return sendJSON(res, 200, { ok: true, result });
      } catch (e: any) {
        return sendJSON(res, 500, { ok: false, error: String(e?.message || e) });
      }
    }

    // === 시트 프록시 (네이티브 http 버전) ===

    // GET /api/sheets/rows
    if (req.method === 'GET' && url.pathname === '/api/sheets/rows') {
      try {
        const base = process.env.SHEETS_WEB_APP_URL!;
        const token = process.env.SHEETS_TOKEN!;
        if (!base || !token) return sendJSON(res, 500, { ok:false, error:'missing SHEETS_WEB_APP_URL or SHEETS_TOKEN' });

        const u = new URL(base);
        u.searchParams.set('mode', 'rows');
        u.searchParams.set('token', token);

        const r = await fetch(u.toString(), { method: 'GET' });
        const json = await r.json();
        return sendJSON(res, 200, json);
      } catch (e:any) {
        return sendJSON(res, 500, { ok:false, error: String(e?.message||e) });
      }
    }

    // POST /api/sheets/update
    if (req.method === 'POST' && url.pathname === '/api/sheets/update') {
      try {
        const base = process.env.SHEETS_WEB_APP_URL!;
        const token = process.env.SHEETS_TOKEN!;
        if (!base || !token) return sendJSON(res, 500, { ok:false, error:'missing SHEETS_WEB_APP_URL or SHEETS_TOKEN' });

        const raw = await readBody(req);
        const clientBody = raw ? JSON.parse(raw) : {};
        const body = { token, ...clientBody };

        const r = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(body),
        });
        const json = await r.json();
        return sendJSON(res, 200, json);
      } catch (e:any) {
        return sendJSON(res, 500, { ok:false, error: String(e?.message||e) });
      }
    }

    // 404
    send(res, 404, 'not found');
  } catch (err: any) {
    sendJSON(res, 500, { error: String(err?.message || err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`W4 web UI listening on http://localhost:${PORT}`);
});
