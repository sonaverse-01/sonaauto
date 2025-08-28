// src/types.ts
export type Platform =
  | 'naver_blog'
  | 'tistory'
  | 'cafe24_blog'
  | 'sonaverse_blog'
  | 'threads';

export interface AltCaptionItem {
  idx: number;
  alt: string;
  caption: string;
  filename: string;
  rel_path: string;
  local_path?: string;
  prompt_json_en?: unknown;
}

export interface SheetRow {
  // 한글/특수문자 키는 반드시 문자열 리터럴로 선언
  "콘텐츠ID"?: string;
  "플랫폼"?: Platform | string;
  "제목"?: string;
  "SEO점수"?: number | string;
  "사용키워드"?: string;
  "원본키워드"?: string;
  "태그"?: string;
  "생성일시"?: string;
  "상태"?: string;
  "갱신일시"?: string;
  "시도횟수"?: number | string;
  "내용(원문)"?: string;
  "본문HTML"?: string;
  "발행상태(표시)"?: string;

  // JSON 문자열 필드
  "이미지파일(JSON)"?: string;   // stringified string[] (rel paths)
  "ALT/캡션(JSON)"?: string;      // stringified AltCaptionItem[]
  "기타메타(JSON)"?: string;      // stringified object
  "이미지메타(JSON)"?: string;    // stringified object

  // 예비 영문 키 (혹시 섞여 들어오는 경우 수용)
  contentId?: string;
  platform?: Platform | string;
  title?: string;
  html?: string;
  text?: string;

  [key: string]: unknown;
}

// 과거 코드 호환용 별칭
export type ContentRow = SheetRow;

export interface Config {
  /** 시트 원본 JSON 경로 (Array<SheetRow>) */
  sheetPath: string;
  /** 이미지 루트 디렉토리 (rel_path를 이어 붙임) */
  imageRoot: string;
  /** (선택) 산출물 저장 루트 */
  outputRoot?: string;
}

export interface RenderResult {
  html: string;
  imagesUsed: string[];
}

export interface RunOptions {
  dryRun?: boolean;
  limit?: number;
}
