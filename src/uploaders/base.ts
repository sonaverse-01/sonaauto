// src/uploaders/base.ts
import type { Platform, SheetRow } from '../types.js';

export interface UploadInput {
  row: SheetRow;
  html: string;
  imagePaths: string[];
}

export interface UploadResult {
  ok: boolean;
  platform: Platform;
  url?: string;
  id?: string;
  error?: string;
}

export abstract class Uploader {
  abstract platform: Platform;
  async login(): Promise<void> { /* no-op default */ }
  abstract upload(input: UploadInput): Promise<UploadResult>;
}

/**
 * 임시 더미 업로더 (MCP 브라우저 자동화 자리채움)
 * 실제 업로드 로직은 각 플랫폼별 MCP tool에서 Playwright로 구현 예정.
 */
class DummyUploader extends Uploader {
  constructor(public platform: Platform) { super(); }
  async upload(input: UploadInput): Promise<UploadResult> {
    // 여기는 실제로는 MCP tool invoke를 해야 함.
    // 지금은 컴파일/연결 확인용 더미 반환.
    return {
      ok: true,
      platform: this.platform,
      url: `about:blank#${this.platform}`,
      id: input.row["콘텐츠ID"] ?? 'unknown',
    };
  }
}

export function getUploaders(selected: Platform[]): Uploader[] {
  return selected.map((p) => new DummyUploader(p));
}
