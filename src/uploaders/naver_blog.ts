// src/uploaders/naver_blog.ts
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Uploader, UploadInput, UploadResult } from './base.js';
import type { Platform } from '../types.js';

class Logger {
  private logFile: string;
  
  constructor() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = `./logs/naver-blog-${timestamp}.log`;
  }
  
  async init() {
    await fs.mkdir('./logs', { recursive: true });
  }
  
  async log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level}: ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    
    console.log(logMessage);
    
    try {
      await fs.appendFile(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('로그 파일 쓰기 실패:', error);
    }
  }
}

export class NaverBlogUploader extends Uploader {
  platform: Platform = 'naver_blog';
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private logger: Logger;

  constructor(
    private storageStatePath?: string, 
    private blogId?: string,
    private username?: string,
    private password?: string
  ) {
    super();
    this.logger = new Logger();
    console.log('NaverBlogUploader 생성자 파라미터:');
    console.log('- storageStatePath:', storageStatePath);
    console.log('- blogId:', blogId);
    console.log('- username:', username ? `${username.slice(0, 3)}***` : 'undefined');
    console.log('- password:', password ? '***' : 'undefined');
  }

  async login(): Promise<void> {
    this.browser = await chromium.launch({ headless: false });
    
    if (this.storageStatePath && await fs.access(this.storageStatePath).then(() => true).catch(() => false)) {
      // 기존 로그인 상태 복원 시도
      this.context = await this.browser.newContext({ storageState: this.storageStatePath });
      this.page = await this.context.newPage();
      
      // 로그인 상태 확인을 위해 네이버 메인으로 이동
      await this.page.goto('https://www.naver.com', { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);
      
      // 로그인 상태 확인 (로그인 버튼이 없으면 로그인된 상태)
      const loginButton = await this.page.$('a[href*="nidlogin.login"]');
      if (loginButton) {
        console.log('저장된 로그인 상태가 만료되었습니다. 자동 로그인을 시도합니다.');
        await this.performAutoLogin();
      } else {
        console.log('기존 로그인 상태가 유효합니다.');
      }
    } else {
      // 새 로그인 필요
      this.context = await this.browser.newContext();
      this.page = await this.context.newPage();
      await this.performAutoLogin();
    }
  }

  private async handlePopups(): Promise<void> {
    // 범용 팝업 처리 함수
    const popupSelectors = [
      '.se-popup-container.__se-pop-layer', // 임시저장 팝업
      '.se-popup-container',
      '.popup-layer',
      '.modal',
      '.dialog'
    ];
    
    for (const popupSelector of popupSelectors) {
      try {
        const popup = await this.page?.$(popupSelector);
        if (popup) {
          console.log(`팝업 발견: ${popupSelector}`);
          
          // 취소 버튼 우선 시도
          const cancelSelectors = [
            'button.se-popup-button-cancel',
            'button[data-role="cancel"]',
            'button:has-text("취소")',
            'button:has-text("Cancel")',
            '.btn-cancel',
            '.cancel-btn'
          ];
          
          let cancelled = false;
          for (const cancelSelector of cancelSelectors) {
            try {
              const cancelBtn = await popup.$(cancelSelector);
              if (cancelBtn) {
                await cancelBtn.click();
                await this.page?.waitForTimeout(500);
                console.log(`팝업 취소: ${cancelSelector}`);
                cancelled = true;
                break;
              }
            } catch (e) {
              continue;
            }
          }
          
          // 취소 버튼이 없으면 닫기 버튼 시도
          if (!cancelled) {
            const closeSelectors = [
              'button[aria-label="닫기"]',
              'button.close',
              '.close-btn',
              'button:has-text("닫기")'
            ];
            
            for (const closeSelector of closeSelectors) {
              try {
                const closeBtn = await popup.$(closeSelector);
                if (closeBtn) {
                  await closeBtn.click();
                  await this.page?.waitForTimeout(500);
                  console.log(`팝업 닫기: ${closeSelector}`);
                  break;
                }
              } catch (e) {
                continue;
              }
            }
          }
          
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }

  private async performAutoLogin(): Promise<void> {
    if (!this.username || !this.password) {
      console.log('로그인 정보가 없습니다. 수동으로 로그인해주세요.');
      await this.page!.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(30000); // 30초 대기
      return;
    }

    console.log('자동 로그인을 시작합니다...');
    
    // 네이버 로그인 페이지로 이동
    await this.page!.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'networkidle' });
    await this.page!.waitForTimeout(2000);

    try {
      // 아이디 입력
      await this.page!.fill('#id', this.username);
      await this.page!.waitForTimeout(1000);
      
      // 비밀번호 입력
      await this.page!.fill('#pw', this.password);
      await this.page!.waitForTimeout(1000);
      
      // 로그인 버튼 클릭
      await this.page!.click('#log\\.login');
      
      // 로그인 완료 대기
      await this.page!.waitForTimeout(5000);
      
      // 로그인 후 페이지 변화 대기
      await this.page!.waitForTimeout(3000);
      
      // 2단계 인증이나 추가 보안 절차가 있는 경우 대기
      const currentUrl = this.page!.url();
      if (currentUrl.includes('cert') || currentUrl.includes('verify') || currentUrl.includes('safe') || currentUrl.includes('nidlogin')) {
        console.log('===============================================');
        console.log('🔐 2단계 인증이 필요합니다!');
        console.log('📱 휴대폰으로 인증을 완료해주세요.');
        console.log('⏰ 60초 후 자동으로 계속 진행됩니다.');
        console.log('===============================================');
        
        // 2단계 인증 완료까지 대기 (60초)
        await this.page!.waitForTimeout(60000);
        
        // 인증 완료 후 메인 페이지로 이동했는지 확인
        const finalUrl = this.page!.url();
        if (finalUrl.includes('naver.com') && !finalUrl.includes('nidlogin')) {
          console.log('✅ 2단계 인증이 완료된 것으로 보입니다.');
        }
      }
      
      // 로그인 상태 저장
      if (this.storageStatePath) {
        try {
          // 디렉토리 생성
          const dir = path.dirname(this.storageStatePath);
          await fs.mkdir(dir, { recursive: true });
          
          const storageState = await this.context!.storageState();
          await fs.writeFile(this.storageStatePath, JSON.stringify(storageState, null, 2));
          console.log(`✅ 로그인 상태가 저장되었습니다: ${this.storageStatePath}`);
          console.log('💡 다음번 로그인시에는 2단계 인증 없이 자동 로그인됩니다!');
        } catch (error) {
          console.error('로그인 상태 저장 실패:', error);
        }
      }
      
      console.log('자동 로그인이 완료되었습니다.');
      
    } catch (error) {
      console.error('자동 로그인 실패:', error);
      console.log('수동으로 로그인해주세요.');
      await this.page!.waitForTimeout(30000);
    }
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    await this.logger.init();
    await this.logger.log('INFO', '=== 네이버 블로그 업로드 시작 ===');
    await this.logger.log('INFO', '입력 데이터 분석', {
      contentId: input.row['콘텐츠ID'],
      title: input.row['제목'],
      tags: input.row['태그'],
      htmlLength: input.html?.length || 0,
      imageCount: input.imagePaths?.length || 0,
      imagePaths: input.imagePaths
    });
    
    try {
      if (!this.page) {
        await this.logger.log('INFO', '브라우저 로그인 시작');
        await this.login();
      }

      const page = this.page!;
      
      // 네이버 블로그 글쓰기 페이지로 직접 이동
      const writeUrl = this.blogId 
        ? `https://blog.naver.com/${this.blogId}/postwrite`
        : 'https://blog.naver.com/postwrite';
        
      console.log(`글쓰기 페이지로 직접 이동: ${writeUrl}`);
      
      try {
        await page.goto(writeUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        console.log('글쓰기 페이지 로드 완료, 현재 URL:', page.url());
      } catch (error) {
        console.log('글쓰기 페이지 직접 접근 실패, 대체 URL 시도:', error.message);
        // 대체 URL들 시도
        const fallbackUrls = [
          `https://blog.naver.com/${this.blogId}/PostWriteForm.naver`,
          'https://blog.naver.com/PostWriteForm.naver'
        ];
        
        for (const url of fallbackUrls) {
          try {
            console.log(`대체 URL 시도: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);
            break;
          } catch (e) {
            console.log(`대체 URL 실패: ${url}`);
            continue;
          }
        }
      }

      // 페이지 로드 대기
      await page.waitForTimeout(3000);
      await this.logger.log('INFO', '글쓰기 페이지 로드 완료');
      
      // 1단계: 임시저장 팝업 처리 (최우선)
      await this.logger.log('INFO', '=== 1단계: 임시저장 팝업 확인 및 처리 ===');
      try {
        const tempSavePopup = await page.$('div.se-popup-container.__se-pop-layer');
        if (tempSavePopup) {
          await this.logger.log('INFO', '임시저장 팝업 발견');
          
          // 팝업 제목 확인
          const titleElement = await tempSavePopup.$('strong.se-popup-title');
          const title = titleElement ? await titleElement.textContent() : '';
          await this.logger.log('INFO', `팝업 제목: ${title}`);
          
          if (title.includes('작성 중인 글이 있습니다')) {
            await this.logger.log('INFO', '임시저장 글 복원 팝업 - 취소 버튼 클릭');
            
            // 취소 버튼 클릭 (새로 작성)
            const cancelButton = await tempSavePopup.$('button.se-popup-button-cancel');
            if (cancelButton) {
              await cancelButton.click();
              await page.waitForTimeout(1000);
              await this.logger.log('INFO', '임시저장 팝업 취소 완료 - 새로 작성 시작');
            } else {
              await this.logger.log('WARN', '임시저장 팝업 취소 버튼을 찾을 수 없음');
            }
          }
        } else {
          await this.logger.log('INFO', '임시저장 팝업 없음');
        }
      } catch (error) {
        await this.logger.log('ERROR', '임시저장 팝업 처리 중 오류', { error: error.message });
      }
      
      // 2단계: 도움말 패널 닫기 처리
      await this.logger.log('INFO', '=== 2단계: 도움말 패널 확인 및 닫기 ===');
      try {
        const helpPanel = await page.$('article.se-help-panel.se-is-on');
        if (helpPanel) {
          await this.logger.log('INFO', '도움말 패널 발견, 닫기 버튼 클릭 시도');
          const closeButton = await page.$('button.se-help-panel-close-button');
          if (closeButton) {
            await closeButton.click();
            await page.waitForTimeout(1000);
            await this.logger.log('INFO', '도움말 패널 닫기 완료');
          } else {
            await this.logger.log('WARN', '도움말 패널 닫기 버튼을 찾을 수 없음');
          }
        } else {
          await this.logger.log('INFO', '도움말 패널 없음');
        }
      } catch (error) {
        await this.logger.log('ERROR', '도움말 패널 처리 중 오류', { error: error.message });
      }
      
      // 3단계: 기타 팝업 처리
      await this.logger.log('INFO', '=== 3단계: 기타 팝업 확인 및 처리 ===');
      await this.handlePopups();

      // 네이버 블로그 SE 에디터 대응
      console.log('=== 네이버 블로그 SE 에디터 처리 시작 ===');
      
      // 제목 입력 (SE 에디터의 contenteditable span 사용)
      const title = input.row['제목'] || '제목 없음';
      
      // SE 에디터 제목 필드 찾기 (성공한 셀렉터 우선 순위)
      const titleSelectors = [
        '.se-title-text', // 이전에 성공한 셀렉터
        'span.se-ff-nanummaruburi.se-fs32.__se-node',
        'span[class*="se-fs32"][class*="__se-node"]',
        '.se-component-content[data-module="title"] span.__se-node'
      ];
      
      let titleSet = false;
      for (const selector of titleSelectors) {
        try {
          console.log(`제목 셀렉터 시도: ${selector}`);
          const titleElement = await page.$(selector);
          if (titleElement) {
            console.log(`제목 요소 발견: ${selector}`);
            
            // SE 에디터의 contenteditable 요소 처리
            await titleElement.click();
            await page.waitForTimeout(1000);
            
            // 기존 내용 선택 및 삭제
            await titleElement.evaluate(el => {
              el.focus();
              // 모든 텍스트 선택
              const range = document.createRange();
              range.selectNodeContents(el);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            });
            
            await page.waitForTimeout(500);
            
            // 선택된 내용 삭제 후 새 제목 입력
            await page.keyboard.press('Delete');
            await page.waitForTimeout(500);
            await page.keyboard.type(title);
            
            // 입력 확인
            const inputValue = await titleElement.evaluate(el => {
              if ('innerText' in el) {
                return el.textContent || (el as HTMLElement).innerText;
              }
              return el.textContent;
            });
            
            await this.logger.log('INFO', '제목 입력 결과 확인', {
              selector: selector,
              expectedTitle: title,
              actualValue: inputValue,
              success: inputValue && inputValue.trim() === title.trim()
            });
            
            if (inputValue && inputValue.trim() === title.trim()) {
              titleSet = true;
              await this.logger.log('INFO', `제목 입력 성공! 사용된 셀렉터: ${selector}`, {
                finalTitle: inputValue
              });
              break;
            } else {
              await this.logger.log('WARN', `제목 입력 실패`, {
                selector: selector,
                expected: title,
                actual: inputValue
              });
            }
          }
        } catch (e) {
          console.log(`제목 셀렉터 실패: ${selector}`, e.message);
          continue;
        }
      }
      
      if (!titleSet) {
        throw new Error('제목 입력 필드를 찾을 수 없습니다');
      }

      // 본문 입력 - SE 에디터 본문 필드 찾기 (성공한 셀렉터 우선 순위)
      const contentSelectors = [
        '.se-text-paragraph span.__se-node', // 이전에 성공한 셀렉터
        'span.se-ff-nanummaruburi.se-fs16.__se-node',
        'span[class*="se-fs16"][class*="__se-node"]',
        '.se-component-content[data-module="text"] span.__se-node'
      ];
      
      let contentSet = false;
      
      // 원본 HTML에서 플레이스홀더 확인 ([이미지#1] 형태)
      const originalPlaceholders = input.html.match(/\[이미지#\d+\]/g) || [];
      
      // 이미지 파일 경로 파싱
      let imagePaths: string[] = [];
      try {
        const imageFilesJson = input.row['이미지파일(JSON)'];
        if (imageFilesJson) {
          imagePaths = JSON.parse(imageFilesJson);
        }
      } catch (e) {
        await this.logger.log('WARN', '이미지파일(JSON) 파싱 실패', { error: e.message });
      }
      
      await this.logger.log('INFO', '본문 입력 시작', {
        originalHtml: input.html.substring(0, 200) + '...',
        originalPlaceholders: originalPlaceholders.join(', '),
        placeholderCount: originalPlaceholders.length,
        imagePathsFromInput: input.imagePaths,
        willProcessPlaceholders: originalPlaceholders.length > 0 && input.imagePaths && input.imagePaths.length > 0
      });
      
      for (const selector of contentSelectors) {
        try {
          await this.logger.log('DEBUG', `본문 셀렉터 시도: ${selector}`);
          const contentElement = await page.$(selector);
          if (contentElement) {
            await this.logger.log('INFO', `본문 요소 발견: ${selector}`);
            
            // SE 에디터의 contenteditable 요소 처리
            await contentElement.click();
            await page.waitForTimeout(1000);
            
            // 기존 내용 선택 및 삭제
            await contentElement.evaluate(el => {
              el.focus();
              // 모든 텍스트 선택
              const range = document.createRange();
              range.selectNodeContents(el);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            });
            
            await page.waitForTimeout(500);
            
            // 선택된 내용 삭제 후 새 본문 입력
            await page.keyboard.press('Delete');
            await page.waitForTimeout(500);
            
            // 본문을 그대로 입력 (플레이스홀더 치환하지 않음)
            await this.logger.log('INFO', '본문 입력 시작 (플레이스홀더 그대로 유지)');
            
            // HTML을 텍스트로 변환 (이미지 플레이스홀더 보존)
            let textContent = input.html;
            
            // 1. 이미지 플레이스홀더를 임시 토큰으로 치환하여 보존
            const placeholderMap = new Map<string, string>();
            const placeholderRegex = /\[이미지#\d+\]/g;
            let match;
            let tokenIndex = 0;
            while ((match = placeholderRegex.exec(input.html)) !== null) {
              const token = `__IMG_TOKEN_${tokenIndex++}__`;
              placeholderMap.set(token, match[0]);
              textContent = textContent.replace(match[0], token);
            }
            
            // 2. HTML 태그 제거 (제목 중복 방지를 위해 첫 번째 h2 태그 제거)
            textContent = textContent
              .replace(/<h2[^>]*>.*?<\/h2>/i, '') // 첫 번째 h2 태그 제거 (제목 중복 방지)
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n')
              .replace(/<p[^>]*>/gi, '')
              .replace(/<\/h[1-6]>/gi, '\n')
              .replace(/<h[1-6][^>]*>/gi, '')
              .replace(/<\/li>/gi, '\n')
              .replace(/<li[^>]*>/gi, '• ')
              .replace(/<\/ul>/gi, '\n')
              .replace(/<ul[^>]*>/gi, '')
              .replace(/<[^>]*>/g, '')
              .replace(/\n+/g, '\n')
              .trim();
            
            // 3. 이미지 플레이스홀더 복원
            for (const [token, placeholder] of placeholderMap) {
              textContent = textContent.replace(token, placeholder);
            }
            
            await page.keyboard.type(textContent);
            await this.logger.log('INFO', '본문 입력 완료 (플레이스홀더 포함)');
            
            // 입력 완료 대기
            await page.waitForTimeout(1000);
            
            // 입력 확인
            const inputValue = await contentElement.evaluate(el => {
              if ('innerText' in el) {
                return el.textContent || (el as HTMLElement).innerText;
              }
              return el.textContent;
            });
            
            await this.logger.log('INFO', '본문 입력 결과', {
              selector: selector,
              inputLength: inputValue?.length || 0,
              first100Chars: inputValue?.substring(0, 100) || '',
              hasPlaceholders: inputValue?.includes('[이미지#') || false,
              placeholderCount: (inputValue?.match(/\[이미지#\d+\]/g) || []).length
            });
            
            if (inputValue && inputValue.trim().length > 10) {
              contentSet = true;
              await this.logger.log('INFO', `본문 입력 성공! 사용된 셀렉터: ${selector}`, {
                finalContentLength: inputValue.length,
                placeholdersFound: (inputValue?.match(/\[이미지#\d+\]/g) || []).join(', ')
              });
              break;
            } else {
              await this.logger.log('WARN', `본문 입력 실패`, {
                selector: selector,
                contentLength: inputValue?.length || 0,
                content: inputValue?.substring(0, 200) || ''
              });
            }
          }
        } catch (e) {
          await this.logger.log('ERROR', `본문 셀렉터 실패: ${selector}`, { error: e.message });
          continue;
        }
      }
      
      if (!contentSet) {
        await this.logger.log('WARN', 'SE 에디터 본문 필드를 찾을 수 없음');
      }

      // 본문 입력 후 즉시 이미지 경로 상태 재확인
      await this.logger.log('INFO', '=== 본문 입력 후 이미지 경로 상태 확인 ===');
      const afterInputText = await page.evaluate(() => document.body.innerText);
      
      // 입력된 이미지 경로들을 찾기
      const foundImagePaths: string[] = [];
      for (const imagePath of imagePaths) {
        if (afterInputText.includes(imagePath)) {
          foundImagePaths.push(imagePath);
        }
      }
      
      await this.logger.log('INFO', '본문 입력 후 이미지 경로 상태', {
        totalImagePaths: imagePaths.length,
        foundImagePaths: foundImagePaths,
        foundCount: foundImagePaths.length,
        bodyTextFirst200: afterInputText.substring(0, 200)
      });

      // 이미지 업로드 처리 (이미지 경로 기반)
      if (input.imagePaths && input.imagePaths.length > 0 && foundImagePaths.length > 0) {
        await this.logger.log('INFO', `=== 이미지 업로드 시작: ${foundImagePaths.length}개 경로 처리 ===`);
        
        // 최종 텍스트 상태 확인
        const finalText = await page.evaluate(() => document.body.innerText);
        
        for (let i = 0; i < input.imagePaths.length; i++) {
          const fullImagePath = input.imagePaths[i]; // 전체 이미지 파일 경로
          const relativeImagePath = imagePaths[i]; // JSON에서 가져온 상대 경로
          
          try {
            await this.logger.log('INFO', `이미지 ${i + 1} 처리 시작`, {
              fullImagePath,
              relativeImagePath,
              pathExistsInPage: finalText.includes(relativeImagePath)
            });
            
            if (!finalText.includes(relativeImagePath)) {
              await this.logger.log('WARN', `이미지 경로 ${relativeImagePath}가 페이지에 없음 - 건너뛰기`);
              continue;
            }
            
            // 이미지 경로 텍스트를 Ctrl+F로 찾기
            await page.keyboard.press('Control+F');
            await page.waitForTimeout(500);
            await page.keyboard.type(relativeImagePath);
            await page.keyboard.press('Enter');
            await page.keyboard.press('Escape'); // 검색창 닫기
            await page.waitForTimeout(500);
            
            // 선택된 경로 텍스트 삭제
            await page.keyboard.press('Delete');
            await page.waitForTimeout(500);
            
            await this.logger.log('INFO', `이미지 경로 삭제 완료: ${relativeImagePath}`);
            
            // 이미지 버튼 클릭
            const imageButtonSelectors = [
              'button.se-image-toolbar-button',
              'button[data-name="image"]',
              'button[data-log="dot.img"]'
            ];
            
            let imageButtonClicked = false;
            for (const selector of imageButtonSelectors) {
              try {
                const button = await page.$(selector);
                if (button) {
                  await button.click();
                  imageButtonClicked = true;
                  await this.logger.log('INFO', `이미지 버튼 클릭: ${selector}`);
                  break;
                }
              } catch (e) {
                continue;
              }
            }
            
            if (imageButtonClicked) {
              // 파일 업로드
              await page.waitForTimeout(1000);
              await page.setInputFiles('input[type="file"]', fullImagePath);
              await this.logger.log('INFO', `파일 선택 완료: ${fullImagePath}`);
              
              // 업로드 처리 대기
              await page.waitForTimeout(3000);
              
              // 팝업 처리
              await this.handlePopups();
              await page.keyboard.press('Escape');
              await page.waitForTimeout(500);
              
              await this.logger.log('INFO', `이미지 업로드 완료: ${relativeImagePath} → ${fullImagePath}`);
            }
            
          } catch (error) {
            await this.logger.log('ERROR', `이미지 ${i + 1} 업로드 실패`, {
              error: error.message,
              fullImagePath,
              relativeImagePath
            });
          }
        }
        
        await this.logger.log('INFO', `=== 이미지 업로드 완료 ===`);
      } else if (originalPlaceholders.length > 0) {
        await this.logger.log('WARN', '플레이스홀더는 있지만 이미지 경로를 찾을 수 없음', {
          originalPlaceholders: originalPlaceholders.join(', '),
          foundImagePaths: foundImagePaths
        });
      }

      // 1단계: 첫 번째 발행 버튼 클릭 (레이어 열기)
      const firstPublishSelectors = [
        'button.publish_btn__m9KHH',
        'button[data-click-area="tpb.publish"]',
        '.publish_btn__m9KHH'
      ];
      
      let firstPublishClicked = false;
      for (const selector of firstPublishSelectors) {
        try {
          console.log(`첫 번째 발행 버튼 시도: ${selector}`);
          const publishButton = await page.$(selector);
          if (publishButton) {
            await publishButton.click();
            firstPublishClicked = true;
            console.log('첫 번째 발행 버튼 클릭 성공 - 발행 레이어 열림');
            break;
          }
        } catch (e) {
          console.log(`첫 번째 발행 버튼 실패: ${selector}`, e.message);
          continue;
        }
      }
      
      if (!firstPublishClicked) {
        throw new Error('첫 번째 발행 버튼을 찾을 수 없습니다');
      }
      
      // 발행 레이어 로드 대기
      await page.waitForTimeout(2000);
      
      // 2단계: 태그 입력 (발행 레이어에서)
      const tags = input.row['태그'];
      if (tags) {
        await this.logger.log('INFO', `=== 태그 입력 시작: ${tags} ===`);
        
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
        const tagInput = await page.$('input#tag-input.tag_input__rvUB5');
        
        if (tagInput) {
          await this.logger.log('INFO', `태그 입력 필드 발견, ${tagArray.length}개 태그 처리`);
          
          for (let i = 0; i < tagArray.length; i++) {
            const tag = tagArray[i];
            // # 제거 - 태그명만 입력
            const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
            
            await this.logger.log('INFO', `태그 ${i + 1}/${tagArray.length} 입력: ${cleanTag}`);
            
            // 태그 입력 필드 클릭 및 입력
            await tagInput.click();
            await page.waitForTimeout(300);
            
            // 태그 입력 필드에 포커스가 있는지 확인
            await tagInput.focus();
            await page.waitForTimeout(100);
            
            // 기존 내용 클리어 (입력 필드 내용만 선택)
            await tagInput.evaluate(input => {
              if (input instanceof HTMLInputElement) {
                input.select();
              }
            });
            await page.waitForTimeout(100);
            
            // 태그 입력 (# 없이)
            await tagInput.type(cleanTag);
            await page.waitForTimeout(300);
            
            // Enter 두 번 - 사용자 요구사항에 따라
            await page.keyboard.press('Enter');
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);
            
            await this.logger.log('DEBUG', `태그 ${i + 1} 입력 완료: ${cleanTag}`);
          }
          
          await this.logger.log('INFO', `태그 입력 완료: ${tagArray.length}개`);
        } else {
          await this.logger.log('WARN', '태그 입력 필드를 찾을 수 없습니다');
        }
      } else {
        await this.logger.log('INFO', '태그 없음 - 태그 입력 건너뛰기');
      }
      
      // 3단계: 진짜 발행 버튼 클릭
      await this.logger.log('INFO', '=== 진짜 발행 버튼 클릭 시도 ===');
      const finalPublishSelectors = [
        'button.confirm_btn__WEaBq[data-testid="seOnePublishBtn"]',
        'button[data-testid="seOnePublishBtn"]',
        'button[data-click-area="tpb*i.publish"]',
        '.confirm_btn__WEaBq'
      ];
      
      let finalPublishClicked = false;
      for (const selector of finalPublishSelectors) {
        try {
          await this.logger.log('DEBUG', `진짜 발행 버튼 시도: ${selector}`);
          const finalPublishButton = await page.$(selector);
          if (finalPublishButton) {
            await finalPublishButton.click();
            finalPublishClicked = true;
            await this.logger.log('INFO', '진짜 발행 버튼 클릭 성공!');
            break;
          }
        } catch (e) {
          await this.logger.log('DEBUG', `진짜 발행 버튼 실패: ${selector}`, { error: e.message });
          continue;
        }
      }
      
      if (!finalPublishClicked) {
        await this.logger.log('WARN', '진짜 발행 버튼을 찾을 수 없습니다');
      }
      
      // 발행 완료 대기
      await page.waitForTimeout(5000);
      await this.logger.log('INFO', '발행 완료 대기 종료');

      // 현재 URL에서 포스트 ID 추출
      const currentUrl = page.url();
      let postId = input.row['콘텐츠ID'];
      let postUrl = currentUrl;

      await this.logger.log('INFO', '발행 결과 URL 분석', {
        currentUrl,
        originalContentId: postId
      });

      if (currentUrl.includes('blog.naver.com')) {
        const match = currentUrl.match(/\/([^\/]+)\/(\d+)/);
        if (match) {
          postId = match[2];
          postUrl = currentUrl;
          await this.logger.log('INFO', '포스트 ID 추출 성공', { postId, postUrl });
        } else {
          await this.logger.log('WARN', 'URL 패턴 매칭 실패', { currentUrl });
        }
      }

      await this.logger.log('INFO', '=== 네이버 블로그 업로드 성공 ===', {
        postId,
        postUrl,
        platform: this.platform
      });

      return {
        ok: true,
        platform: this.platform,
        url: postUrl,
        id: postId,
      };

    } catch (error) {
      await this.logger.log('ERROR', '네이버 블로그 업로드 오류', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        ok: false,
        platform: this.platform,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = undefined;
    }
    if (this.context) {
      await this.context.close();
      this.context = undefined;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }
}