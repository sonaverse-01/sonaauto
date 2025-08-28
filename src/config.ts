// src/config.ts
import type { Config } from './types.js';

export const CONFIG: Config = {
  // 시트 JSON (Array<SheetRow>) 파일 경로
  sheetPath: './data/posts.json',
  // 이미지 루트 (시트의 rel_path가 이 아래에 실제 존재)
  imageRoot: '/data',
  // 필요시 출력 루트
  outputRoot: './out',
};
