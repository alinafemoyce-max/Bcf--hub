import { createHash } from 'node:crypto';
import type { Db, Row } from '../db/client';
import { ConflictError, NotFoundError, UserError } from '../errors';
import type { Extraction } from '../extraction/schema';
import { contentFingerprint, findMatches } from '../matching';
import { parseTikTokVideoId } from '../parse';
import type { ObservedSource, ScreenshotKind, ScreenshotStatus } from '../types';
import type { ConfirmPayload } from '../validation';
import { addAccountSnapshot } from './account';
import { iso } from './mappers';
import { addSnapshot, createVideo, getVideo, isUuid, listMatchCandidates, updateVideo } from './videos';

export interface ScreenshotRecord {
  id: string;
  sha256: string;
  kind: ScreenshotKind;
  original_filename: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  byte_size: number;
  has_image: boolean;
  status: ScreenshotStatus;
  extraction: Extraction | null;
  extraction_model: string | null;
  extraction_error: string | null;
  content_fingerprint: string | null;
  target_video_id: string | null;
  observed_at: string | null;
  observed_at_source: ObservedSource | null;
  uploaded_at: string;
  extracted_at: string | null;
  confirmed_at: string | null;
  result_summary: ImportSummary | null;
}

export interface ImportSummary {
  createdVideoIds: string[];
  updatedVideoIds: string[];
  snapshotsAdded: number;
  duplicatesSkipped: number;
  accountSnapshotAdded: boolean;
}

const COLUMNS = `id, sha256, kind, original_filename, mime_type, width, height, byte_size, (image_data is not null) as has_image,
  status, extraction, extraction_model, extraction_error, content_fingerprint, target_video_id, observed_at, observed_at_source,
  uploaded_at, extracted_at, confirmed_at, result_summary`;

function toScreenshot(r: Row): ScreenshotRecord {
  const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v ?? null);
  return {
    id: String(r.id),
    sha256: String(r.sha256),
    kind: r.kind as ScreenshotKind,
    original_filename: (r.original_filename as string) ?? null,
    mime_type: String(r.mime_type),
    width: r.width == null ? null : Number(r.width),
    height: r.height == null ? null : Number(r.height),
    byte_size: Number(r.byte_size),
    has_image: Boolean(r.has_image),
    status: r.status as ScreenshotStatus,
    extraction: parse(r.extraction),
    extraction_model: (r.extraction_model as string) ?? null,
    extraction_error: (r.extraction_error as string) ?? null,
    content_fingerprint: (r.content_fingerprint as string) ?? null,
    target_video_id: (r.target_video_id as string) ?? null,
    observed_at: iso(r.observed_at),
    observed_at_source: (r.observed_at_source as ObservedSource) ?? null,
    uploaded_at: iso(r.uploaded_at)!,
    extracted_at: iso(r.extracted_at),
    confirmed_at: iso(r.confirmed_at),
    result_summary: parse(r.result_summary)
  };
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
// Vercel functions accept request bodies up to 4.5 MB; the browser resizes screenshots well below this.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Detects the real image type from its first bytes (never trust the declared MIME type alone). */
export function sniffImageType(bytes: Uint8Array): (typeof ALLOWED_IMAGE_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export function sha256Hex(data: Uint8Array | string) {
  return createHash('sha256').update(data).digest('hex');
}

export interface CreateScreenshotInput {
  /** Hash of the original file chosen by the user (computed in the browser before resizing). */
  originalSha256?: string | null;
  kind: ScreenshotKind;
  filename: string | null;
  bytes: Uint8Array;
  width: number | null;
  height: number | null;
  observedAt: string | null;
  observedAtSource: ObservedSource | null;
  targetVideoId?: string | null;
}

export async function createScreenshot(db: Db, input: CreateScreenshotInput): Promise<{ screenshot: ScreenshotRecord; duplicate: boolean }> {
  if (input.bytes.length === 0) throw new UserError('The file is empty.');
  if (input.bytes.length > MAX_IMAGE_BYTES) throw new UserError('The image is larger than 4 MB.', 413);
  const mime = sniffImageType(input.bytes);
  if (!mime) throw new UserError('Unsupported file. Upload a PNG, JPEG or WebP screenshot.', 415);
  const sha = input.originalSha256 && /^[0-9a-f]{64}$/.test(input.originalSha256) ? input.originalSha256 : sha256Hex(input.bytes);

  const existing = await db.query(`select ${COLUMNS} from screenshots where sha256 = $1`, [sha]);
  if (existing[0]) return { screenshot: toScreenshot(existing[0]), duplicate: true };

  if (input.targetVideoId && !(await getVideo(db, input.targetVideoId))) throw new NotFoundError('Video');
  const rows = await db.query(
    `insert into screenshots (sha256, kind, original_filename, mime_type, width, height, byte_size, image_data, observed_at, observed_at_source, target_video_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning ${COLUMNS}`,
    [
      sha,
      input.kind,
      input.filename?.slice(0, 200) ?? null,
      mime,
      input.width,
      input.height,
      input.bytes.length,
      Buffer.from(input.bytes),
      input.observedAt,
      input.observedAtSource,
      input.targetVideoId ?? null
    ]
  );
  return { screenshot: toScreenshot(rows[0]), duplicate: false };
}

export async function getScreenshot(db: Db, id: string): Promise<ScreenshotRecord | null> {
  if (!isUuid(id)) return null;
  const rows = await db.query(`select ${COLUMNS} from screenshots where id = $1`, [id]);
  return rows[0] ? toScreenshot(rows[0]) : null;
}

export async function getScreenshotImage(db: Db, id: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!isUuid(id)) return null;
  const rows = await db.query<{ image_data: Uint8Array | null; mime_type: string }>('select image_data, mime_type from screenshots where id = $1', [id]);
  const r = rows[0];
  if (!r?.image_data) return null;
  return { bytes: new Uint8Array(r.image_data), mime: r.mime_type };
}

