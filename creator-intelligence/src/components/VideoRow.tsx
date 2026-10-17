import Link from 'next/link';
import { compact, published } from '@/lib/format';
import type { Video } from '@/lib/types';
import { Badge, Thumb } from './ui';

export function VideoRow({
  video,
  views,
  viewsApproximate,
  right,
  meta
}: {
  video: Video;
  views: number | null;
  viewsApproximate?: boolean;
  right?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <Link href={`/videos/${video.id}`} className="flex items-center gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-surface-2">
      <Thumb src={video.thumbnail_data} alt="" size={38} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[14px] leading-snug font-medium text-ink">
          {video.title}
          {video.title_truncated && <span className="text-ink-3">…</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
          <span>{published(video.published_at, video.published_at_precision)}</span>
          {video.category && <span className="truncate">· {video.category}</span>}
          {video.record_type === 'historical_basic' && <Badge>Historical</Badge>}
          {meta}
        </div>
      </div>
      {right ?? (
        <div className="tnum shrink-0 text-right text-[15px] font-semibold text-ink">
          {views == null ? <span className="text-ink-3">—</span> : `${viewsApproximate ? '≈' : ''}${compact(views)}`}
          <div className="text-[11px] font-normal text-ink-3">views</div>
        </div>
      )}
    </Link>
  );
}
