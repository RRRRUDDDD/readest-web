import withSerwistInit from '@serwist/next';
import withBundleAnalyzer from '@next/bundle-analyzer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env['NODE_ENV'] === 'development';
const appPlatform = process.env['NEXT_PUBLIC_APP_PLATFORM'];
const staticExport = process.env['NEXT_OUTPUT'] === 'export';
const tauriShim = path.resolve(__dirname, 'src/shims/tauri.ts');
const tauriAliases = {
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
};

if (isDev) {
  const { initOpenNextCloudflareForDev } = await import('@opennextjs/cloudflare');
  initOpenNextCloudflareForDev();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: staticExport ? 'export' : undefined,
  pageExtensions: staticExport ? ['jsx', 'tsx'] : ['js', 'jsx', 'ts', 'tsx'],
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  // Configure assetPrefix or else the server won't properly resolve your assets.
  assetPrefix: '',
  reactStrictMode: true,
  serverExternalPackages: ['isows'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      nunjucks: 'nunjucks/browser/nunjucks.js',
      // `js-mdict` is consumed as TS source via tsconfig paths from
      // `packages/js-mdict/src/`; its sources `import 'fflate'` directly.
      // Without an alias, webpack walks up from that source location and
      // can't find fflate (only installed in this app's node_modules).
      fflate: path.resolve(__dirname, 'node_modules/fflate'),
      ...tauriAliases,
      ...(appPlatform !== 'web' ? { '@tursodatabase/database-wasm': false } : {}),
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      nunjucks: 'nunjucks/browser/nunjucks.js',
      // Turbopack rejects absolute paths in resolveAlias ("server relative
      // imports not implemented") — use a project-relative path.
      fflate: './node_modules/fflate',
      '@tauri-apps/api/core': './src/shims/tauri.ts',
      '@tauri-apps/api/event': './src/shims/tauri.ts',
      '@tauri-apps/api/menu': './src/shims/tauri.ts',
      '@tauri-apps/api/path': './src/shims/tauri.ts',
      '@tauri-apps/api/webview': './src/shims/tauri.ts',
      '@tauri-apps/api/webviewWindow': './src/shims/tauri.ts',
      '@tauri-apps/api/window': './src/shims/tauri.ts',
      '@tauri-apps/plugin-cli': './src/shims/tauri.ts',
      '@tauri-apps/plugin-deep-link': './src/shims/tauri.ts',
      '@tauri-apps/plugin-dialog': './src/shims/tauri.ts',
      '@tauri-apps/plugin-fs': './src/shims/tauri.ts',
      '@tauri-apps/plugin-haptics': './src/shims/tauri.ts',
      '@tauri-apps/plugin-http': './src/shims/tauri.ts',
      '@tauri-apps/plugin-opener': './src/shims/tauri.ts',
      '@tauri-apps/plugin-os': './src/shims/tauri.ts',
      '@tauri-apps/plugin-process': './src/shims/tauri.ts',
      '@tauri-apps/plugin-shell': './src/shims/tauri.ts',
      '@tauri-apps/plugin-updater': './src/shims/tauri.ts',
      '@tauri-apps/plugin-websocket': './src/shims/tauri.ts',
      '@fabianlars/tauri-plugin-oauth': './src/shims/tauri.ts',
      '@choochmeque/tauri-plugin-sharekit-api': './src/shims/tauri.ts',
      'tauri-plugin-device-info-api': './src/shims/tauri.ts',
      'tauri-plugin-turso': './src/shims/tauri.ts',
      ...(appPlatform !== 'web' ? { '@tursodatabase/database-wasm': './src/utils/stub.ts' } : {}),
    },
  },
  transpilePackages: [
    'ai',
    'ai-sdk-ollama',
    '@ai-sdk/react',
    '@assistant-ui/react',
    '@assistant-ui/react-ai-sdk',
    '@assistant-ui/react-markdown',
    'streamdown',
    ...(isDev
      ? []
      : [
          'i18next-browser-languagedetector',
          'react-i18next',
          'i18next',
          'highlight.js',
          'foliate-js',
          'marked',
        ]),
  ],
  async rewrites() {
    return [
      {
        source: '/reader/:ids',
        destination: '/reader?ids=:ids',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev
              ? 'public, max-age=0, must-revalidate'
              : 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

const pwaDisabled = isDev || appPlatform !== 'web';

const withPWA = pwaDisabled
  ? (config) => config
  : withSerwistInit({
      swSrc: 'src/sw.ts',
      swDest: 'public/sw.js',
      cacheOnNavigation: true,
      reloadOnOnline: true,
      disable: false,
      register: true,
      scope: '/',
    });

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withPWA(withAnalyzer(nextConfig));
