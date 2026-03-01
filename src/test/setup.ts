import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock port for runtime.connect
const createMockPort = () => ({
  postMessage: vi.fn(),
  onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
  disconnect: vi.fn(),
  name: "sidePanel",
});

// Mock Chrome extension API for unit tests (customize with more APIs as needed)
const chromeMock = {
  runtime: {
    openOptionsPage: vi.fn(),
    lastError: null as chrome.runtime.LastError | null,
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
    id: "mock-extension-id",
    sendMessage: vi.fn((_msg: unknown, cb?: (response: unknown) => void) => cb?.({ success: true, data: {} })),
    connect: vi.fn((_opts?: { name?: string }) => createMockPort()),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  windows: {
    WINDOW_ID_CURRENT: -2,
    getCurrent: vi.fn(() => Promise.resolve({ id: 1 })),
  },
  sidePanel: {
    open: vi.fn(() => Promise.resolve()),
    setOptions: vi.fn((_opts: unknown, cb?: () => void) => cb?.()),
  },
  tabs: {
    query: vi.fn((_queryInfo: unknown, cb: (tabs: chrome.tabs.Tab[]) => void) => {
      cb([{ id: 1, url: "https://example.com" } as chrome.tabs.Tab]);
    }),
    sendMessage: vi.fn((_tabId: number, _msg: unknown, cb?: () => void) => cb?.()),
  },
  storage: {
    local: {
      get: vi.fn((_keys?: string | string[] | null, cb?: (items: Record<string, unknown>) => void) =>
        cb?.({}) ?? Promise.resolve({})
      ),
      set: vi.fn((_items: Record<string, unknown>, cb?: () => void) => cb?.() ?? Promise.resolve()),
    },
    sync: {
      get: vi.fn((_keys?: string | string[] | null, cb?: (items: Record<string, unknown>) => void) =>
        cb?.({}) ?? Promise.resolve({})
      ),
      set: vi.fn((_items: Record<string, unknown>, cb?: () => void) => cb?.() ?? Promise.resolve()),
    },
  },
  commands: {
    getAll: vi.fn((cb?: (commands: chrome.commands.Command[]) => void) => {
      cb?.([]);
      return Promise.resolve([]);
    }),
    onCommand: { addListener: vi.fn() },
  },
};

vi.stubGlobal("chrome", chromeMock);
