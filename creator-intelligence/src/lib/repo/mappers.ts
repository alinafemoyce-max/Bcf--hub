import type { Row } from '../db/client';
import type { AccountSnapshot, Idea, Snapshot, Video } from '../types';

export const iso = (v: unknown): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const num = (v: unknown): number | null => (v == null ? null : Number(v));
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : typeof v === 'string' ? (JSON.parse(v) as T[]) : []);
const json = (v: unknown): unknown => (typeof v === 'string' ? JSON.parse(v) : v ?? null);

export function toVideo(r: Row): Video {
  return {
    id: String(r.id),
    tiktok_video_id: (r.tiktok_video_id as string) ?? null,
    tiktok_url: (r.tiktok_url as string) ?? null,
    title: String(r.title),
    title_truncated: Boolean(r.title_truncated),
    published_at: iso(r.published_at),
    published_at_precision: r.published_at_precision as Video['published_at_precision'],
    duration_seconds: num(r.duration_seconds),
    category: (r.category as string) ?? null,
    topic: (r.topic as string) ?? null,
    hook: (r.hook as string) ?? null,
    hook_style: (r.hook_style as string) ?? null,
    caption: (r.caption as string) ?? null,
    hashtags: arr<string>(r.hashtags),
    format: (r.format as string) ?? null,
    on_camera: (r.on_camera as boolean) ?? null,
    voiceover: (r.voiceover as boolean) ?? null,
    shows_own_car: (r.shows_own_car as boolean) ?? null,
    notes: (r.notes as string) ?? null,
    thumbnail_data: (r.thumbnail_data as string) ?? null,
    record_type: r.record_type as Video['record_type'],
    source: r.source as Video['source'],
    tracking_status: r.tracking_status as Video['tracking_status'],
    created_at: iso(r.created_at)!,
    updated_at: iso(r.updated_at)!
  };
}

export function toSnapshot(r: Row): Snapshot {
  return {
    id: String(r.id),
    video_id: String(r.video_id),
    captured_at: iso(r.captured_at)!,
    captured_at_source: String(r.captured_at_source),
    source: r.source as Snapshot['source'],
    screenshot_id: (r.screenshot_id as string) ?? null,
    views: num(r.views),
    likes: num(r.likes),
    comments: num(r.comments),
    shares: num(r.shares),
    saves: num(r.saves),
    avg_watch_time_seconds: num(r.avg_watch_time_seconds),
    total_play_time_seconds: num(r.total_play_time_seconds),
    completion_rate: num(r.completion_rate),
    new_followers: num(r.new_followers),
    traffic_sources: (json(r.traffic_sources) as Snapshot['traffic_sources']) ?? null,
    retention: json(r.retention),
    approximate_fields: arr<string>(r.approximate_fields),
    completeness: r.completeness as Snapshot['completeness'],
    notes: (r.notes as string) ?? null,
    created_at: iso(r.created_at)!
  };
}

export function toAccountSnapshot(r: Row): AccountSnapshot {
  return {
    id: String(r.id),
    captured_at: iso(r.captured_at)!,
    source: r.source as AccountSnapshot['source'],
    screenshot_id: (r.screenshot_id as string) ?? null,
    followers: num(r.followers),
    total_likes: num(r.total_likes),
    period_label: (r.period_label as string) ?? null,
    period_days: num(r.period_days),
    period_views: num(r.period_views),
    period_profile_views: num(r.period_profile_views),
    period_likes: num(r.period_likes),
    period_comments: num(r.period_comments),
    period_shares: num(r.period_shares),
    period_followers_change: num(r.period_followers_change),
    approximate_fields: arr<string>(r.approximate_fields),
    notes: (r.notes as string) ?? null,
    created_at: iso(r.created_at)!
  };
}

export function toIdea(r: Row): Idea {
  return {
    id: String(r.id),
    title: String(r.title),
    hook: (r.hook as string) ?? null,
    concept: (r.concept as string) ?? null,
    notes: (r.notes as string) ?? null,
    status: r.status as Idea['status'],
    rejection_reason: (r.rejection_reason as string) ?? null,
    video_id: (r.video_id as string) ?? null,
    source: r.source as Idea['source'],
    created_at: iso(r.created_at)!,
    updated_at: iso(r.updated_at)!
  };
}
