import type { Db } from '../db/client';
import { ConflictError, NotFoundError, UserError } from '../errors';
import { parseTikTokVideoId } from '../parse';
import type { MatchCandidate, Snapshot, Video } from '../types';
import type { SnapshotInput, VideoInput } from '../validation';
import { iso, toSnapshot, toVideo } from './mappers';

const VIDEO_COLUMNS = [
  'title',
  'title_truncated',
  'tiktok_url',
  'tiktok_video_id',
  'published_at',
  'published_at_precision',
  'duration_seconds',
  'category',
  'topic',
  'hook',
  'hook_style',
  'caption',
  'hashtags',
  'format',
  'on_camera',
  'voiceover',
  'shows_own_car',
  'notes',
  'record_type',
  'tracking_status',
  'thumbnail_data',
  'source'
] as const;
type VideoColumn = (typeof VIDEO_COLUMNS)[number];

function columnValues(raw: Partial<VideoInput> & { thumbnail_data?: string | null; source?: string }) {
  // Keys explicitly set to undefined are treated as "not provided".
  const input = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)) as typeof raw;
  const values: Partial<Record<VideoColumn, unknown>> = {};
  for (const col of VIDEO_COLUMNS) {
    if (col === 'tiktok_video_id') continue;
    if (col in input) values[col] = (input as Record<string, unknown>)[col];
  }
  if ('tiktok_url' in input) {
    values.tiktok_video_id = parseTikTokVideoId(input.tiktok_url ?? null);
    if (input.tiktok_url && !values.tiktok_video_id) {
      throw new UserError('That TikTok link does not contain a video ID. Paste the full link, e.g. https://www.tiktok.com/@you/video/123…');
    }
  }
  if ('hashtags' in input) values.hashtags = JSON.stringify(normaliseHashtags(input.hashtags ?? []));
  if ('published_at' in input && !input.published_at) values.published_at_precision = 'unknown';
  else if ('published_at' in input && !('published_at_precision' in input)) values.published_at_precision = 'datetime';
  return values;
}

export function normaliseHashtags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    for (const part of t.split(/[\s,]+/)) {
      const clean = part.replace(/^#+/, '').trim().toLowerCase();
      if (clean) out.add(clean);
    }
  }
  return [...out];
}

async function assertUniqueTikTokId(db: Db, tiktokId: unknown, exceptId?: string) {
  if (!tiktokId) return;
  const rows = await db.query<{ id: string; title: string }>('select id, title from videos where tiktok_video_id = $1', [tiktokId]);
  const other = rows.find((r) => r.id !== exceptId);
  if (other) throw new ConflictError(`A video with this TikTok link already exists: “${other.title}”.`, { videoId: other.id });
}

export async function createVideo(
  db: Db,
  input: VideoInput & { thumbnail_data?: string | null; source?: Video['source'] }
): Promise<Video> {
  const values = columnValues({ record_type: 'tracked', ...input });
  await assertUniqueTikTokId(db, values.tiktok_video_id);
  const cols = Object.keys(values) as VideoColumn[];
  const placeholders = cols.map((c, i) => (c === 'hashtags' ? `$${i + 1}::jsonb` : `$${i + 1}`));
  const rows = await db.query(
    `insert into videos (${cols.join(', ')}) values (${placeholders.join(', ')}) returning *`,
    cols.map((c) => values[c])
  );
  return toVideo(rows[0]);
}

export async function updateVideo(db: Db, id: string, patch: Partial<VideoInput> & { thumbnail_data?: string | null }): Promise<Video> {
  const values = columnValues(patch);
  if ('tiktok_video_id' in values) await assertUniqueTikTokId(db, values.tiktok_video_id, id);
  const cols = Object.keys(values) as VideoColumn[];
  if (!cols.length) return getVideoOrThrow(db, id);
  const sets = cols.map((c, i) => `${c} = $${i + 2}${c === 'hashtags' ? '::jsonb' : ''}`);
  const rows = await db.query(`update videos set ${sets.join(', ')}, updated_at = now() where id = $1 returning *`, [
    id,
    ...cols.map((c) => values[c])
  ]);
  if (!rows[0]) throw new NotFoundError('Video');
  return toVideo(rows[0]);
}

export async function getVideo(db: Db, id: string): Promise<Video | null> {
  if (!isUuid(id)) return null;
  const rows = await db.query('select * from videos where id = $1', [id]);
  return rows[0] ? toVideo(rows[0]) : null;
}

export async function getVideoOrThrow(db: Db, id: string): Promise<Video> {
  const v = await getVideo(db, id);
  if (!v) throw new NotFoundError('Video');
  return v;
}

export async function deleteVideo(db: Db, id: string): Promise<void> {
  const rows = await db.query('delete from videos where id = $1 returning id', [id]);
  if (!rows[0]) throw new NotFoundError('Video');
}

