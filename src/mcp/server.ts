// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { Platform } from '../types.js';
import { runWorkflow } from '../w4/orchestrator.js';
import { loadConfig } from '../utils/config-loader.js';
import 'dotenv/config';

// config.yaml 파일 로드 (환경변수 치환 포함)
const CONFIG = loadConfig('./config.yaml');

const PLATFORM_ENUM: Platform[] = [
  'naver_blog',
  'tistory',
  'cafe24_blog',
  'sonaverse_blog',
  'threads',
];

const mcpServer = new McpServer({
  name: 'w4-mcp',
  version: '0.1.0',
});

// w4.list-platforms tool
mcpServer.registerTool('w4.list-platforms', {
  description: 'List available platforms',
  inputSchema: {},
}, async () => {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(PLATFORM_ENUM),
      },
    ],
  };
});

// w4.run tool  
mcpServer.registerTool('w4.run', {
  description: 'Run workflow for specified platforms',
  inputSchema: {
    platforms: z.array(z.enum(['naver_blog', 'tistory', 'cafe24_blog', 'sonaverse_blog', 'threads'])).describe('List of platforms to run'),
    dryRun: z.boolean().optional().describe('Run in dry-run mode'),
    limit: z.number().int().min(1).optional().describe('Limit number of items to process'),
  },
}, async ({ platforms, dryRun, limit }) => {
  console.log('MCP에서 runWorkflow 호출 시 전달하는 CONFIG:');
  console.log('- CONFIG.platformSettings:', JSON.stringify(CONFIG.platformSettings, null, 2));
  console.log('- CONFIG.storageStates:', CONFIG.storageStates);
  
  const result = await runWorkflow(CONFIG, platforms as Platform[], { dryRun, limit });
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result),
      },
    ],
  };
});

// stdio 연결
async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.log('W4-MCP server is running...');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
