import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

const config = defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});

config.buildCommand = 'pnpm build-web';

export default config;
