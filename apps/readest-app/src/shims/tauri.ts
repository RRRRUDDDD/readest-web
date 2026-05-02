export type PermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
export const PermissionState = {
  Granted: 'granted',
  Denied: 'denied',
  Prompt: 'prompt',
  PromptWithRationale: 'prompt-with-rationale',
} as const;
export type UnlistenFn = () => void;
export type PluginListener = { unregister: () => Promise<void> };
export class Update {
  currentVersion = '';
  version = '';
  date?: string;
  body?: string;

  async downloadAndInstall(_onEvent?: (event: DownloadEvent) => void): Promise<void> {}
}

type Listener = (...args: unknown[]) => void;
type EventCallback<T = unknown> = (event: { payload: T }) => void;
type DownloadEvent =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' };
type WebviewWindowOptions = {
  url?: string;
  title?: string;
  decorations?: boolean;
  titleBarStyle?: string;
  transparent?: boolean;
  shadow?: boolean;
  [key: string]: unknown;
};
type WebSocketMessage =
  | { type: 'Text'; data: string }
  | { type: 'Binary'; data: Uint8Array | number[] };

const noop = () => {};
const asyncNoop = async () => {};
const unsupported = async (..._args: unknown[]) => {
  throw new Error('Native app APIs are not available in the web build');
};

export const invoke = async <T = unknown>(
  _command?: string,
  _args?: Record<string, unknown>,
): Promise<T> => {
  throw new Error('Native app APIs are not available in the web build');
};
export const convertFileSrc = (path: string) => path;
export const addPluginListener = async <T = unknown>(
  _plugin: string,
  _event: string,
  _handler: (payload: T) => void,
): Promise<PluginListener> => ({
  unregister: asyncNoop,
});
export class Channel<T = unknown> {
  onmessage?: (message: T) => void;
}
export const listen = async <T = unknown>(
  _event: string,
  _handler: EventCallback<T>,
): Promise<UnlistenFn> => noop;
export const emitTo = asyncNoop;
export const TauriEvent = {
  WINDOW_FOCUS: 'tauri://focus',
  WINDOW_CLOSE_REQUESTED: 'tauri://close-requested',
} as const;

export const BaseDirectory = {
  AppData: 'AppData',
  AppLocalData: 'AppLocalData',
  Document: 'Document',
  Download: 'Download',
  Home: 'Home',
  Resource: 'Resource',
  Temp: 'Temp',
} as const;
export type BaseDirectory = (typeof BaseDirectory)[keyof typeof BaseDirectory];

export const SeekMode = {
  Start: 0,
  Current: 1,
  End: 2,
} as const;
export type SeekMode = (typeof SeekMode)[keyof typeof SeekMode];

export type FileHandle = {
  close: () => Promise<void>;
  read: (_buffer: Uint8Array) => Promise<number | null>;
  seek: (_offset: number, _whence: SeekMode) => Promise<number>;
  stat: () => Promise<{ size: number; mtime?: Date }>;
};

export const open = unsupported;
export const mkdir = unsupported;
export const remove = unsupported;
export const readTextFile = unsupported;
export const writeTextFile = unsupported;
export const writeFile = unsupported;

const pathParts = (value: string) => value.split(/[\\/]+/).filter(Boolean);
export const join = async (...parts: string[]) => parts.flatMap(pathParts).join('/');
export const basename = async (value: string) => pathParts(value).at(-1) ?? value;
export const dataDir = async () => '';
export const desktopDir = async () => '';
export const documentDir = async () => '';

