// Database migrations. Each entry runs once, in order, inside a transaction, and is recorded in
// schema_migrations. Never edit a migration that has shipped: add a new one instead.
// The SQL lives in TypeScript (not .sql files) so it is bundled into serverless functions.

export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '001_initial',
    sql: `
-- Videos: one row per published TikTok. Video-level facts only; metrics live in video_snapshots.
create table videos (
  id uuid primary key default gen_random_uuid(),
  tiktok_video_id text unique,                         -- numeric id from a TikTok URL, when known
  tiktok_url text,
  title text not null,                                 -- the visible title / caption text
  title_truncated boolean not null default false,      -- the title was cut off where it was captured
  published_at timestamptz,
  published_at_precision text not null default 'unknown'
    check (published_at_precision in ('datetime', 'date', 'unknown')),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  category text,
  topic text,
  hook text,
  hook_style text,
  caption text,
  hashtags jsonb not null default '[]'::jsonb,
  format text,
  on_camera boolean,
  voiceover boolean,
  shows_own_car boolean,
  notes text,
  thumbnail_data text,                                 -- small JPEG data URL cropped from a screenshot (optional)
  record_type text not null check (record_type in ('historical_basic', 'tracked')),
  source text not null default 'manual' check (source in ('manual', 'screenshot_import', 'tiktok_api')),
  tracking_status text not null default 'active' check (tracking_status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index videos_published_at_idx on videos (published_at);

-- Uploaded screenshots. The image itself is only kept while it is being reviewed (unless the
-- user chooses to keep images); the hash, extraction result and provenance are kept.
create table screenshots (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null unique,
  kind text not null check (kind in ('video_list', 'video_analytics', 'account_overview')),
  original_filename text,
  mime_type text not null,
  width integer,
  height integer,
  byte_size integer not null,
  image_data bytea,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'extracted', 'failed', 'confirmed')),
  extraction jsonb,
  extraction_model text,
  extraction_error text,
  content_fingerprint text,
  target_video_id uuid references videos (id) on delete set null,
  observed_at timestamptz,
  observed_at_source text check (observed_at_source in ('file_metadata', 'visible_on_screen', 'user', 'upload_time')),
  uploaded_at timestamptz not null default now(),
  extracted_at timestamptz,
  confirmed_at timestamptz,
  result_summary jsonb
);
create index screenshots_fingerprint_idx on screenshots (content_fingerprint);

-- Dated metric observations of one video. Never overwritten: each observation is a new row.
create table video_snapshots (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos (id) on delete cascade,
  captured_at timestamptz not null,
  captured_at_source text not null default 'user'
    check (captured_at_source in ('file_metadata', 'visible_on_screen', 'user', 'upload_time', 'api')),
  source text not null check (source in ('manual', 'screenshot', 'tiktok_api')),
  screenshot_id uuid references screenshots (id) on delete cascade,
  views bigint check (views is null or views >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  shares bigint check (shares is null or shares >= 0),
  saves bigint check (saves is null or saves >= 0),
  avg_watch_time_seconds numeric check (avg_watch_time_seconds is null or avg_watch_time_seconds >= 0),
  total_play_time_seconds numeric check (total_play_time_seconds is null or total_play_time_seconds >= 0),
  completion_rate numeric check (completion_rate is null or (completion_rate >= 0 and completion_rate <= 100)),
  new_followers integer,
  traffic_sources jsonb,                               -- [{ source, percent }]
  retention jsonb,                                     -- free-form retention notes / points where visible
  approximate_fields jsonb not null default '[]'::jsonb, -- e.g. ["views"] when the value was shown as 12.3K
  completeness text not null default 'basic' check (completeness in ('basic', 'detailed')),
  notes text,
  created_at timestamptz not null default now(),
  unique (video_id, screenshot_id)
);
create index video_snapshots_video_idx on video_snapshots (video_id, captured_at);

-- Account-level observations (followers, and period totals shown by TikTok Studio).
create table account_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null,
  source text not null check (source in ('manual', 'screenshot', 'tiktok_api')),
  screenshot_id uuid references screenshots (id) on delete cascade,
  followers integer check (followers is null or followers >= 0),
  total_likes bigint,
  period_label text,                                   -- e.g. "Last 7 days" as shown by TikTok
  period_days integer,
  period_views bigint,
  period_profile_views bigint,
  period_likes bigint,
  period_comments bigint,
  period_shares bigint,
  period_followers_change integer,
  approximate_fields jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index account_snapshots_captured_idx on account_snapshots (captured_at);

-- Content ideas backlog.
create table ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  hook text,
  concept text,
  notes text,
  status text not null default 'new'
    check (status in ('new', 'planned', 'filmed', 'edited', 'published', 'evaluated', 'rejected')),
  rejection_reason text,
  video_id uuid references videos (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Every AI request, for usage limits and cost visibility.
create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feature text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  ok boolean not null,
  error text
);
create index ai_usage_created_idx on ai_usage (created_at);

create table login_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip text,
  success boolean not null
);
create index login_attempts_created_idx on login_attempts (created_at);
`
  }
];
