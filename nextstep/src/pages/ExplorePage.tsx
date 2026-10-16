import { useMemo, useState } from 'react';
import { CareerCard, TopBar, sectorEmoji } from '../components/ui';
import { SECTORS, type Sector } from '../data/catalog';
import { allCareers } from '../lib/data';
import { matchRole } from '../lib/engine';
import { quizComplete } from '../lib/quiz';
import { useStore } from '../state/store';

export default function ExplorePage() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [sector, setSector] = useState<Sector | 'all'>('all');
  const list = useMemo(() => {
    if (q.trim().length >= 2) return matchRole(q, 20).map((m) => m.slug);
    return allCareers()
      .filter((c) => sector === 'all' || c.cat.sector === sector)
      .sort((a, b) => a.cat.level - b.cat.level || a.title.localeCompare(b.title))
      .map((c) => c.slug);
  }, [q, sector]);

  return (
    <>
      <TopBar title="Explore careers" />
      <main className="page">
        <div className="stack">
          <a className="card hero" href={quizComplete(state.quiz) ? '#/discover/results' : '#/discover'} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <p className="eyebrow">Not sure what you want to do?</p>
            <p className="h2" style={{ margin: '6px 0' }}>
              {quizComplete(state.quiz) ? 'See your interest matches' : 'Explore your interests'}
            </p>
            <p className="small muted">8 quick questions about how you like to work. We’ll suggest career areas to explore.</p>
          </a>

          <label className="field">
            <span className="sr-only">Search careers</span>
            <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a job, course or skill…" autoComplete="off" enterKeyHint="search" />
          </label>
          {q.trim().length < 2 && (
            <div className="scroller" role="tablist" aria-label="Filter by industry" style={{ gap: 8 }}>
              {[{ id: 'all', label: 'All', emoji: '✨' }, ...SECTORS].map((s) => (
                <button key={s.id} role="tab" aria-selected={sector === s.id} className={`chip${sector === s.id ? ' on' : ''}`} style={{ flex: 'none', maxWidth: 'none' }} onClick={() => setSector(s.id as Sector | 'all')}>
                  <span aria-hidden="true">{s.id === 'all' ? '✨' : sectorEmoji(s.id)}</span> {'short' in s ? s.short : s.label}
                </button>
              ))}
            </div>
          )}
          <p className="small muted" aria-live="polite">
            {list.length} {list.length === 1 ? 'career' : 'careers'}
            {q.trim().length >= 2 ? ` matching “${q.trim()}”` : ''}
          </p>
          {list.length ? (
            list.map((s) => <CareerCard key={s} slug={s} />)
          ) : (
            <p className="card flat muted small">No careers match that search in our starter dataset. Try a broader word, like “care”, “engineering” or “office”.</p>
          )}
        </div>
      </main>
    </>
  );
}