export async function listScreenshots(db: Db, opts: { pendingOnly?: boolean; limit?: number } = {}): Promise<ScreenshotRecord[]> {
  const rows = await db.query(
    `select ${COLUMNS} from screenshots ${opts.pendingOnly ? "where status <> 'confirmed'" : ''} order by uploaded_at desc limit $1`,
    [opts.limit ?? 200]
  );
  return rows.map(toScreenshot);
}

export async function saveExtraction(db: Db, id: string, extraction: Extraction, model: string): Promise<ScreenshotRecord> {
  const fp = contentFingerprint(
    extraction.videos.map((v) => ({ title: v.title_text, views: v.views_text, published: v.published_text }))
  );
  const rows = await db.query(
    `update screenshots set status = 'extracted', extraction = $2::jsonb, extraction_model = $3, extraction_error = null,
            content_fingerprint = $4, extracted_at = now()
      where id = $1 and status <> 'confirmed' returning ${COLUMNS}`,
    [id, JSON.stringify(extraction), model, fp ? sha256Hex(fp) : null]
  );
  if (!rows[0]) throw new ConflictError('This screenshot has already been imported.');
  return toScreenshot(rows[0]);
}

export async function markExtractionFailed(db: Db, id: string, message: string): Promise<void> {
  await db.query(`update screenshots set status = 'failed', extraction_error = $2 where id = $1 and status <> 'confirmed'`, [id, message.slice(0, 1000)]);
}

/** Other screenshots whose extracted content is identical (same screen uploaded as a different file). */
export async function findContentDuplicates(db: Db, screenshot: ScreenshotRecord): Promise<ScreenshotRecord[]> {
  if (!screenshot.content_fingerprint) return [];
  const rows = await db.query(`select ${COLUMNS} from screenshots where content_fingerprint = $1 and id <> $2 order by uploaded_at`, [
    screenshot.content_fingerprint,
    screenshot.id
  ]);
  return rows.map(toScreenshot);
}