export async function listVideos(db: Db): Promise<Video[]> {
  const rows = await db.query('select * from videos order by published_at desc nulls last, created_at desc');
  return rows.map(toVideo);
}

export async function listSnapshots(db: Db, videoId?: string): Promise<Snapshot[]> {
  const rows = videoId
    ? await db.query('select * from video_snapshots where video_id = $1 order by captured_at asc', [videoId])
    : await db.query('select * from video_snapshots order by captured_at asc');
  return rows.map(toSnapshot);
}

const SNAPSHOT_METRICS = ['views', 'likes', 'comments', 'shares', 'saves', 'avg_watch_time_seconds', 'total_play_time_seconds', 'completion_rate', 'new_followers'] as const;

/**
 * Two snapshots of the same video are duplicates when they were captured within 6 hours of each
 * other and every metric present in both is identical (for example, overlapping list screenshots).
 */
export function isDuplicateSnapshot(existing: Snapshot, input: Partial<Record<(typeof SNAPSHOT_METRICS)[number], number | null | undefined>> & { captured_at: string }) {
  const dt = Math.abs(new Date(existing.captured_at).getTime() - new Date(input.captured_at).getTime());
  if (dt > 6 * 3_600_000) return false;
  let shared = 0;
  for (const k of SNAPSHOT_METRICS) {
    const a = existing[k];
    const b = input[k];
    if (a == null || b == null) continue;
    if (Number(a) !== Number(b)) return false;
    shared++;
  }
  return shared > 0;
}

export interface AddSnapshotResult {
  snapshot: Snapshot | null;
  duplicateOf: Snapshot | null;
}

export async function addSnapshot(
  db: Db,
  videoId: string,
  input: SnapshotInput & { source?: Snapshot['source']; screenshot_id?: string | null },
  options: { skipDuplicates?: boolean } = {}
): Promise<AddSnapshotResult> {
  await getVideoOrThrow(db, videoId);
  const existing = await listSnapshots(db, videoId);
  const dup = existing.find((s) => isDuplicateSnapshot(s, input));
  if (dup && options.skipDuplicates !== false) return { snapshot: null, duplicateOf: dup };
  const detailed = input.avg_watch_time_seconds != null || input.completion_rate != null || (input.traffic_sources?.length ?? 0) > 0;
  const rows = await db.query(
    `insert into video_snapshots (video_id, captured_at, captured_at_source, source, screenshot_id, views, likes, comments, shares, saves,
       avg_watch_time_seconds, total_play_time_seconds, completion_rate, new_followers, traffic_sources, retention, approximate_fields, completeness, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18,$19) returning *`,
    [
      videoId,
      input.captured_at,
      input.captured_at_source ?? 'user',
      input.source ?? 'manual',
      input.screenshot_id ?? null,
      input.views ?? null,
      input.likes ?? null,
      input.comments ?? null,
      input.shares ?? null,
      input.saves ?? null,
      input.avg_watch_time_seconds ?? null,
      input.total_play_time_seconds ?? null,
      input.completion_rate ?? null,
      input.new_followers ?? null,
      input.traffic_sources?.length ? JSON.stringify(input.traffic_sources) : null,
      input.retention ? JSON.stringify({ notes: input.retention }) : null,
      JSON.stringify(input.approximate_fields ?? []),
      detailed ? 'detailed' : 'basic',
      input.notes ?? null
    ]
  );
  return { snapshot: toSnapshot(rows[0]), duplicateOf: null };
}

export async function deleteSnapshot(db: Db, snapshotId: string): Promise<void> {
  if (!isUuid(snapshotId)) throw new NotFoundError('Snapshot');
  const rows = await db.query('delete from video_snapshots where id = $1 returning id', [snapshotId]);
  if (!rows[0]) throw new NotFoundError('Snapshot');
}

/** Lightweight list of all videos with their latest views, for duplicate matching during imports. */
export async function listMatchCandidates(db: Db): Promise<MatchCandidate[]> {
  const rows = await db.query(
    `select v.id, v.title, v.title_truncated, v.tiktok_video_id, v.published_at, v.published_at_precision, v.thumbnail_data,
            s.views as latest_views, s.captured_at as latest_captured_at
       from videos v
       left join lateral (
         select views, captured_at from video_snapshots
          where video_id = v.id and views is not null
          order by captured_at desc limit 1
       ) s on true`
  );
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    title_truncated: Boolean(r.title_truncated),
    tiktok_video_id: (r.tiktok_video_id as string) ?? null,
    published_at: iso(r.published_at),
    published_at_precision: r.published_at_precision as MatchCandidate['published_at_precision'],
    latest_views: r.latest_views == null ? null : Number(r.latest_views),
    latest_captured_at: iso(r.latest_captured_at),
    thumbnail_data: (r.thumbnail_data as string) ?? null
  }));
}

export function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
