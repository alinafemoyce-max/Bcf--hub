// What the vision model returns for a screenshot. Every value is the text exactly as shown on
// screen (for example "12.3K" or "3d ago"), or null when it is not visible. Conversion to numbers
// and dates happens deterministically in src/lib/parse.ts.
import { z } from 'zod';

const visible = z.string().nullable();

export const thumbnailBoxSchema = z.object({
  x: z.number().describe('Left edge as a fraction of image width (0-1)'),
  y: z.number().describe('Top edge as a fraction of image height (0-1)'),
  width: z.number().describe('Width as a fraction of image width (0-1)'),
  height: z.number().describe('Height as a fraction of image height (0-1)')
});

export const extractedVideoSchema = z.object({
  title_text: visible.describe('Caption/title text exactly as visible, without adding missing words'),
  title_truncated: z.boolean().describe('True if the text ends with an ellipsis or is visibly cut off'),
  published_text: visible.describe('Post date/time exactly as shown, e.g. "3d ago", "Oct 12", "12/10/2025"'),
  views_text: visible,
  likes_text: visible,
  comments_text: visible,
  shares_text: visible,
  saves_text: visible,
  duration_text: visible.describe('Video length if shown on the thumbnail, e.g. "0:45"'),
  tiktok_url_or_id: visible.describe('Only if a TikTok link or numeric video ID is visibly printed'),
  thumbnail_box: thumbnailBoxSchema.nullable().describe('Approximate box around this video\'s thumbnail image, if one is visible'),
  partially_visible: z.boolean().describe('True if the row is cut off by the top or bottom of the screenshot'),
  uncertain_fields: z.array(z.string()).describe('Names of fields above that were hard to read'),
  notes: visible
});

export const extractedDetailSchema = z.object({
  avg_watch_time_text: visible,
  total_play_time_text: visible,
  full_watch_rate_text: visible.describe('"Watched full video" percentage'),
  new_followers_text: visible,
  traffic_sources: z.array(z.object({ source: z.string(), percent_text: z.string() })),
  retention_notes: visible.describe('Any retention information that is printed as text (e.g. "Most viewers stopped watching at 0:04")'),
  other_metrics: z.array(z.object({ label: z.string(), value_text: z.string() }))
});

export const extractedAccountSchema = z.object({
  followers_text: visible,
  total_likes_text: visible,
  period_label: visible.describe('Date range label shown, e.g. "Last 7 days" or "1 Oct - 7 Oct"'),
  period_views_text: visible.describe('Post/video views for the shown period'),
  period_profile_views_text: visible,
  period_likes_text: visible,
  period_comments_text: visible,
  period_shares_text: visible,
  period_followers_change_text: visible.describe('Net follower change for the period, with sign, e.g. "+120"')
});

export const extractionSchema = z.object({
  is_tiktok_screen: z.boolean(),
  screen_description: z.string().describe('One short sentence describing which TikTok screen this is'),
  observed_date_text: visible.describe('Any date printed on screen that says when the data is from, e.g. "Updated Oct 16". Not the post date.'),
  videos: z.array(extractedVideoSchema),
  video_detail: extractedDetailSchema.nullable(),
  account: extractedAccountSchema.nullable(),
  warnings: z.array(z.string())
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedVideo = z.infer<typeof extractedVideoSchema>;
export type ExtractedDetail = z.infer<typeof extractedDetailSchema>;
export type ExtractedAccount = z.infer<typeof extractedAccountSchema>;
