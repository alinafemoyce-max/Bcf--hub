// Bundles the "preview" build (VITE_TARGET=artifact) into one self-contained HTML file with the CSS
// and JavaScript inlined, for hosting as a private claude.ai Artifact.
// Usage: VITE_TARGET=artifact npx vite build && node scripts/build-preview.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const dir = new URL('../dist-preview/assets/', import.meta.url);
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
if (js.length !== 1 || css.length !== 1) throw new Error(`Expected one JS and one CSS file, found ${js} / ${css}`);
const script = readFileSync(new URL(js[0], dir), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = readFileSync(new URL(css[0], dir), 'utf8').replace(/<\/style/gi, '<\\/style');
const html = `<title>BCF Hub</title>
<meta name="theme-color" content="#0a101c">
<style>${style}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
const out = new URL('../dist-preview/bcf-hub.html', import.meta.url);
writeFileSync(out, html);
console.log(`wrote dist-preview/bcf-hub.html (${(html.length / 1024).toFixed(0)} KB)`);
