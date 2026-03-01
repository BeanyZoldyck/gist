# AGENTS.md

## Project Structure

This repo is the Chrome extension (React + TypeScript + Vite) with AI-powered browser automation. The extension lives at repo root.

### File Tree

```
.                              # Repo root (Chrome extension)
├── manifest.config.ts         # Extension manifest (MV3)
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── tsconfig.compiler.json
├── public/
│   └── logo.png
├── src/
│   ├── background.ts          # Service worker, message routing, storage
│   ├── ai/
│   │   ├── assistant.ts       # Natural language → automation
│   │   └── intent-parser.ts   # Structured action parsing
│   ├── utils/
│   │   ├── qdrant-client.ts
│   │   └── rag-query.ts
│   ├── components/
│   │   └── HelloWorld.tsx
│   ├── sidepanel/             # Side panel UI (Resources, AI Chat, Ask)
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── AIChat.tsx
│   │   ├── AIChat.css
│   │   ├── AskPanel.tsx
│   │   └── index.css
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── App.test.tsx
│   │   ├── App.css
│   │   └── index.css
│   ├── settings/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── content/               # Injected scripts (DOM, automation)
│   │   ├── main.tsx
│   │   ├── automation.ts      # DOM interaction, command execution
│   │   ├── link-hints.tsx
│   │   ├── input-completion.tsx
│   │   ├── components/
│   │   │   ├── InputCompletion.tsx
│   │   │   ├── InputOverlay.tsx
│   │   │   ├── InputOverlay.css
│   │   │   ├── LinkHints.tsx
│   │   │   └── TagPrompt.tsx
│   │   ├── utils/
│   │   │   ├── aria-snapshot.ts
│   │   │   ├── completion-manager.ts
│   │   │   ├── dom-utils.ts
│   │   │   ├── link-hints.ts
│   │   │   ├── qdrant-content-client.ts
│   │   │   ├── resource-storage.ts
│   │   │   └── youtube-metadata.ts
│   │   └── views/
│   │       ├── App.tsx
│   │       └── App.css
│   ├── assets/
│   │   ├── crx.svg
│   │   ├── react.svg
│   │   └── vite.svg
│   └── test/
│       └── setup.ts           # Vitest/Playwright test setup
├── tests/
│   └── e2e/
│       ├── fixtures.ts
│       └── popup.spec.ts
└── dist/                      # Build output (generated)
```

Other at repo root:
- `AGENTS.md` – this file
- `reference/` – reference material (e.g. MCP)

### Key Components
- **Sidepanel UI**: Three tabs (Resources, AI Chat, Ask)
- **Content Scripts**: `automation.ts` - DOM interaction, `aria-snapshot.ts` - page structure
- **Background Script**: `background.ts` - Orchestrates commands, IndexedDB storage
- **AI Modules**: `assistant.ts`, `intent-parser.ts` - Natural language to automation actions

## Build/Lint/Test Commands

### Chrome Extension (repo root)
```bash
npm run dev           # Start dev server
npm run build         # TypeScript + Vite build
npm run test          # Run Vitest (interactive)
npm run test:run      # Run tests once
npm run test:coverage # Run tests with coverage
npm run test:e2e      # Run Playwright E2E tests
npm run test:e2e:ui   # Run Playwright tests with UI
```

### Running Single Tests
- Unit tests: `vitest run src/path/to/test.test.tsx`
- E2E tests: `playwright test tests/e2e/popup.spec.ts`

## Code Style Guidelines

### Imports
- Use ES6 import/export
- Order: external libraries → internal modules with `@/` path alias
- Path alias `@/*` maps to `src/` in both projects
- No file extensions for TypeScript imports (`allowImportingTsExtensions: true`)

### Formatting
- 2-space indentation
- Use semicolons consistently
- No explicit linter configured - follow existing patterns
- Wrap long lines at ~100-120 chars

### Types
- Strict TypeScript enabled
- Prefer interfaces for data structures: `interface Resource { ... }`
- Explicit types on function params and returns: `async function foo(x: string): Promise<void>`
- Use literal types: `type Role = 'user' | 'assistant' | 'system'`
- Optional chaining and nullish coalescing: `resource?.title ?? ''`

