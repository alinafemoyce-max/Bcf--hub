// Input validation for every write API. Shared by route handlers and tests.
import { z } from 'zod';
import { IDEA_STATUSES } from './types';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .optional();

const count = z.number().int().min(0).max(1e12).nullable().optional();
const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
  .refine((s) => Date.parse(s) <= Date.now() + 36 * 3_600_000, 'Date is in the future');

export const precisionSchema = z.enum(['datetime', 'date', 'unknown']);

export const videoInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  title_truncated: z.boolean().optional(),
  tiktok_url: text(500),
  published_at: isoDate.nullable().optional(),
  published_at_precision: precisionSchema.optional(),
  duration_seconds: z.number().int().min(0).max(36000).nullable().optional(),
  category: text(80),
  topic: text(200),
  hook: text(500),
  hook_style: text(80),
  caption: text(4000),
  hashtags: z.array(z.string().trim().min(1).max(100)).max(60).optional(),
  format: text(80),
  on_camera: z.boolean().nullable().optional(),
  voiceover: z.boolean().nullable().optional(),
  shows_own_car: z.boolean().nullable().optional(),
  notes: text(4000),
  record_type: z.enum(['historical_basic', 'tracked']).optional(),
  tracking_status: z.enum(['active', 'archived']).optional()
});
export type VideoInput = z.infer<typeof videoInputSchema>;
export const videoPatchSchema = videoInputSchema.partial();

const trafficSourceSchema = z.object({ source: z.string().trim().min(1).max(80), percent: z.number().min(0).max(100) });

export const snapshotInputSchema = z
  .object({
    captured_at: isoDate,
    captured_at_source: z.enum(['file_metadata', 'visible_on_screen', 'user', 'upload_time']).optional(),
    views: count,
    likes: count,
    comments: count,
    shares: count,
    saves: count,
    avg_watch_time_seconds: z.number().min(0).max(36000).nullable().optional(),
    total_play_time_seconds: z.number().min(0).max(1e12).nullable().optional(),
    completion_rate: z.number().min(0).max(100).nullable().optional(),
    new_followers: z.number().int().min(-1e9).max(1e9).nullable().optional(),
    traffic_sources: z.array(trafficSourceSchema).max(20).nullable().optional(),
    retention: z.string().trim().max(2000).nullable().optional(),
    approximate_fields: z.array(z.string().max(40)).max(20).optional(),
    notes: text(2000)
  })
  .refine(
    (s) =>
      [s.views, s.likes, s.comments, s.shares, s.saves, s.avg_watch_time_seconds, s.total_play_time_seconds, s.completion_rate, s.new_followers].some(
        (v) => v != null
      ) || (s.traffic_sources?.length ?? 0) > 0,
    'Enter at least one metric'
  );
export type SnapshotInput = z.infer<typeof snapshotInputSchema>;

export const accountSnapshotInputSchema = z
  .object({
    captured_at: isoDate,
    followers: z.number().int().min(0).max(1e10).nullable().optional(),
    total_likes: count,
    period_label: text(80),
    period_days: z.number().int().min(1).max(366).nullable().optional(),
    period_views: count,
    period_profile_views: count,
    period_likes: count,
    period_comments: count,
    period_shares: count,
    period_followers_change: z.number().int().min(-1e9).max(1e9).nullable().optional(),
    approximate_fields: z.array(z.string().max(40)).max(20).optional(),
    notes: text(2000)
  })
  .refine((s) => s.followers != null || s.period_views != null || s.total_likes != null || s.period_followers_change != null, 'Enter at least one value');
export type AccountSnapshotInput = z.infer<typeof accountSnapshotInputSchema>;

const thumbnailSchema = z
  .string()
  .max(60_000)
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, 'Thumbnail must be a JPEG data URL')
  .nullable()
  .optional();

export const confirmEntrySchema = z.object({
  include: z.boolean(),
  action: z.enum(['create', 'match']),
  video_id: z.string().uuid().nullable().optional(),
  /** The user explicitly chose to create a new record despite a suggested match. */
  confirmed_new: z.boolean().optional(),
  title: z.string().trim().max(500),
  title_truncated: z.boolean(),
  tiktok_url: text(500),
  published_at: isoDate.nullable(),
  published_at_precision: precisionSchema,
  duration_seconds: z.number().int().min(0).max(36000).nullable().optional(),
  views: count,
  likes: count,
  comments: count,
  shares: count,
  saves: count,
  approximate_fields: z.array(z.string().max(40)).max(20),
  thumbnail_data: thumbnailSchema
});
export type ConfirmEntry = z.infer<typeof confirmEntrySchema>;

export const confirmDetailSchema = z.object({
  avg_watch_time_seconds: z.number().min(0).max(36000).nullable(),
  total_play_time_seconds: z.number().min(0).max(1e12).nullable(),
  completion_rate: z.number().min(0).max(100).nullable(),
  new_followers: z.number().int().min(-1e9).max(1e9).nullable(),
  traffic_sources: z.array(trafficSourceSchema).max(20),
  retention: z.string().trim().max(2000).nullable()
});

export const confirmPayloadSchema = z.object({
  observed_at: isoDate,
  observed_at_source: z.enum(['file_metadata', 'visible_on_screen', 'user', 'upload_time']),
  entries: z.array(confirmEntrySchema).max(60),
  detail: confirmDetailSchema.nullable().optional(),
  account: accountSnapshotInputSchema.nullable().optional()
});
export type ConfirmPayload = z.infer<typeof confirmPayloadSchema>;

export const ideaInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  hook: text(500),
  concept: text(4000),
  notes: text(4000),
  status: z.enum(IDEA_STATUSES as [string, ...string[]]).optional(),
  rejection_reason: text(1000),
  video_id: z.string().uuid().nullable().optional()
});
export const ideaPatchSchema = ideaInputSchema.partial();

/** Formats the first zod issue as a readable message. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid input';
  const path = issue.path.join('.');
  return path ? `${path.replace(/_/g, ' ')}: ${issue.message}` : issue.message;
}
