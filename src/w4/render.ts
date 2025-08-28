// src/w4/render.ts
import path from 'node:path';
import type { Config, ContentRow } from '../types.js';
import { parseImageFiles, pickHtml } from '../utils/parse.js';

const IMG_TOKEN_RE = /\[이미지#(\d+)\]/g;

export function fillImagePlaceholders(
  html: string,
  absImagePaths: string[],
): { html: string; imagesUsed: string[] } {
  const used: string[] = [];
  const replaced = html.replace(IMG_TOKEN_RE, (_m, numStr) => {
    const idx = Number(numStr) - 1; // 토큰은 1-based
    const abs = absImagePaths[idx];
    if (!abs) return ''; // 해당 이미지 없으면 제거
    used.push(abs);
    const src = 'file://' + abs.replace(/\\/g, '/');
    return `<figure><img src="${src}" loading="lazy" /></figure>`;
  });
  return { html: replaced, imagesUsed: used };
}

export function renderRowToHtml(row: ContentRow, cfg: Config) {
  const rels = parseImageFiles(row);
  const abs = rels.map((r) => path.join(cfg.imageRoot, r));
  const html = pickHtml(row);
  return fillImagePlaceholders(html, abs);
}
