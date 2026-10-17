// Copies the free on-device text-recognition engine (Tesseract) into public/ocr so the app serves
// it itself instead of loading it from a third-party CDN. Runs automatically before dev and build.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public', 'ocr');
const tesseractDir = path.dirname(require.resolve('tesseract.js/package.json'));
const coreDir = path.dirname(require.resolve('tesseract.js-core/package.json'));
const langDir = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');

mkdirSync(path.join(out, 'core'), { recursive: true });
mkdirSync(path.join(out, 'lang'), { recursive: true });
copyFileSync(path.join(tesseractDir, 'dist', 'worker.min.js'), path.join(out, 'worker.min.js'));
// The app always uses the LSTM engine, so only the three LSTM builds are needed
// (the browser picks one based on its WebAssembly SIMD support).
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  copyFileSync(path.join(coreDir, f), path.join(out, 'core', f));
}
copyFileSync(path.join(langDir, 'eng.traineddata.gz'), path.join(out, 'lang', 'eng.traineddata.gz'));
console.log('OCR assets copied to public/ocr');
