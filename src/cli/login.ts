import { chromium } from "playwright";
import { Command } from "commander";
import fs from "fs/promises";

const program = new Command();
program
  .requiredOption("--platform <name>")
  .requiredOption("--state <path>", "storageState json path")
  .parse(process.argv);

const { platform, state } = program.opts();

const urls: Record<string,string> = {
  naver_blog: "https://nid.naver.com/nidlogin.login",
  tistory: "https://www.tistory.com/auth/login",
  cafe24_blog: "https://eclogin.cafe24.com/Shop/",
  sonaverse_blog: "https://example.local/login",
  threads: "https://www.threads.net/login"
};

(async () => {
  const url = urls[platform] || "about:blank";
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url);
  console.log(`[login] 로그인 후 탭을 닫지 말고 콘솔에 '완료' 표시가 뜰 때까지 기다리세요.`);
  // 사용자가 수동 로그인할 시간 대기
  await page.waitForTimeout(120_000);
  await ctx.storageState({ path: state });
  await browser.close();
  console.log(`[login] 저장됨: ${state}`);
})();