/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// Strict Content Security Policy for production builds: AthleteOS makes no third-party requests.
// (Links to external technique videos are ordinary navigations, which CSP does not block.)
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "connect-src 'self'; font-src 'self' data:; worker-src 'self'; manifest-src 'self'; object-src 'none'; " +
  "base-uri 'self'; form-action 'none'";

function cspPlugin(): Plugin {
  return {
    name: 'athleteos-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    }
  };
}

export default defineConfig({
  // Relative base so the app works from any folder, e.g. https://<user>.github.io/<repo>/athleteos/
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { chunkSizeWarningLimit: 900 },
  plugins: [
    react(),
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'AthleteOS — Football Training',
        short_name: 'AthleteOS',
        description: 'Workout tracking and progressive overload coaching for football players.',
        theme_color: '#0e1014',
        background_color: '#0e1014',
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
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
