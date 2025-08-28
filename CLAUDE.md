# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

W4-MCP is a multi-platform content publishing system that processes content from JSON sheets and publishes to various blog platforms (Naver Blog, Tistory, Cafe24, Sonaverse, Threads). The system handles HTML content with image placeholders, replaces them with actual images, and publishes through automated browser interactions using Playwright.

## Common Commands

### Build
```bash
npm run build
```

### Run CLI Tool
```bash
npm run dev:run -- --config config.yaml --content content.json
```

### Start MCP Server
```bash
npm run dev:mcp
```

### Run Specific Platforms/Content
```bash
npm run dev:run -- --config config.yaml --content content.json --platforms naver_blog,tistory --ids CONTENT001
```

### Install Playwright Browsers
```bash
npm run playwright:install
```

## Architecture

### Core Components

- **Orchestrator** (`src/w4/orchestrator.ts`): Main execution engine that coordinates the entire publishing workflow
- **Renderer** (`src/w4/render.ts`): Processes HTML content and replaces image placeholders with actual file paths
- **Uploaders** (`src/uploaders/base.ts`): Platform-specific publishing implementations using Playwright automation

### Data Flow

1. Content data is loaded from JSON files containing `ContentRow` objects with Korean column names (제목, 콘텐츠ID, 플랫폼, 본문HTML, etc.)
2. Images are referenced via placeholders in HTML and resolved through `AltCaptionItem` arrays
3. Each platform uploader inherits from `BaseUploader` and implements platform-specific DOM interactions
4. Results are saved to `outputDir/w4-results.json`

### Configuration

The system uses YAML config files (see `config.example.yaml`):
- `imageRoot`: Base directory for image files
- `outputDir`: Where rendered HTML and logs are saved
- `storageStates`: Playwright authentication state files per platform
- `platforms`: List of enabled platforms
- `headless`: Browser headless mode setting

### Platform Support

Each platform uploader handles:
- Authentication via stored Playwright sessions
- DOM interaction patterns specific to each platform's editor
- File upload mechanisms
- Publishing workflows

Current platforms: `naver_blog`, `tistory`, `cafe24_blog`, `sonaverse_blog`, `threads`

### MCP Integration

The project includes an MCP (Model Context Protocol) server that exposes the `w4.run` tool for external systems to trigger publishing workflows.

## File Structure Notes

- CLI entry points are in `src/cli/`
- Core business logic in `src/w4/`
- Platform uploaders in `src/uploaders/`
- Utilities for file operations, logging, and parsing in `src/utils/`
- TypeScript types with Korean field names reflecting the actual data structure in `src/types.ts`