const windowStub = {
  label: 'main',
  close: asyncNoop,
  hide: asyncNoop,
  isMaximized: async () => false,
  listen: async <T = unknown>(_event: string, _handler: EventCallback<T>): Promise<UnlistenFn> =>
    noop,
  maximize: asyncNoop,
  minimize: asyncNoop,
  onCloseRequested: async (): Promise<UnlistenFn> => noop,
  onFocusChanged: async (_handler: EventCallback<boolean>): Promise<UnlistenFn> => noop,
  once: (_event: string, _listener: Listener) => {},
  outerPosition: async () => ({ x: 0, y: 0 }),
  setAlwaysOnTop: asyncNoop,
  setDecorations: asyncNoop,
  setFocus: asyncNoop,
  setFullscreen: asyncNoop,
  setShadow: asyncNoop,
  setSkipTaskbar: asyncNoop,
  setTitle: asyncNoop,
  setVisibleOnAllWorkspaces: asyncNoop,
  show: asyncNoop,
  startDragging: asyncNoop,
  toggleMaximize: asyncNoop,
  unmaximize: asyncNoop,
};

export const getCurrentWindow = () => windowStub;
export const getAllWindows = async () => [windowStub];
export enum ScrollBarStyle {
  Default = 'default',
  Overlay = 'overlay',
}

export class WebviewWindow {
  label: string;

  constructor(label: string, _options?: WebviewWindowOptions) {
    this.label = label;
  }

  static async getByLabel(_label: string) {
    return null;
  }

  once(_event: string, _listener: Listener) {}
  emit = async (_event?: string, _payload?: unknown) => {};
  close = asyncNoop;
  setFocus = asyncNoop;
}

export const getCurrentWebview = () => ({
  onDragDropEvent: async (_handler?: Listener): Promise<UnlistenFn> => noop,
});

export class Menu {
  static async new(_options?: unknown) {
    return new Menu();
  }

  append = async (_item?: unknown) => {};
  popup = asyncNoop;
}

export class MenuItem {
  static async new(_options?: unknown) {
    return new MenuItem();
  }
}

type TauriFetchInit = RequestInit & {
  danger?: {
    acceptInvalidCerts?: boolean;
    acceptInvalidHostnames?: boolean;
  };
  connectTimeout?: number;
};

export const fetch = (input: RequestInfo | URL, init?: TauriFetchInit) => {
  const { danger: _danger, connectTimeout: _connectTimeout, ...requestInit } = init ?? {};
  return globalThis.fetch(input, requestInit);
};
export const openUrl = async (url: string) => {
  globalThis.open?.(url, '_blank', 'noopener,noreferrer');
};
export const revealItemInDir = async (_path?: string) => {};
export const impactFeedback = asyncNoop;
export const type = () => 'unknown';
export const arch = () => 'unknown';
export const check = async (): Promise<Update | null> => null;
export const relaunch = asyncNoop;
export const exit = async (_code?: number) => {};

export class Command {
  static create(_program?: string, _args?: string[]) {
    return new Command();
  }

  execute = async () => ({ code: 1, stdout: '', stderr: '' });
  spawn = async () => ({ pid: 0 });
}

export const getCurrent = async (): Promise<string[]> => [];
export const onOpenUrl = async (_handler: (urls: string[]) => void): Promise<UnlistenFn> => noop;
export const start = unsupported;
export const cancel = async (_id?: number) => {};
export const onUrl = async (_handler: (urls: string[]) => void): Promise<UnlistenFn> => noop;
export const onInvalidUrl = async (_handler: (urls: string[]) => void): Promise<UnlistenFn> => noop;
export const save = unsupported;
export const ask = async () => false;
export const getMatches = async (): Promise<{
  args: Record<string, { value: string; occurrences: number }>;
}> => ({ args: {} });
export const shareFile = async (_path?: string) => {};
export const getBatteryInfo = async () => ({ level: 1, charging: true });

export class Database {
  static open = unsupported;
}

export type QueryResult = {
  rows: unknown[];
  rowsAffected: number;
  lastInsertId?: string | number;
};

const websocket = {
  connect: async (_url: string, _options?: unknown) => ({
    addListener: async (_handler: (message: WebSocketMessage) => void): Promise<UnlistenFn> => noop,
    disconnect: async () => {},
    send: async (_message: string | Uint8Array) => {},
  }),
};

export default websocket;
