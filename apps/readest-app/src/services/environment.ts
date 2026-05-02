import { AppService } from '@/types/system';
import { READEST_NODE_BASE_URL, READEST_WEB_BASE_URL } from './constants';

declare global {
  interface Window {
    __READEST_CLI_ACCESS?: boolean;
  }
}

export const isTauriAppPlatform = () => false;
export const isWebAppPlatform = () => true;
export const hasCli = () => typeof window !== 'undefined' && window.__READEST_CLI_ACCESS === true;
export const isPWA = () =>
  typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
export const getBaseUrl = () => process.env['NEXT_PUBLIC_API_BASE_URL'] ?? READEST_WEB_BASE_URL;
export const getNodeBaseUrl = () =>
  process.env['NEXT_PUBLIC_NODE_BASE_URL'] ?? READEST_NODE_BASE_URL;

export const isMacPlatform = () =>
  typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const getCommandPaletteShortcut = () => (isMacPlatform() ? '⌘⇧P' : 'Ctrl+Shift+P');

const isWebDevMode = () => process.env['NODE_ENV'] === 'development' && isWebAppPlatform();

// Dev API only in development mode and web platform with command `pnpm dev-web`.
export const getAPIBaseUrl = () => {
  if (isWebDevMode()) return '/api';
  const apiBaseUrl = process.env['NEXT_PUBLIC_API_BASE_URL'];
  return apiBaseUrl ? `${apiBaseUrl}/api` : '/api';
};

// For Node.js API that currently not supported in some edge runtimes
export const getNodeAPIBaseUrl = () => {
  if (isWebDevMode()) return '/api';
  const nodeBaseUrl = process.env['NEXT_PUBLIC_NODE_BASE_URL'];
  return nodeBaseUrl ? `${nodeBaseUrl}/api` : getAPIBaseUrl();
};

export interface EnvConfigType {
  getAppService: () => Promise<AppService>;
}

let webAppService: AppService | null = null;
const getWebAppService = async () => {
  if (!webAppService) {
    const { WebAppService } = await import('@/services/webAppService');
    webAppService = new WebAppService();
    await webAppService.init();
  }
  return webAppService;
};

const environmentConfig: EnvConfigType = {
  getAppService: getWebAppService,
};

export default environmentConfig;
