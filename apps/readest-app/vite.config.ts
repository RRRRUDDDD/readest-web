import path from 'node:path';
import vinext from 'vinext';
import { defineConfig } from 'vite';

const tauriShim = path.resolve('src/shims/tauri.ts');

export default defineConfig({
  plugins: [vinext()],
  resolve: {
    alias: {
      '@pdfjs': path.resolve('public/vendor/pdfjs'),
      '@simplecc': path.resolve('public/vendor/simplecc'),
      '@tauri-apps/api/core': tauriShim,
      '@tauri-apps/api/event': tauriShim,
      '@tauri-apps/api/menu': tauriShim,
      '@tauri-apps/api/path': tauriShim,
      '@tauri-apps/api/webview': tauriShim,
      '@tauri-apps/api/webviewWindow': tauriShim,
      '@tauri-apps/api/window': tauriShim,
      '@tauri-apps/plugin-cli': tauriShim,
      '@tauri-apps/plugin-deep-link': tauriShim,
      '@tauri-apps/plugin-dialog': tauriShim,
      '@tauri-apps/plugin-fs': tauriShim,
      '@tauri-apps/plugin-haptics': tauriShim,
      '@tauri-apps/plugin-http': tauriShim,
      '@tauri-apps/plugin-opener': tauriShim,
      '@tauri-apps/plugin-os': tauriShim,
      '@tauri-apps/plugin-process': tauriShim,
      '@tauri-apps/plugin-shell': tauriShim,
      '@tauri-apps/plugin-updater': tauriShim,
      '@tauri-apps/plugin-websocket': tauriShim,
      '@fabianlars/tauri-plugin-oauth': tauriShim,
      '@choochmeque/tauri-plugin-sharekit-api': tauriShim,
      'tauri-plugin-device-info-api': tauriShim,
      'tauri-plugin-turso': tauriShim,
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.message?.includes("Can't resolve original location of error")) return;
        defaultHandler(warning);
      },
    },
  },
  ssr: {
    noExternal: ['tinycolor2'],
  },
});
