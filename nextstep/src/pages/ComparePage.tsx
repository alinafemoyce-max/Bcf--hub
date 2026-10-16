import type { ReactNode } from 'react';
import { CareerPicker } from '../components/CareerPicker';
import { Idea, LinkButton, Notice, TopBar, Verified } from '../components/ui';
import { CATALOG, LEVEL_LABEL, sectorShort } from '../data/catalog';
import { VERIFIED } from '../data/sources';
import { career } from '../lib/data';
import { careerSteps, compareSkills } from '../lib/engine';
import { go, type Route } from '../state/router';
import { useStore } from '../state/store';

export default function ComparePage({ route }: { route: Route }) {
  const { state } = useStore();
  const valid = (s: string | null) => (s && CATALOG[s] && career(s) ? s : '');
  const a = valid(route.query.get('a'));
  const b = valid(route.query.get('b'));
  const set = (k: 'a' | 'b', v: string) => {
    const q = new URLSearchParams({ a, b });
    q.set(k, v);
    go(`/compare?${q.toString()}`);
  };
  const ca = career(a);
  const cb = career(b);
  const start = career(state.profile?.roleSlug);

  const Row = ({ label, left, right, badge }: { label: string; left: ReactNode; right: ReactNode; badge?: ReactNode }) => (
    <>
      <div className="cmp-row-label row" style={{ gap: 8 }}>
        <span style={{ flex: 1 }}>{label}</span>
        {badge}
      </div>
      <div className="cmp-cell">{left}</div>
      <div className="cmp-cell">{right}</div>
    </>
  );
  const ul = (items: string[], max = 5) =>
    items.length ? (
      <ul>
        {items.slice(0, max).map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    ) : (
      <span className="muted">None listed</span>
    );

  return (
    <>
      <TopBar title="Compare careers" backTo={a ? `/career/${a}` : '/explore'} />
      <main className="page">
        <div className="cmp-head">
          <div className="cmp">
            <CareerPicker label="Career 1" value={a} onPick={(v) => set('a', v)} />
            <CareerPicker label="Career 2" value={b} onPick={(v) => set('b', v)} exclude={a} />
          </div>
        </div>

        {!ca || !cb ? (
          <div style={{ marginTop: 16 }}>
            <Notice>Choose two careers to compare them side by side.</Notice>
            {state.saved.length > 1 && (
              <div className="chips" style={{ marginTop: 12 }}>
                {state.saved
                  .filter((s) => s !== a)
                  .map((s) => (
                    <button key={s} className="chip" onClick={() => set(a ? 'b' : 'a', s)}>
                      + {career(s)?.title}
                    </button>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="cmp" style={{ marginTop: 4 }}>
            <Row
              label="Career"
              left={<a href={`#/career/${a}`} style={{ fontWeight: 650, color: 'var(--text)' }}>{ca.title}</a>}
              right={<a href={`#/career/${b}`} style={{ fontWeight: 650, color: 'var(--text)' }}>{cb.title}</a>}
            />
            <Row label="Industry and level" left={`${sectorShort(ca.cat.sector)} · ${LEVEL_LABEL[ca.cat.level]}`} right={`${sectorShort(cb.cat.sector)} · ${LEVEL_LABEL[cb.cat.level]}`} />
            <Row label="What it involves" badge={<Verified />} left={ca.summary} right={cb.summary} />
            <Row label="Typical salary (NCS)" badge={<Verified />} left={`${ca.salary.starter ?? '?'} → ${ca.salary.experienced ?? '?'}`} right={`${cb.salary.starter ?? '?'} → ${cb.salary.experienced ?? '?'}`} />
            <Row label="Typical hours" left={ca.hours ?? 'Not listed'} right={cb.hours ?? 'Not listed'} />
            <Row label="Ways in" badge={<Verified />} left={ul(ca.routesIntro)} right={ul(cb.routesIntro)} />
            <Row
              label="Requirements"
              badge={<Verified />}
              left={ul([...(VERIFIED[a] ?? []).map((v) => v.text), ...ca.restrictions.map((r) => `You’ll need to ${r}`)], 4)}
              right={ul([...(VERIFIED[b] ?? []).map((v) => v.text), ...cb.restrictions.map((r) => `You’ll need to ${r}`)], 4)}
            />
            {start && (
              <Row
                label={`Skills shared with ${start.title.toLowerCase()}`}
                badge={<Idea>Skill match</Idea>}
                left={ul(compareSkills(start.slug, a).shared)}
                right={ul(compareSkills(start.slug, b).shared)}
              />
            )}
            <Row
              label={start ? 'Steps from your current role' : 'Possible steps'}
              badge={<Idea>Illustrative</Idea>}
              left={a === start?.slug ? 'This is your current role' : ul(careerSteps(state.profile, a).map((s) => s.title), 6)}
              right={b === start?.slug ? 'This is your current role' : ul(careerSteps(state.profile, b).map((s) => s.title), 6)}
            />
            <div className="cmp-cell" style={{ background: 'none', border: 0, padding: 0 }}>
              <LinkButton to={`/plan/${a}`} small block>
                Plan
              </LinkButton>
            </div>
            <div className="cmp-cell" style={{ background: 'none', border: 0, padding: 0 }}>
              <LinkButton to={`/plan/${b}`} small block>
                Plan
              </LinkButton>
            </div>
          </div>
        )}
        <p className="source" style={{ marginTop: 20 }}>
          Figures and routes from the National Careers Service (Open Government Licence v3.0). Salaries are national averages, not offers of pay.
        </p>
      </main>
    </>
  );
}