/**
 * Saves the reviewed entries of a screenshot: creates new videos or adds dated snapshots to
 * existing ones, records provenance, and (unless the user keeps images) deletes the image bytes.
 * Runs in one transaction, so a failure saves nothing.
 */
export async function confirmScreenshot(db: Db, id: string, payload: ConfirmPayload, opts: { keepImage: boolean }): Promise<ImportSummary> {
  return db.transaction(async (tx) => {
    const rows = await tx.query(`select ${COLUMNS} from screenshots where id = $1 for update`, [id]);
    if (!rows[0]) throw new NotFoundError('Screenshot');
    const shot = toScreenshot(rows[0]);
    if (shot.status === 'confirmed') throw new ConflictError('This screenshot has already been imported.');

    const included = payload.entries.filter((e) => e.include);
    const matchedIds = included.filter((e) => e.action === 'match').map((e) => e.video_id);
    if (matchedIds.some((v) => !v)) throw new UserError('Choose which existing video each matched entry belongs to.');
    if (new Set(matchedIds).size !== matchedIds.length) throw new UserError('Two entries are matched to the same video. Each video can only appear once per screenshot.');
    for (const e of included) {
      if (e.action === 'create' && !e.title.trim()) throw new UserError('Every new video needs a title.');
    }

    const summary: ImportSummary = { createdVideoIds: [], updatedVideoIds: [], snapshotsAdded: 0, duplicatesSkipped: 0, accountSnapshotAdded: false };
    const candidates = await listMatchCandidates(tx);
    const detail = shot.kind === 'video_analytics' ? payload.detail ?? null : null;

    for (const entry of included) {
      let videoId: string;
      if (entry.action === 'match') {
        const video = await getVideo(tx, entry.video_id!);
        if (!video) throw new NotFoundError('Matched video');
        videoId = video.id;
        // Fill gaps in the existing record without overwriting anything the user already entered.
        const patch: Record<string, unknown> = {};
        if (!video.published_at && entry.published_at) {
          patch.published_at = entry.published_at;
          patch.published_at_precision = entry.published_at_precision;
        }
        if (video.title_truncated && !entry.title_truncated && entry.title.length > video.title.length) {
          patch.title = entry.title;
          patch.title_truncated = false;
        }
        if (!video.thumbnail_data && entry.thumbnail_data) patch.thumbnail_data = entry.thumbnail_data;
        if (!video.tiktok_url && entry.tiktok_url && parseTikTokVideoId(entry.tiktok_url)) patch.tiktok_url = entry.tiktok_url;
        if (video.duration_seconds == null && entry.duration_seconds != null) patch.duration_seconds = entry.duration_seconds;
        if (Object.keys(patch).length) {
          await updateVideo(tx, video.id, patch);
          summary.updatedVideoIds.push(video.id);
        }
      } else {
        const tiktokId = parseTikTokVideoId(entry.tiktok_url ?? null);
        if (!entry.confirmed_new) {
          const strong = findMatches(
            { title: entry.title, titleTruncated: entry.title_truncated, tiktokVideoId: tiktokId, publishedAt: entry.published_at },
            candidates
          ).filter((m) => m.level !== 'possible');
          if (strong.length) {
            throw new ConflictError(`“${entry.title}” looks like an existing video (“${strong[0].candidate.title}”). Match it, or confirm it is new.`, {
              title: entry.title,
              videoId: strong[0].candidate.id
            });
          }
        }
        const video = await createVideo(tx, {
          title: entry.title,
          title_truncated: entry.title_truncated,
          tiktok_url: tiktokId ? entry.tiktok_url : null,
          published_at: entry.published_at,
          published_at_precision: entry.published_at ? entry.published_at_precision : 'unknown',
          duration_seconds: entry.duration_seconds ?? null,
          record_type: shot.kind === 'video_list' ? 'historical_basic' : 'tracked',
          thumbnail_data: entry.thumbnail_data ?? null,
          source: 'screenshot_import'
        });
        videoId = video.id;
        summary.createdVideoIds.push(video.id);
        candidates.push({ ...video, latest_views: entry.views ?? null, latest_captured_at: payload.observed_at });
      }

      const hasMetric =
        [entry.views, entry.likes, entry.comments, entry.shares, entry.saves].some((v) => v != null) ||
        (detail && [detail.avg_watch_time_seconds, detail.completion_rate, detail.total_play_time_seconds, detail.new_followers].some((v) => v != null));
      if (!hasMetric) continue;
      const result = await addSnapshot(tx, videoId, {
        captured_at: payload.observed_at,
        captured_at_source: payload.observed_at_source,
        source: 'screenshot',
        screenshot_id: shot.id,
        views: entry.views ?? null,
        likes: entry.likes ?? null,
        comments: entry.comments ?? null,
        shares: entry.shares ?? null,
        saves: entry.saves ?? null,
        avg_watch_time_seconds: detail?.avg_watch_time_seconds ?? null,
        total_play_time_seconds: detail?.total_play_time_seconds ?? null,
        completion_rate: detail?.completion_rate ?? null,
        new_followers: detail?.new_followers ?? null,
        traffic_sources: detail?.traffic_sources ?? null,
        retention: detail?.retention ?? null,
        approximate_fields: entry.approximate_fields
      });
      if (result.snapshot) summary.snapshotsAdded++;
      else summary.duplicatesSkipped++;
    }

    if (payload.account) {
      await addAccountSnapshot(tx, { ...payload.account, captured_at: payload.observed_at }, { source: 'screenshot', screenshot_id: shot.id });
      summary.accountSnapshotAdded = true;
    }

    const target = shot.kind === 'video_analytics' && included.length === 1 ? summary.createdVideoIds[0] ?? included[0].video_id ?? null : shot.target_video_id;
    await tx.query(
      `update screenshots set status = 'confirmed', confirmed_at = now(), observed_at = $2, observed_at_source = $3,
              result_summary = $4::jsonb, target_video_id = $5, image_data = case when $6::boolean then image_data else null end
        where id = $1`,
      [id, payload.observed_at, payload.observed_at_source, JSON.stringify(summary), target, opts.keepImage]
    );
    return summary;
  });
}

