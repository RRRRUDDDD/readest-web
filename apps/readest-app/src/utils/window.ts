import { eventDispatcher } from './event';

export const getWindowLogicalPosition = async () => {
  return { x: window.screenX, y: window.screenY };
};

export const handleMinimize = async () => {};

export const handleToggleMaximize = async () => {};

export const handleClose = async () => {
  window.close();
};

export const handleOnCloseWindow = async (callback: () => void) => {
  const handler = () => callback();
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
};

export const tauriHandleOnCloseWindow = handleOnCloseWindow;

export const handleToggleFullScreen = async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
};

export const handleSetAlwaysOnTop = async (_isAlwaysOnTop: boolean) => {};

export const getAlwaysOnTop = async () => false;

export const handleOnWindowFocus = async (callback: () => void) => {
  window.addEventListener('focus', callback);
  return () => window.removeEventListener('focus', callback);
};

export const quitApp = async () => {
  await eventDispatcher.dispatch('quit-app');
  window.close();
};
