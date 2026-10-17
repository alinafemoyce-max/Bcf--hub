'use client';

import { AlertTriangle, ChevronDown, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/client';
import { compact, date, published, toLocalInput } from '@/lib/format';
import { cropThumbnail } from '@/lib/image-client';
import type { MatchResult } from '@/lib/matching';
import { localToUtc, parseCount, toLocalParts } from '@/lib/parse';
import type { ImportSummary, ScreenshotRecord } from '@/lib/repo/screenshots';
import {
  blankEntry,
  COUNT_KEYS,
  entryMatches,
  initialAccount,
  initialDetail,
  initialEntries,
  toConfirmAccount,
  toConfirmDetail,
  toConfirmEntry,
  withParsedDate,
  type AccountState,
  type DetailState,
  type ReviewEntry
} from '@/lib/review';
import type { MatchCandidate } from '@/lib/types';
import { Badge, Button, Card, cx, Field, Input, Notice, Select, Spinner, Textarea } from './ui';

const SOURCE_LABEL = { file_metadata: 'from the file’s metadata', visible_on_screen: 'shown on screen', user: 'entered by you', upload_time: 'upload time' } as const;

export function ReviewForm({
  screenshot,
  candidates,
  contentDuplicates,
  aiConfigured,
  nextId
}: {
  screenshot: ScreenshotRecord;
  candidates: MatchCandidate[];
  contentDuplicates: { id: string; uploadedAt: string; status: string }[];
  aiConfigured: boolean;
  nextId: string | null;
}) {
  const router = useRouter();
  const ex = screenshot.extraction;
  const [observed, setObserved] = useState(toLocalInput(screenshot.observed_at ?? screenshot.uploaded_at));
  const [observedSource, setObservedSource] = useState(screenshot.observed_at_source ?? 'upload_time');
  const observedDate = useMemo(() => {
    const [d, t] = observed.split('T');
    return d && t ? localToUtc(d, t) : new Date(screenshot.uploaded_at);
  }, [observed, screenshot.uploaded_at]);

  const [entries, setEntries] = useState<ReviewEntry[]>(() =>
    initialEntries({ extraction: ex, kind: screenshot.kind, observedAt: observedDate, candidates, targetVideoId: screenshot.target_video_id })
  );
  const [detail, setDetail] = useState<DetailState>(() => initialDetail(ex?.video_detail ?? null));
  const [account, setAccount] = useState<AccountState>(() => initialAccount(ex?.account ?? null));
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [showImage, setShowImage] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({});

  // Re-derive relative/yearless dates when the screenshot time changes.
  useEffect(() => {
    setEntries((list) => list.map((e) => withParsedDate(e, observedDate)));
  }, [observedDate]);

  useEffect(() => {
    if (!imgLoaded || !imgRef.current) return;
    const out: Record<string, string | null> = {};
    for (const e of entries) if (e.box) out[e.key] = cropThumbnail(imgRef.current, e.box);
    setThumbs(out);
    // Only when the image loads; boxes don't change during review.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLoaded]);

  const update = (key: string, p: Partial<ReviewEntry>) => setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...p } : e)));

  async function retryExtraction() {
    setExtracting(true);
    setError(null);
    try {
      await api(`/api/screenshots/${screenshot.id}/extract`, { method: 'POST' });
      router.refresh();
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setExtracting(false);
    }
  }

  async function save() {
    setError(null);
    const capturedAt = observedDate.toISOString();
    if (observedDate.getTime() > Date.now() + 36e5) return setError('The screenshot time is in the future.');
    const out = [];
    for (const e of entries) {
      const r = toConfirmEntry(e, thumbs[e.key] ?? null);
      if (!r.ok) return setError(r.error);
      out.push(r.entry);
    }
    const included = out.filter((e) => e.include);
    let detailPayload = null;
    if (screenshot.kind === 'video_analytics') {
      const d = toConfirmDetail(detail);
      if (!d.ok) return setError(d.error);
      detailPayload = d.detail;
    }
    let accountPayload = null;
    if (screenshot.kind === 'account_overview') {
      const a = toConfirmAccount(account, capturedAt);
      if (!a.ok) return setError(a.error);
      accountPayload = a.account;
    }
    if (!included.length && !accountPayload) return setError('Nothing to save. Include at least one entry, or discard this screenshot.');
    setBusy(true);
    try {
      const res = await api<{ summary: ImportSummary }>(`/api/screenshots/${screenshot.id}/confirm`, {
        method: 'POST',
        json: { observed_at: capturedAt, observed_at_source: observedSource, entries: out, detail: detailPayload, account: accountPayload }
      });
      setSummary(res.summary);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.details && typeof e.details === 'object') {
        const d = e.details as { title?: string; videoId?: string };
        const hit = entries.find((x) => x.title.trim() === d.title);
        if (hit) {
          update(hit.key, { decision: null, autoDecision: false });
          setConflicts((c) => ({ ...c, [hit.key]: e.message }));
        }
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (!confirm('Discard this screenshot? Nothing from it will be saved.')) return;
    await api(`/api/screenshots/${screenshot.id}`, { method: 'DELETE' }).catch(() => {});
    router.push('/import');
    router.refresh();
  }

  if (summary) {
    return (
      <Card className="animate-in border-good/30">
        <h2 className="text-[17px] font-semibold">Saved</h2>
        <ul className="mt-2 space-y-1 text-[14px] text-ink-2">
          <li>{summary.createdVideoIds.length} new video record(s)</li>
          <li>{summary.snapshotsAdded} dated snapshot(s) added</li>
          {summary.duplicatesSkipped > 0 && <li>{summary.duplicatesSkipped} duplicate observation(s) skipped</li>}
          {summary.updatedVideoIds.length > 0 && <li>{summary.updatedVideoIds.length} existing video(s) had missing details filled in</li>}
          {summary.accountSnapshotAdded && <li>Account snapshot saved</li>}
        </ul>
        <div className="mt-4 flex gap-2">
          {nextId ? (
            <Button className="flex-1" onClick={() => router.push(`/import/${nextId}`)}>
              Review next
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => router.push('/videos')}>
              Go to videos
            </Button>
          )}
          <Button variant="secondary" className="flex-1" onClick={() => router.push('/import')}>
            Import more
          </Button>
        </div>
      </Card>
    );
  }

  const isList = screenshot.kind === 'video_list';
  const showEntries = screenshot.kind !== 'account_overview' || entries.length > 0;

  return (
    <div className="space-y-4">
      {contentDuplicates.length > 0 && (
        <Notice tone="warn">
          <AlertTriangle size={15} className="mr-1 inline" />
          The same content was found in another screenshot uploaded {date(contentDuplicates[0].uploadedAt, { withTime: true })}
          {contentDuplicates[0].status === 'confirmed' ? ' (already imported)' : ''}. If it is the same screen, discard this one.
        </Notice>
      )}
      {ex && !ex.is_tiktok_screen && <Notice tone="warn">Claude says this doesn’t look like a TikTok screen: {ex.screen_description}</Notice>}
      {!ex && (
        <Notice tone={screenshot.status === 'failed' ? 'bad' : 'neutral'}>
          {screenshot.status === 'failed' ? (
            <>
              <span className="font-medium">The AI could not read this screenshot.</span> {screenshot.extraction_error}
            </>
          ) : aiConfigured ? (
            'This screenshot has not been read yet.'
          ) : (
            'AI is not configured (ANTHROPIC_API_KEY), so enter the values by hand.'
          )}
          {aiConfigured && screenshot.has_image && (
            <Button variant="secondary" className="mt-2 w-full" onClick={retryExtraction} disabled={extracting}>
              {extracting ? <Spinner /> : <RefreshCw size={16} />} {screenshot.status === 'failed' ? 'Try reading again' : 'Read with Claude'}
            </Button>
          )}
        </Notice>
      )}
      {ex?.warnings.length ? (
        <Notice tone="warn">
          <div className="font-medium">Notes from the AI</div>
          <ul className="mt-1 list-disc pl-5">
            {ex.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {screenshot.has_image && (
        <Card className="p-0">
          <button className="flex w-full items-center justify-between px-4 py-3 text-[14px] font-medium" onClick={() => setShowImage(!showImage)}>
            Screenshot
            <ChevronDown size={18} className={cx('transition-transform', showImage && 'rotate-180')} />
          </button>
          <div className={cx('px-3 pb-3', !showImage && 'hidden')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={`/api/screenshots/${screenshot.id}/image`}
              alt="Uploaded screenshot"
              onLoad={() => setImgLoaded(true)}
              className="mx-auto max-h-[60vh] w-auto rounded-xl border border-line"
            />
          </div>
        </Card>
      )}

      <Card className="space-y-2">
        <Field
          label="When were these numbers captured? (UK time)"
          hint={
            <>
              Currently {SOURCE_LABEL[observedSource as keyof typeof SOURCE_LABEL] ?? observedSource}.
              {ex?.observed_date_text && ` On screen: “${ex.observed_date_text}”.`} Relative dates like “3d ago” are worked out from this time.
            </>
          }
        >
          <Input
            type="datetime-local"
            value={observed}
            onChange={(e) => {
              setObserved(e.target.value);
              setObservedSource('user');
            }}
            max={toLocalInput(new Date().toISOString())}
          />
        </Field>
      </Card>

      {showEntries && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">
              {isList ? 'Videos found' : 'Video'} <span className="text-ink-3">({entries.filter((e) => e.include).length} included)</span>
            </h2>
          </div>
          {entries.map((e, i) => (
            <EntryCard
              key={e.key}
              index={i}
              entry={e}
              candidates={candidates}
              thumbnail={thumbs[e.key] ?? null}
              conflict={conflicts[e.key]}
              showMetrics
              onChange={(p) => {
                update(e.key, p);
                if ('decision' in p) setConflicts((c) => ({ ...c, [e.key]: '' }));
              }}
              onRemove={() => setEntries((list) => list.filter((x) => x.key !== e.key))}
            />
          ))}
          {(isList || entries.length === 0) && (
            <Button variant="secondary" className="w-full" onClick={() => setEntries((list) => [...list, blankEntry()])}>
              <Plus size={17} /> Add a missed entry
            </Button>
          )}
        </div>
      )}

      {screenshot.kind === 'video_analytics' && <DetailCard detail={detail} onChange={setDetail} />}
      {screenshot.kind === 'account_overview' && <AccountCard account={account} onChange={setAccount} />}

      {error && <Notice tone="bad">{error}</Notice>}
      <div className="sticky z-20 -mx-4 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur-xl" style={{ bottom: 'calc(3.5rem + var(--safe-bottom))' }}>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={discard} disabled={busy} className="px-3" aria-label="Discard screenshot">
            <Trash2 size={17} />
          </Button>
          <Button className="flex-1" onClick={save} disabled={busy}>
            {busy && <Spinner />} Confirm and save
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntryCard({
  entry: e,
  index,
  candidates,
  thumbnail,
  conflict,
  onChange,
  onRemove
}: {
  entry: ReviewEntry;
  index: number;
  candidates: MatchCandidate[];
  thumbnail: string | null;
  conflict?: string;
  showMetrics?: boolean;
  onChange: (p: Partial<ReviewEntry>) => void;
  onRemove: () => void;
}) {
  const matches = useMemo(() => entryMatches(e, candidates), [e, candidates]);
  const today = toLocalParts(new Date()).date;
  const field = (k: keyof ReviewEntry) => (ev: React.ChangeEvent<HTMLInputElement>) => onChange({ [k]: ev.target.value } as Partial<ReviewEntry>);
  const unsure = (k: string) => e.uncertain.some((u) => u.toLowerCase().includes(k));

  return (
    <Card className={cx('space-y-3', !e.include && 'opacity-60', e.include && e.decision === null && 'border-warn/50')}>
      <div className="flex items-start gap-3">
        {thumbnail && e.useThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="grid h-14 w-10 shrink-0 place-items-center rounded-md bg-surface-3 text-[12px] text-ink-3">{index + 1}</div>
        )}
        <div className="min-w-0 flex-1">
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" className="size-5 accent-[#3987e5]" checked={e.include} onChange={(ev) => onChange({ include: ev.target.checked })} />
            Include this {e.include ? '' : '(will be skipped)'}
          </label>
          <div className="mt-1 flex flex-wrap gap-1">
            {e.partial && <Badge tone="warn">Partly cut off</Badge>}
            {e.titleTruncated && <Badge tone="warn">Title truncated</Badge>}
            {e.uncertain.length > 0 && <Badge tone="warn">Hard to read: {e.uncertain.join(', ')}</Badge>}
          </div>
        </div>
        <button onClick={onRemove} aria-label="Remove entry" className="grid size-9 place-items-center rounded-lg text-ink-3 hover:text-bad">
          <Trash2 size={15} />
        </button>
      </div>
      {e.include && (
        <>
          <Field label="Title (visible text)">
            <Input value={e.title} onChange={field('title')} className={cx(unsure('title') && 'border-warn')} />
          </Field>
          <label className="-mt-1 flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" className="size-4 accent-[#3987e5]" checked={e.titleTruncated} onChange={(ev) => onChange({ titleTruncated: ev.target.checked })} />
            Title was cut off in the screenshot
          </label>
          <div className="grid grid-cols-[1.4fr_1fr] gap-2">
            <Field label="Published" hint={e.publishedText ? `TikTok showed “${e.publishedText}”` : 'Not visible'}>
              <Input type="date" value={e.date} max={today} onChange={(ev) => onChange({ date: ev.target.value, dateTouched: true, ambiguousDate: false })} className={cx(e.ambiguousDate && 'border-warn')} />
            </Field>
            <Field label="Time">
              <Input type="time" value={e.time} onChange={(ev) => onChange({ time: ev.target.value, dateTouched: true })} disabled={!e.date} />
            </Field>
          </div>
          {e.ambiguousDate && <p className="-mt-1 text-[12px] text-warn">This date format could be read two ways. Check the day and month.</p>}
          <div className="grid grid-cols-3 gap-2">
            {COUNT_KEYS.map((k) => {
              const parsed = e[k].trim() ? parseCount(e[k]) : null;
              return (
                <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                  <Input
                    value={e[k]}
                    onChange={field(k)}
                    inputMode="decimal"
                    placeholder="—"
                    className={cx((unsure(k) || (e[k].trim() && !parsed)) && 'border-warn')}
                    aria-describedby={`${e.key}-${k}`}
                  />
                  <span id={`${e.key}-${k}`} className="mt-0.5 block text-[11px] text-ink-3">
                    {e[k].trim() ? (parsed ? `${parsed.approximate ? '≈' : '='} ${parsed.value.toLocaleString('en-GB')}` : 'not a number') : ' '}
                  </span>
                </Field>
              );
            })}
          </div>
          <details className="text-[13px]">
            <summary className="cursor-pointer text-ink-3">More fields (link, duration, thumbnail)</summary>
            <div className="mt-2 grid gap-2">
              <Field label="TikTok link">
                <Input value={e.tiktokUrl} onChange={field('tiktokUrl')} inputMode="url" placeholder="Optional" />
              </Field>
              <Field label="Duration">
                <Input value={e.duration} onChange={field('duration')} placeholder="e.g. 0:45" />
              </Field>
              {thumbnail && (
                <label className="flex items-center gap-2 text-ink-2">
                  <input type="checkbox" className="size-4 accent-[#3987e5]" checked={e.useThumbnail} onChange={(ev) => onChange({ useThumbnail: ev.target.checked })} />
                  Save the cropped thumbnail (untick if the crop is wrong)
                </label>
              )}
            </div>
          </details>
          <MatchPicker entry={e} matches={matches} candidates={candidates} conflict={conflict} onChange={onChange} />
        </>
      )}
    </Card>
  );
}

function MatchPicker({
  entry: e,
  matches,
  candidates,
  conflict,
  onChange
}: {
  entry: ReviewEntry;
  matches: MatchResult[];
  candidates: MatchCandidate[];
  conflict?: string;
  onChange: (p: Partial<ReviewEntry>) => void;
}) {
  const selectedId = e.decision && e.decision !== 'new' ? e.decision.videoId : null;
  const inMatches = selectedId ? matches.some((m) => m.candidate.id === selectedId) : false;
  const selected = selectedId ? candidates.find((c) => c.id === selectedId) : null;
  const choose = (decision: ReviewEntry['decision']) => onChange({ decision, autoDecision: false });

  return (
    <div className={cx('rounded-xl border p-3', e.decision === null ? 'border-warn/50 bg-warn/5' : 'border-line bg-surface-2')}>
      <div className="mb-2 text-[13px] font-medium">
        {matches.length ? 'Is this a video you already have?' : 'Not found in your library'}
        {e.decision === null && <span className="ml-1 text-warn">Choose one</span>}
      </div>
      {conflict && <p className="mb-2 text-[12.5px] text-warn">{conflict}</p>}
      <div className="space-y-1.5">
        {matches.map((m) => (
          <Choice key={m.candidate.id} checked={selectedId === m.candidate.id} onSelect={() => choose({ videoId: m.candidate.id })}>
            <span className="line-clamp-2 text-[13.5px] text-ink">{m.candidate.title}</span>
            <span className="block text-[12px] text-ink-3">
              {published(m.candidate.published_at, m.candidate.published_at_precision)} · {m.candidate.latest_views != null ? `${compact(m.candidate.latest_views)} views` : 'no views yet'} ·{' '}
              <span className={m.level === 'possible' ? 'text-warn' : 'text-good'}>{m.level === 'exact_id' ? 'Same TikTok ID' : m.level === 'likely' ? 'Likely the same' : 'Possibly the same'}</span>
            </span>
            <span className="block text-[11.5px] text-ink-3">{m.reasons.join(' · ')}</span>
          </Choice>
        ))}
        {selected && !inMatches && (
          <Choice checked onSelect={() => {}}>
            <span className="text-[13.5px]">{selected.title}</span>
          </Choice>
        )}
        <Choice checked={e.decision === 'new'} onSelect={() => choose('new')}>
          <span className="text-[13.5px] text-ink">{matches.length ? 'No, it’s a different video (create new)' : 'Create a new video record'}</span>
        </Choice>
      </div>
      {candidates.length > 0 && (
        <Select
          className="mt-2 text-[14px]"
          value=""
          onChange={(ev) => ev.target.value && choose({ videoId: ev.target.value })}
          aria-label="Match to another existing video"
        >
          <option value="">Match to another existing video…</option>
          {[...candidates]
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.title.slice(0, 60)}
              </option>
            ))}
        </Select>
      )}
    </div>
  );
}

function Choice({ checked, onSelect, children }: { checked: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={cx('flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left', checked ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong')}
    >
      <span className={cx('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2', checked ? 'border-accent' : 'border-ink-3')}>
        {checked && <span className="size-2 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0">{children}</span>
    </button>
  );
}

function DetailCard({ detail, onChange }: { detail: DetailState; onChange: (d: DetailState) => void }) {
  const set = (k: keyof DetailState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...detail, [k]: e.target.value });
  return (
    <Card className="space-y-3">
      <h2 className="text-[15px] font-semibold">Detailed analytics</h2>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Average watch time">
          <Input value={detail.avg} onChange={set('avg')} placeholder="e.g. 8.2s" />
        </Field>
        <Field label="Watched full video">
          <Input value={detail.full} onChange={set('full')} placeholder="e.g. 18.5%" />
        </Field>
        <Field label="Total play time">
          <Input value={detail.total} onChange={set('total')} placeholder="e.g. 35h 2m" />
        </Field>
        <Field label="New followers">
          <Input value={detail.followers} onChange={set('followers')} inputMode="numeric" />
        </Field>
      </div>
      <div>
        <div className="mb-1.5 text-[13px] font-medium text-ink-2">Traffic sources</div>
        <div className="space-y-2">
          {detail.traffic.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_auto] gap-2">
              <Input value={t.source} onChange={(e) => onChange({ ...detail, traffic: detail.traffic.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)) })} placeholder="Source" />
              <Input value={t.percent} onChange={(e) => onChange({ ...detail, traffic: detail.traffic.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)) })} placeholder="%" />
              <button aria-label="Remove source" onClick={() => onChange({ ...detail, traffic: detail.traffic.filter((_, j) => j !== i) })} className="grid size-11 place-items-center text-ink-3">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button className="text-[13px] text-accent" onClick={() => onChange({ ...detail, traffic: [...detail.traffic, { source: '', percent: '' }] })}>
            + Add traffic source
          </button>
        </div>
      </div>
      <Field label="Retention notes" hint="Anything the screen says about where viewers dropped off.">
        <Textarea value={detail.retention} onChange={set('retention')} className="min-h-16" />
      </Field>
    </Card>
  );
}

