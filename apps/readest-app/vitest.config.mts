import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const tauriShim = path.resolve(__dirname, 'src/shims/tauri.ts');

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // The @pdfjs alias from tsconfig only resolves within the app's own
      // source files.  foliate-js/pdf.js lives outside that scope, so Vite
      // needs an explicit alias to find the vendored pdfjs build.
      '@pdfjs': path.resolve(__dirname, 'public/vendor/pdfjs'),
      // `js-mdict` is consumed via tsconfig paths from `packages/js-mdict/src/`.
      // Its sources `import 'fflate'` directly — without an alias, vite's
      // import-analysis walks up from the redirected file location and fails
      // to find fflate (it's installed only in this app's node_modules).
      // Pin all `fflate` resolutions to the app's copy to keep js-mdict
      // self-contained at the source-tree level.
      fflate: path.resolve(__dirname, 'node_modules/fflate'),
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
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/**',
      '**/*.browser.test.ts',
      '**/*.browser.test.tsx',
      '**/*.tauri.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/**/test/**',
      ],
    },
  },
});
