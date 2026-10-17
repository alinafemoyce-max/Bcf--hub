import Anthropic from '@anthropic-ai/sdk';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/lib/db/client';
import { sanitiseExtraction } from '../src/lib/extraction/extract';
import type { Extraction } from '../src/lib/extraction/schema';
import { runExtraction, type ExtractionDeps } from '../src/lib/extraction/service';
import { createScreenshot, getScreenshot } from '../src/lib/repo/screenshots';
import { listVideos } from '../src/lib/repo/videos';
import { testDb } from './helpers/db';

const png = (tag: string) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new TextEncoder().encode(tag)]);

const sample: Extraction = {
  is_tiktok_screen: true,
  screen_description: 'TikTok Studio posts list',
  observed_date_text: null,
  videos: [
    {
      title_text: 'Is 85 horsepower enough for…',
      title_truncated: true,
      published_text: ' Oct 12 ',
      views_text: '12.3K',
      likes_text: null,
      comments_text: null,
      shares_text: null,
      saves_text: null,
      duration_text: null,
      tiktok_url_or_id: null,
      thumbnail_box: { x: 0.9, y: 0.1, width: 0.5, height: 0.1 },
      partially_visible: false,
      uncertain_fields: [],
      notes: null
    }
  ],
  video_detail: null,
  account: null,
  warnings: []
};

/** A stand-in for the Anthropic client: only the method the app calls. Used in tests only. */
function mockClient(impl: (params: Record<string, unknown>) => unknown) {
  const parse = vi.fn(async (params: Record<string, unknown>) => impl(params));
  return { client: { beta: { messages: { parse } } } as unknown as Pick<Anthropic, 'beta'>, parse };
}

function deps(client: Pick<Anthropic, 'beta'>, usage: unknown[] = []): ExtractionDeps {
  return {
    client,
    model: 'claude-opus-5-5',
    checkRateLimit: async () => {},
    recordUsage: async (_db, entry) => {
      usage.push(entry);
    }
  };
}

let db: Db;
beforeAll(async () => {
  db = await testDb();
});
afterAll(async () => {
  await db.close();
});

describe('screenshot extraction', () => {
  it('sends the image to Claude with structured output and stores the result for review', async () => {
    const { client, parse } = mockClient(() => ({
      model: 'claude-opus-5-5',
      stop_reason: 'end_turn',
      usage: { input_tokens: 1800, output_tokens: 400 },
      parsed_output: sample
    }));
    const usage: unknown[] = [];
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'a.png', bytes: png('ok'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    const result = await runExtraction(db, screenshot.id, deps(client, usage));

    const params = parse.mock.calls[0][0] as Record<string, any>;
    expect(params.model).toBe('claude-opus-5-5');
    expect(params.fallbacks).toBe('default');
    expect(params.output_config.format).toBeTruthy();
    expect(params.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/png' } });

    expect(result.status).toBe('extracted');
    expect(result.extraction!.videos[0]).toMatchObject({ title_text: 'Is 85 horsepower enough for', title_truncated: true, published_text: 'Oct 12' });
    expect(result.content_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(usage).toEqual([expect.objectContaining({ ok: true, inputTokens: 1800, outputTokens: 400 })]);
    // Extraction alone never creates records: the user must confirm first.
    expect(await listVideos(db)).toEqual([]);
  });

  it('marks the screenshot as failed (and invents nothing) when Claude refuses', async () => {
    const { client } = mockClient(() => ({ model: 'claude-opus-5-5', stop_reason: 'refusal', usage: { input_tokens: 10, output_tokens: 0 }, parsed_output: null }));
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'b.png', bytes: png('refuse'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    await expect(runExtraction(db, screenshot.id, deps(client))).rejects.toThrow(/declined/);
    const after = (await getScreenshot(db, screenshot.id))!;
    expect(after.status).toBe('failed');
    expect(after.extraction).toBeNull();
    expect(after.extraction_error).toMatch(/declined/);
  });

  it('reports API errors clearly', async () => {
    const { client } = mockClient(() => {
      throw new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers());
    });
    const usage: { ok: boolean }[] = [];
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'c.png', bytes: png('auth'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    await expect(runExtraction(db, screenshot.id, deps(client, usage as unknown[]))).rejects.toThrow(/API key was rejected/);
    expect(usage[0].ok).toBe(false);
  });

  it('rejects malformed model output', async () => {
    const { client } = mockClient(() => ({ model: 'm', stop_reason: 'end_turn', usage: {}, parsed_output: { videos: 'nope' } }));
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'd.png', bytes: png('bad'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    await expect(runExtraction(db, screenshot.id, deps(client))).rejects.toThrow(/unexpected format/);
  });

  it('stops before calling the API when the usage limit is reached', async () => {
    const { client, parse } = mockClient(() => ({}));
    const { screenshot } = await createScreenshot(db, { kind: 'video_list', filename: 'e.png', bytes: png('limit'), width: 1, height: 1, observedAt: null, observedAtSource: null });
    const d = deps(client);
    d.checkRateLimit = async () => {
      throw new Error('Daily AI limit reached');
    };
    await expect(runExtraction(db, screenshot.id, d)).rejects.toThrow(/limit/);
    expect(parse).not.toHaveBeenCalled();
  });

  it('clamps thumbnail boxes to the image', () => {
    const s = sanitiseExtraction(sample);
    const box = s.videos[0].thumbnail_box!;
    expect(box.x + box.width).toBeLessThanOrEqual(1);
  });
});
