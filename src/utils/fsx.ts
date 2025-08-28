import { promises as fs } from "fs";
import path from "path";

export async function ensureDir(p: string) {
  const dir = path.resolve(p);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function readJson<T>(p: string): Promise<T> {
  const txt = await fs.readFile(p, "utf-8");
  return JSON.parse(txt) as T;
}

export async function writeJson(p: string, data: unknown) {
  const txt = JSON.stringify(data, null, 2);
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, txt, "utf-8");
}

export async function readText(p: string) {
  return await fs.readFile(p, "utf-8");
}

export async function writeText(p: string, s: string) {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, s, "utf-8");
}