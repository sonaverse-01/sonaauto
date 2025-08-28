import { spawn } from "child_process";
import { Command } from "commander";

// 매우 단순한 one-shot: 서버를 띄우고, tool-call 요청 1회 보내고, 응답 받으면 종료
// 실제 MCP 핸드셰이크/세션을 SDK 클라이언트로 처리하는 게 좋지만,
// 여기선 stdin/stdout로 최소 JSON-RPC만 구현

const program = new Command();
program
  .requiredOption("--method <name>", "tool name, e.g. w4.run")
  .requiredOption("--params-file <path>", "JSON file with params")
  .parse(process.argv);

const { method, paramsFile } = program.opts();

const params = JSON.parse(require("fs").readFileSync(paramsFile, "utf-8"));

const srv = spawn(process.execPath, ["dist/mcp/server.js"], {
  stdio: ["pipe", "pipe", "inherit"]
});

const req = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: method,
    arguments: params
  }
};

// 서버의 stdout에서 첫 응답을 받으면 출력 후 종료
let buffered = "";
srv.stdout.on("data", (chunk) => {
  buffered += chunk.toString();
  // 아주 단순 파서: 첫 번째 완전한 JSON 객체만 잡아 출력
  try {
    const obj = JSON.parse(buffered);
    if (obj.id === 1) {
      if (obj.error) {
        console.error(obj.error.message || "MCP error");
        process.exit(2);
      } else {
        const content = obj.result?.content?.[0]?.text ?? "";
        console.log(content);
        process.exit(0);
      }
    }
  } catch {
    // 더 올 때까지 대기
  }
});

// 서버로 요청 전송
srv.stdin.write(JSON.stringify(req) + "\n");