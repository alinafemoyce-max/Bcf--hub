import { useMemo, useState } from 'react';
import { useData } from '../state/store';
import { Link, useRouter } from '../state/router';
import { DemoBadge, EmptyState, MeetingStatusBadge, PageHeader, Segmented } from '../components/ui';
import { Icon } from '../components/Icon';
import { MONTH_NAMES, formatDate, toISODate, todayISO } from '../lib/dates';
import type { Meeting, MeetingType } from '../types';

type When = 'upcoming' | 'past' | 'all';
type TypeFilter = 'all' | MeetingType;

function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toISODate(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function MeetingsPage() {
  const { meetings } = useData();
  const router = useRouter();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState<string | null>(null);
  const [when, setWhen] = useState<When>('upcoming');
  const [type, setType] = useState<TypeFilter>('all');

  const byDate = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) map.set(m.date, [...(map.get(m.date) ?? []), m]);
    return map;
  }, [meetings]);

  const cells = monthGrid(cursor.y, cursor.m);
  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(null);
  };

  const list = useMemo(() => {
    let l = meetings.filter((m) => type === 'all' || m.type === type);
    if (selected) l = l.filter((m) => m.date === selected);
    else if (when === 'upcoming') l = l.filter((m) => m.date >= today && m.status !== 'Completed');
    else if (when === 'past') l = l.filter((m) => m.date < today || m.status === 'Completed');
    const asc = when === 'upcoming' || !!selected;
    return l.sort((a, b) => (asc ? 1 : -1) * (a.date + a.time).localeCompare(b.date + b.time));
  }, [meetings, type, when, selected, today]);

  return (
    <div className="page">
      <PageHeader
        title="Meetings"
        large
        subtitle="Pre-BCF and formal BCF meetings"
        actions={
          <button className="icon-btn icon-btn-primary" onClick={() => router.navigate(selected ? `/meetings/new?date=${selected}` : '/meetings/new')} aria-label="New meeting">
            <Icon name="plus" size={22} />
          </button>
        }
      />

      <div className="calendar card">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
            <Icon name="chevronLeft" />
          </button>
          <h2 aria-live="polite">
            {MONTH_NAMES[cursor.m]} {cursor.y}
          </h2>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
            <Icon name="chevronRight" />
          </button>
        </div>
        <div className="cal-grid" role="group" aria-label="Meeting calendar">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="cal-dow" aria-hidden="true">
              {d}
            </span>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <span key={i} className="cal-cell cal-blank" aria-hidden="true" />;
            const ms = byDate.get(iso) ?? [];
            const label = `${formatDate(iso, { weekday: true })}${ms.length ? `, ${ms.length} meeting${ms.length > 1 ? 's' : ''}` : ''}`;
            return (
              <button
                key={iso}
                className={`cal-cell ${iso === today ? 'today' : ''} ${iso === selected ? 'selected' : ''} ${ms.length ? 'has' : ''}`}
                onClick={() => setSelected(iso === selected ? null : iso)}
                aria-label={label}
                aria-pressed={iso === selected}
              >
                <span>{Number(iso.slice(8))}</span>
                {ms.length > 0 && (
                  <span className="cal-dots" aria-hidden="true">
                    {ms.slice(0, 3).map((m) => (
                      <i key={m.id} className={m.type === 'BCF' ? 'dot-bcf' : 'dot-pre'} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="cal-legend">
          <span>
            <i className="dot-bcf" /> BCF
          </span>
          <span>
            <i className="dot-pre" /> Pre-BCF
          </span>
          <button
            className="text-btn"
            onClick={() => {
              setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 });
              setSelected(null);
            }}
          >
            Today
          </button>
        </div>
      </div>

      {selected ? (
        <div className="selected-day">
          <p>
            <strong>{formatDate(selected, { weekday: true })}</strong>
          </p>
          <button className="text-btn" onClick={() => setSelected(null)}>
            Show all
          </button>
        </div>
      ) : (
        <Segmented
          label="Meeting timeframe"
          value={when}
          onChange={setWhen}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
            { value: 'all', label: 'All' }
          ]}
        />
      )}
      <div className="chips">
        {(['all', 'Pre-BCF', 'BCF'] as TypeFilter[]).map((t) => (
          <button key={t} className={`chip ${type === t ? 'chip-active' : ''}`} onClick={() => setType(t)} aria-pressed={type === t}>
            {t === 'all' ? 'All types' : t}
          </button>
        ))}
      </div>

      {list.length ? (
        <div className="list">
          {list.map((m) => (
            <MeetingRow key={m.id} m={m} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="calendar"
          title={selected ? 'No meetings on this day' : 'No meetings here'}
          action={
            <button className="btn btn-secondary" onClick={() => router.navigate(selected ? `/meetings/new?date=${selected}` : '/meetings/new')}>
              <Icon name="plus" size={18} /> Schedule a meeting
            </button>
          }
        />
      )}
    </div>
  );
}

export function MeetingRow({ m }: { m: Meeting }) {
  const openFollowUps = m.followUps.filter((f) => !f.done).length;
  return (
    <Link to={`/meetings/${m.id}`} className="row">
      <div className={`date-chip ${m.type === 'BCF' ? 'bcf' : 'pre'}`} aria-hidden="true">
        <span>{formatDate(m.date).split(' ')[1]}</span>
        <strong>{Number(m.date.slice(8))}</strong>
      </div>
      <div className="row-main">
        <div className="row-meta">
          <span className={`type-tag ${m.type === 'BCF' ? 'bcf' : 'pre'}`}>{m.type}</span>
          {m.time && <span>{m.time}</span>}
          <DemoBadge show={!!m.demo} />
        </div>
        <p className="row-title">{m.title}</p>
        <div className="row-badges">
          <MeetingStatusBadge status={m.status} />
          <span className="row-date">{m.agenda.length} agenda</span>
          {openFollowUps > 0 && <span className="row-date">{openFollowUps} open follow-up{openFollowUps > 1 ? 's' : ''}</span>}
        </div>
      </div>
      <Icon name="chevronRight" size={18} className="row-chevron" />
    </Link>
  );
}
