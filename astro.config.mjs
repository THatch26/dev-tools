import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  integrations: [react(), sitemap()],

  vite: {
    plugins: [tailwindcss()]
  },

  site: 'https://dev-tools.devtoolsite.workers.dev',
  adapter: cloudflare(),
});