function AccountCard({ account, onChange }: { account: AccountState; onChange: (a: AccountState) => void }) {
  const set = (k: keyof AccountState) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...account, [k]: e.target.value });
  const fields: [keyof AccountState, string][] = [
    ['followers', 'Followers (total)'],
    ['followersChange', 'Net followers in period'],
    ['periodViews', 'Video views in period'],
    ['profileViews', 'Profile views in period'],
    ['likes', 'Likes in period'],
    ['comments', 'Comments in period'],
    ['shares', 'Shares in period'],
    ['totalLikes', 'Total likes (all time)']
  ];
  return (
    <Card className="space-y-3">
      <h2 className="text-[15px] font-semibold">Account figures</h2>
      <p className="-mt-2 text-[12.5px] text-ink-3">Account-level numbers are stored separately from video metrics.</p>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Field label="Period shown">
          <Input value={account.periodLabel} onChange={set('periodLabel')} placeholder="e.g. Last 7 days" />
        </Field>
        <Field label="Days">
          <Input value={account.periodDays} onChange={set('periodDays')} inputMode="numeric" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([k, label]) => (
          <Field key={k} label={label}>
            <Input value={account[k]} onChange={set(k)} inputMode="decimal" placeholder="—" />
          </Field>
        ))}
      </div>
      <p className="text-[12px] text-ink-3">
        Need just your follower count? <Link className="text-accent" href="/account">Add it on the Account page.</Link>
      </p>
    </Card>
  );
}
