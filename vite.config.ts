/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// Strict Content Security Policy for production builds: the app makes no third-party requests.
// (Not applied in dev because Vite's hot-reload injects inline scripts.)
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "connect-src 'self'; font-src 'self' data:; worker-src 'self'; manifest-src 'self'; object-src 'none'; " +
  "base-uri 'self'; form-action 'none'";

function cspPlugin(): Plugin {
  return {
    name: 'bcf-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`
      );
    }
  };
}

// Relative base so the built app works from any static path (including a sub-folder).
const ARTIFACT = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.VITE_TARGET === 'artifact';

export default defineConfig({
  base: './',
  build: ARTIFACT ? { outDir: 'dist-preview', rollupOptions: { output: { inlineDynamicImports: true } } } : {},
  plugins: [
    react(),
    ...(ARTIFACT ? [] : [cspPlugin(), VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'BCF Hub',
        short_name: 'BCF Hub',
        description: 'Personal apprentice representative workspace (prototype — not an official Sunseeker system).',
        theme_color: '#0b1220',
        background_color: '#0b1220',
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
        // Everything is bundled locally; no runtime caching of third-party hosts.
        runtimeCaching: []
      }
    })])
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
