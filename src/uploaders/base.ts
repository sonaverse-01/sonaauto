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

export async function getUploaders(
  selected: Platform[], 
  storageStates?: Record<string, string>,
  platformSettings?: any
): Promise<Uploader[]> {
  const uploaders: Uploader[] = [];
  
  for (const p of selected) {
    switch (p) {
      case 'naver_blog':
        const { NaverBlogUploader } = await import('./naver_blog.js');
        const storageStatePath = storageStates?.naver_blog;
        const blogId = platformSettings?.naver_blog?.blogId;
        const username = platformSettings?.naver_blog?.username;
        const password = platformSettings?.naver_blog?.password;
        
        console.log('getUploaders에서 naver_blog 생성 시 전달하는 값들:');
        console.log('- platformSettings:', JSON.stringify(platformSettings, null, 2));
        console.log('- storageStatePath:', storageStatePath);
        console.log('- blogId:', blogId);
        console.log('- username:', username);
        console.log('- password:', password ? '***' : 'undefined');
        
        uploaders.push(new NaverBlogUploader(storageStatePath, blogId, username, password));
        break;
      default:
        // 다른 플랫폼은 아직 더미로 유지
        uploaders.push(new DummyUploader(p));
        break;
    }
  }
  
  return uploaders;
}
