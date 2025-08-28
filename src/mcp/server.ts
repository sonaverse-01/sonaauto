// src/mcp/server.ts
// MCP SDK 버전 차이를 흡수하는 안전한 초기화 코드
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
// Stdio 전송층은 index가 아닌 /stdio.js에서 가져와야 합니다.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Platform } from '../types.js';
import { runWorkflow } from '../w4/orchestrator.js';
import { CONFIG } from '../config.js';

type JsonSchema = Record<string, unknown>;

const PLATFORM_ENUM: Platform[] = [
  'naver_blog',
  'tistory',
  'cafe24_blog',
  'sonaverse_blog',
  'threads',
];

const server = new Server(
  { name: 'w4-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// SDK 버전에 따라 tool 등록 API가 다를 수 있어 래퍼로 통일
function registerTool(
  name: string,
  inputSchema: JsonSchema,
  handler: (req: any) => Promise<{ content: Array<{ type: 'text'; text: string }> }>,
) {
  const s: any = server;

  // 1) 신형: addTool({ name, description, inputSchema, handler })
  if (typeof s.addTool === 'function') {
    return s.addTool({
      name,
      description: name,
      inputSchema,
      handler,
    });
  }

  // 2) 구형: tool(name, { inputSchema }, handler)
  if (typeof s.tool === 'function') {
    return s.tool(name, { inputSchema }, handler);
  }

  // 3) 다른 구버전: registerTool(...)
  if (typeof s.registerTool === 'function') {
    return s.registerTool({ name, description: name, inputSchema }, handler);
  }

  throw new Error('Unsupported MCP SDK: no known tool registration method');
}

// ---- tool: w4.list-platforms
registerTool(
  'w4.list-platforms',
  { type: 'object', properties: {} } as JsonSchema,
  async () => {
    return { content: [{ type: 'text', text: JSON.stringify(PLATFORM_ENUM) }] };
  },
);

// ---- tool: w4.run
registerTool(
  'w4.run',
  {
    type: 'object',
    properties: {
      platforms: {
        type: 'array',
        items: { type: 'string', enum: PLATFORM_ENUM as unknown as string[] },
      },
      dryRun: { type: 'boolean' },
      limit: { type: 'integer', minimum: 1 },
    },
    required: ['platforms'],
    additionalProperties: false,
  } as JsonSchema,
  async (req: any) => {
    const args = (req && req.arguments) || {};
    const platforms = Array.isArray(args.platforms) ? (args.platforms as Platform[]) : [];
    const dryRun = !!args.dryRun;
    const limit =
      typeof args.limit === 'number' && Number.isFinite(args.limit) && args.limit > 0
        ? (args.limit as number)
        : undefined;

    const result = await runWorkflow(CONFIG, platforms, { dryRun, limit });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  },
);

// stdio 연결 (listen 대신 connect 사용)
const transport = new StdioServerTransport();
(server as any).connect
  ? (server as any).connect(transport)
  : // 혹시 다른 네이밍을 쓰는 구버전 대비
    (server as any).listen?.(transport);
