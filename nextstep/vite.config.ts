/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// Strict Content Security Policy for production builds: NextStep makes no third-party requests.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "connect-src 'self'; font-src 'self' data:; worker-src 'self'; manifest-src 'self'; object-src 'none'; " +
  "base-uri 'self'; form-action 'none'";

function cspPlugin(): Plugin {
  return {
    name: 'nextstep-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    }
  };
}

// VITE_TARGET=artifact builds a single-file preview (no service worker) for a private claude.ai Artifact.
const ARTIFACT = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.VITE_TARGET === 'artifact';

export default defineConfig({
  // Relative base so the app works from any folder, e.g. https://<user>.github.io/<repo>/nextstep/
  base: './',
  build: ARTIFACT ? { outDir: 'dist-preview', chunkSizeWarningLimit: 2000, rollupOptions: { output: { inlineDynamicImports: true } } } : { chunkSizeWarningLimit: 700 },
  plugins: [
    react(),
    ...(ARTIFACT
      ? []
      : [
          cspPlugin(),
          VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
            manifest: {
              name: 'NextStep — Your future starts here',
              short_name: 'NextStep',
              description: 'Explore where your skills, qualifications and experience could take you. UK career pathways prototype.',
              theme_color: '#0a1428',
              background_color: '#0a1428',
              display: 'standalone',
              orientation: 'portrait',
              start_url: './',
              scope: './',
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
              ]
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
              navigateFallback: 'index.html',
              runtimeCaching: []
            }
          })
        ])
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
