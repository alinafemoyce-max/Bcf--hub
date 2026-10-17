// Free, on-device text recognition (Tesseract, self-hosted under /ocr). Browser only.
// The screenshot never leaves the phone for this step; only the recognised text is saved.
import type { Worker } from 'tesseract.js';
import type { OcrLine } from './ocr-parse';

const STATUS: Record<string, string> = {
  'loading tesseract core': 'Downloading the reader (first time only)',
  'initializing tesseract': 'Starting the reader',
  'loading language traineddata': 'Downloading the English text model (first time only)',
  'initializing api': 'Starting the reader',
  'recognizing text': 'Reading text'
};

/** Friendly progress text for the reader's status messages. */
export function ocrStatusLabel(status: string, progress: number) {
  const pct = progress > 0 && progress < 1 ? ` ${Math.round(progress * 100)}%` : '';
  return `${STATUS[status] ?? 'Working'}${pct}`;
}

let workerPromise: Promise<Worker> | null = null;
let progressListener: ((status: string, progress: number) => void) | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import('tesseract.js');
      return createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/core',
        langPath: '/ocr/lang',
        gzip: true,
        // Language data is cached in the browser after the first download (~3 MB).
        cacheMethod: 'write',
        logger: (m) => progressListener?.(m.status, m.progress)
      });
    })().catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

/** Scales small images up (OCR reads small text badly) and returns a canvas for recognition. */
async function toCanvas(image: Blob): Promise<{ canvas: HTMLCanvasElement; width: number; height: number; scale: number }> {
  const bmp = await createImageBitmap(image);
  const scale = bmp.width < 1000 ? 2 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width * scale;
  canvas.height = bmp.height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not available in this browser.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return { canvas, width: canvas.width, height: canvas.height, scale };
}

export interface OcrResult {
  lines: OcrLine[];
  width: number;
  height: number;
}

/** Recognises text lines in an image. The first run downloads the engine (~7 MB, then cached). */
export async function recognizeImage(image: Blob, onProgress?: (status: string, progress: number) => void): Promise<OcrResult> {
  progressListener = onProgress ?? null;
  try {
    const worker = await getWorker();
    const { canvas, width, height } = await toCanvas(image);
    const { data } = await worker.recognize(canvas, {}, { blocks: true, text: true });
    const lines: OcrLine[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          const text = line.text.replace(/\s+/g, ' ').trim();
          if (text) lines.push({ text, ...line.bbox, confidence: line.confidence });
        }
      }
    }
    return { lines, width, height };
  } catch (error) {
    throw new Error(`On-phone text reading failed: ${(error as Error).message || 'unknown error'}. You can still enter the values by hand.`);
  } finally {
    progressListener = null;
  }
}
