// src/utils/parse.ts
import type { AltCaptionItem, Platform, SheetRow } from '../types.js';

export function coerceString(v: unknown): string | undefined {
  if (v == null) return undefined;
  return String(v);
}

export function safeParseJson<T>(s: unknown, fallback: T): T {
  if (typeof s !== 'string') return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function parseImageFiles(row: SheetRow): string[] {
  const raw = row["이미지파일(JSON)"];
  return safeParseJson<string[]>(raw, []);
}

export function parseAltCaptions(row: SheetRow): AltCaptionItem[] {
  const raw = row["ALT/캡션(JSON)"];
  return safeParseJson<AltCaptionItem[]>(raw, []);
}

export function pickHtml(row: SheetRow): string {
  return (
    coerceString(row["본문HTML"]) ??
    coerceString(row["내용(원문)"]) ??
    coerceString(row.html) ??
    coerceString(row.text) ??
    ''
  );
}

export function normalizePlatform(p?: string): Platform | undefined {
  if (!p) return undefined;
  const v = p as Platform;
  const set = new Set<Platform>([
    'naver_blog', 'tistory', 'cafe24_blog', 'sonaverse_blog', 'threads',
  ]);
  return set.has(v) ? v : undefined;
}