/**
 * Deletes a screenshot, its image and every snapshot that came from it. Optionally also deletes
 * videos that were created by this import and no longer have any other snapshots.
 */
export async function deleteScreenshot(db: Db, id: string, opts: { deleteCreatedVideos?: boolean } = {}): Promise<{ deletedVideos: number }> {
  if (!isUuid(id)) throw new NotFoundError('Screenshot');
  return db.transaction(async (tx) => {
    const rows = await tx.query(`select ${COLUMNS} from screenshots where id = $1`, [id]);
    if (!rows[0]) throw new NotFoundError('Screenshot');
    const shot = toScreenshot(rows[0]);
    await tx.query('delete from screenshots where id = $1', [id]);
    let deletedVideos = 0;
    if (opts.deleteCreatedVideos && shot.result_summary?.createdVideoIds.length) {
      for (const videoId of shot.result_summary.createdVideoIds) {
        const res = await tx.query(
          'delete from videos where id = $1 and not exists (select 1 from video_snapshots where video_id = $1) returning id',
          [videoId]
        );
        deletedVideos += res.length;
      }
    }
    return { deletedVideos };
  });
}

/** Removes stored image bytes from every screenshot (keeps extraction results and provenance). */
export async function purgeAllImages(db: Db): Promise<number> {
  const rows = await db.query("update screenshots set image_data = null where image_data is not null and status = 'confirmed' returning id");
  return rows.length;
}
