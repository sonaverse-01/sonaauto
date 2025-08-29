// src/utils/config-loader.ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { config as loadEnv } from 'dotenv';
import type { Config } from '../types.js';

// .env 파일 로드
loadEnv();

/**
 * 환경변수 치환을 수행하는 함수
 */
function substituteEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    // ${VARIABLE_NAME} 패턴을 찾아서 환경변수로 치환
    return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }
  
  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVars);
  }
  
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVars(value);
    }
    return result;
  }
  
  return obj;
}

/**
 * YAML 설정 파일을 로드하고 환경변수 치환을 수행
 */
export function loadConfig(configPath: string): Config {
  try {
    const yamlContent = readFileSync(configPath, 'utf-8');
    const parsed = parse(yamlContent);
    const substituted = substituteEnvVars(parsed);
    
    // 기본값 설정
    const config: Config = {
      sheetsWebAppUrl: substituted.sheetsWebAppUrl || process.env.SHEETS_WEB_APP_URL || '',
      sheetsToken: substituted.sheetsToken || process.env.SHEETS_TOKEN || '',
      imageRoot: substituted.imageRoot || process.env.W4_IMAGE_ROOT || '/data',
      outputRoot: substituted.outputRoot || './out',
      outputDir: substituted.outputDir || './out',
      storageStates: substituted.storageStates,
      platforms: substituted.platforms,
      headless: substituted.headless !== undefined ? substituted.headless : true,
      waitAfterPublishMs: substituted.waitAfterPublishMs || 2000,
      platformSettings: substituted.platformSettings,
    };
    
    console.log('Config loaded with platform settings:', JSON.stringify(config.platformSettings, null, 2));
    
    return config;
  } catch (error) {
    console.error('Failed to load config:', error);
    throw error;
  }
}