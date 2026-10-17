// Shared domain types (used by server code and client components).

export type RecordType = 'historical_basic' | 'tracked';
export type VideoSource = 'manual' | 'screenshot_import' | 'tiktok_api';
export type TrackingStatus = 'active' | 'archived';
export type PublishedPrecision = 'datetime' | 'date' | 'unknown';
export type ScreenshotKind = 'video_list' | 'video_analytics' | 'account_overview';
export type ScreenshotStatus = 'uploaded' | 'extracted' | 'failed' | 'confirmed';
export type ObservedSource = 'file_metadata' | 'visible_on_screen' | 'user' | 'upload_time';
export type SnapshotSource = 'manual' | 'screenshot' | 'tiktok_api';
export type IdeaStatus = 'new' | 'planned' | 'filmed' | 'edited' | 'published' | 'evaluated' | 'rejected';

export const METRIC_KEYS = ['views', 'likes', 'comments', 'shares', 'saves'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export interface Video {
  id: string;
  tiktok_video_id: string | null;
  tiktok_url: string | null;
  title: string;
  title_truncated: boolean;
  published_at: string | null;
  published_at_precision: PublishedPrecision;
  duration_seconds: number | null;
  category: string | null;
  topic: string | null;
  hook: string | null;
  hook_style: string | null;
  caption: string | null;
  hashtags: string[];
  format: string | null;
  on_camera: boolean | null;
  voiceover: boolean | null;
  shows_own_car: boolean | null;
  notes: string | null;
  thumbnail_data: string | null;
  record_type: RecordType;
  source: VideoSource;
  tracking_status: TrackingStatus;
  created_at: string;
  updated_at: string;
}

export interface TrafficSource {
  source: string;
  percent: number;
}

export interface Snapshot {
  id: string;
  video_id: string;
  captured_at: string;
  captured_at_source: string;
  source: SnapshotSource;
  screenshot_id: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  avg_watch_time_seconds: number | null;
  total_play_time_seconds: number | null;
  completion_rate: number | null;
  new_followers: number | null;
  traffic_sources: TrafficSource[] | null;
  retention: unknown;
  approximate_fields: string[];
  completeness: 'basic' | 'detailed';
  notes: string | null;
  created_at: string;
}

export interface AccountSnapshot {
  id: string;
  captured_at: string;
  source: SnapshotSource;
  screenshot_id: string | null;
  followers: number | null;
  total_likes: number | null;
  period_label: string | null;
  period_days: number | null;
  period_views: number | null;
  period_profile_views: number | null;
  period_likes: number | null;
  period_comments: number | null;
  period_shares: number | null;
  period_followers_change: number | null;
  approximate_fields: string[];
  notes: string | null;
  created_at: string;
}

export interface Idea {
  id: string;
  title: string;
  hook: string | null;
  concept: string | null;
  notes: string | null;
  status: IdeaStatus;
  rejection_reason: string | null;
  video_id: string | null;
  source: 'manual' | 'ai';
  created_at: string;
  updated_at: string;
}

/** Lightweight video record used for duplicate matching in the import review screen. */
export interface MatchCandidate {
  id: string;
  title: string;
  title_truncated: boolean;
  tiktok_video_id: string | null;
  published_at: string | null;
  published_at_precision: PublishedPrecision;
  latest_views: number | null;
  latest_captured_at: string | null;
  thumbnail_data: string | null;
}

export const CATEGORIES = [
  'First-car advice',
  'Used-car recommendations',
  'Reviews & comparisons',
  'Opinions & hot takes',
  'Ownership experiences',
  'POV / cinematic driving',
  'Entertainment',
  'Other'
] as const;

export const FORMATS = [
  'Talking to camera',
  'Voiceover + footage',
  'POV driving',
  'Cinematic edit',
  'Green screen',
  'Text on screen / slideshow',
  'Skit',
  'Other'
] as const;

export const HOOK_STYLES = [
  'Question',
  'Bold claim',
  'Controversial take',
  'Number / list',
  'Story',
  'Problem / warning',
  'POV / visual',
  'Other'
] as const;

export const IDEA_STATUSES: IdeaStatus[] = ['new', 'planned', 'filmed', 'edited', 'published', 'evaluated', 'rejected'];
