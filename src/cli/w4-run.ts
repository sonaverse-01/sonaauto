// src/cli/w4-run.ts
import { runWorkflow } from '../w4/orchestrator.js';
import { loadConfig } from '../utils/config-loader.js';
import type { Platform } from '../types.js';

// config.yaml 파일 로드 (환경변수 치환 포함)
const CONFIG = loadConfig('./config.yaml');

function parseArgv() {
  const args = process.argv.slice(2);
  let dryRun = true;
  let limit: number | undefined = undefined;
  let platforms: Platform[] = [];
  let contentIds: string[] = [];

  for (const a of args) {
    if (a === '--no-dry-run' || a === '--prod') dryRun = false;
    else if (a.startsWith('--limit=')) {
      const n = Number(a.split('=')[1]);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (a.startsWith('--platforms=')) {
      platforms = a
        .split('=')[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as Platform[];
    } else if (a.startsWith('--ids=')) {
      contentIds = a
        .split('=')[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      // 쉼표로 구분해서 바로 플랫폼 나열도 허용
      const maybe = a.split(',').map((s) => s.trim()).filter(Boolean) as Platform[];
      if (maybe.length) platforms = maybe;
    }
  }

  if (!platforms.length) {
    console.error(
      '사용법: node dist/cli/w4-run.js --platforms=naver_blog,tistory [--limit=3] [--ids=ID1,ID2] [--no-dry-run]',
    );
    process.exit(1);
  }

  return { platforms, limit, dryRun, contentIds };
}

async function main() {
  const { platforms, limit, dryRun, contentIds } = parseArgv();
  const res = await runWorkflow(CONFIG, platforms, { limit, dryRun, contentIds });
  console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
