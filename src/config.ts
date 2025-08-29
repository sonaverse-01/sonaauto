// src/config.ts
import { config } from 'dotenv';
import type { Config } from './types.js';

// .env 파일 로드
config();

export const CONFIG: Config = {
  // 구글 시트 직접 접근을 위한 설정
  sheetsWebAppUrl: process.env.SHEETS_WEB_APP_URL || '',
  sheetsToken: process.env.SHEETS_TOKEN || '',
  // 이미지 루트 (시트의 rel_path가 이 아래에 실제 존재)
  imageRoot: process.env.W4_IMAGE_ROOT || '/data',
  // 필요시 출력 루트
  outputRoot: './out',
};