### Naming Conventions
- camelCase for variables/functions: `loadResources()`, `handleError()`
- PascalCase for React components: `export default function App()`
- PascalCase for classes: `class AIAssistant {}`
- UPPER_SNAKE_CASE for constants: `const DB_NAME = 'gist-resources'`
- Descriptive names: `handleAutomationAction` not `handleAct`

### Error Handling
- Always catch errors in async functions: `try { ... } catch (error) { ... }`
- Log errors with context: `console.error('[Module] Operation failed:', error)`
- Provide user-friendly messages: `return { success: false, error: 'Resource not found' }`
- Non-fatal operations: wrap in try/catch and log without throwing
- Type guard: `error instanceof Error ? error.message : String(error)`

### React/Component Patterns
- Use functional components with hooks: `useState`, `useEffect`
- Early returns for loading/empty states
- Debounce expensive operations (e.g., search): `setTimeout` with cleanup
- Cleanup effects: `return () => clearTimeout/destructor()`
- Event handlers as separate functions: `const handleClick = () => { ... }`

### Async/Streaming
- Use async/await over callbacks
- Use async generators for streaming: `async function *stream() { yield ... }`
- Abort/cancel support where appropriate
- Handle response errors: `if (!response.ok) throw ...`

### Logging
- Prefix with module: `[SidePanel]`, `[Background]`, `[AI Assistant]`
- Use console.error for errors, console.warn for expected issues
- Avoid sensitive data in logs (API keys, tokens)

### Chrome Extension Specifics
- Use `chrome.runtime.sendMessage` for extension messaging
- Handle responses with proper error checking
- Background service workers: no DOM access
- Content scripts: use chrome.tabs.sendMessage

### Testing
- Unit: Vitest with @testing-library/react
- E2E: Playwright with custom fixtures
- Mock chrome APIs: `vi.mocked(chrome.api).mockClear()`
- Tests in `**/*.test.tsx` or `**/*.spec.ts`
- Setup file: `src/test/setup.ts`

## AI/Automation Architecture

### Message Flow
1. User request → AI Assistant (`assistant.ts`) processes natural language
2. Intent Parser (`intent-parser.ts`) converts to structured automation actions
3. Background script routes commands via `chrome.runtime.sendMessage`
4. Content scripts execute actions and return results
5. AI receives feedback, updates context, streams response

### Supported Automation Actions
- **snapshot**: Capture ARIA-aware page structure (YAML format)
- **navigate**: `{"url": "https://example.com"}`
- **click**: `{"element": "Submit"}` or `{"ref": "1"}` (by index)
- **type**: `{"element": "Search", "text": "Hello", "submit": true}`
- **hover**: Hover over elements
- **selectOption**: `{"element": "Country", "values": ["USA"]}`
- **drag**: `{"startElement": "Item", "endElement": "DropZone"}`
- **pressKey**: `{"key": "Enter"}`
- **wait**: `{"time": 2}` (seconds)
- **goBack/goForward**: Navigate browser history

### AI Configuration
- Required: API key (OpenAI-compatible endpoint)
- Models: openrouter's free model
- Config stored in `chrome.storage.local` (keys: `aiApiKey`, `aiModel`, `aiBaseUrl`)
- Use `@ai-sdk/react` for streaming chat UI components

### State Management
- `AIAssistant.messages[]`: Chat history (max 20, keep last 10)
- `pageSnapshot`: Current ARIA snapshot for context
- Streaming: `async function *chatStream()` yields chunks
- Always handle snapshot requests mid-stream (AI can ask for context)

### Database/Storage
- IndexedDB: Promisify operations with error handling
- Qdrant failures should be non-fatal (logged but don't block)
- Always broadcast updates: `chrome.runtime.sendMessage({ type: 'RESOURCES_UPDATED' })`

### Path Aliases
`@/*` maps to `src/*`
- Import examples: `import { Resource } from '@/utils/resource-storage'`
