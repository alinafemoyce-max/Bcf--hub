import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { CareerPicker } from '../components/CareerPicker';
import { Empty, Idea, LinkButton, Notice, Sheet, TopBar, sectorEmoji } from '../components/ui';
import { CATALOG, sectorShort } from '../data/catalog';
import { career } from '../lib/data';
import { alternativeRoutes, buildPathways, careerSteps, edges, stepNote, type Step } from '../lib/engine';
import { go, type Route } from '../state/router';
import { useStore } from '../state/store';

const KIND_LABEL: Record<string, string> = {
  start: 'Starting point',
  up: 'Step up',
  side: 'Move across',
  related: 'Related move',
  train: 'Training or entry route',
  target: 'Goal'
};

export function StepList({ steps, onPick }: { steps: Step[]; onPick?: (slug: string) => void }) {
  return (
    <ol className="steps" style={{ marginBottom: 8 }}>
      {steps.map((s, i) => (
        <li key={`${s.slug ?? s.title}-${i}`} className={`step ${s.kind}`}>
          <span className="step-dot" aria-hidden="true">
            {s.kind === 'target' ? <Icon name="star" size={16} filled /> : i + 1}
          </span>
          <div className="step-kind">{KIND_LABEL[s.kind]}</div>
          <div className="step-title">
            {s.slug ? (
              onPick ? (
                <button className="btn-ghost" style={{ border: 0, padding: 0, background: 'none', font: 'inherit', fontWeight: 650, color: 'var(--text)', textDecoration: 'underline', textDecorationColor: 'var(--line-strong)', textUnderlineOffset: 3, cursor: 'pointer', textAlign: 'left' }} onClick={() => onPick(s.slug!)}>
                  {s.title}
                </button>
              ) : (
                <a href={`#/career/${s.slug}`}>{s.title}</a>
              )
            ) : (
              s.title
            )}
          </div>
          {s.note && <div className="step-note">{s.note}</div>}
        </li>
      ))}
    </ol>
  );
}

export default function MapPage({ route }: { route: Route }) {
  const target = route.parts[1];
  return target ? <RouteMap target={target} route={route} /> : <ExploreMap route={route} />;
}

/** Neighbourhood map: the focused career in the middle, with up / sideways / other-industry moves around it. */
function ExploreMap({ route }: { route: Route }) {
  const { state } = useStore();
  const pw = useMemo(() => buildPathways(state.profile, state.quiz), [state.profile, state.quiz]);
  const home = pw.start?.slug ?? pw.base?.slug ?? null;
  const at = route.query.get('at');
  const focus = career(at && CATALOG[at] ? at : home);
  const [picked, setPicked] = useState<string | null>(null);

  if (!focus) {
    return (
      <>
        <TopBar title="Career map" />
        <main className="page">
          <div className="stack-lg">
            <Empty emoji="🗺️" title="Pick a starting point">
              <p className="muted">Choose any career to see where it can lead. Or answer a few questions so the map starts from you.</p>
            </Empty>
            <CareerPicker label="Start the map from" onPick={(s) => go(`/map?at=${s}`)} />
            <LinkButton to="/start" kind="primary" block>
              Answer the questions
            </LinkButton>
          </div>
        </main>
      </>
    );
  }

  const e = edges(focus.slug);
  const up = [...new Set([...(focus.cat.up ?? []), ...e.filter((x) => x.kind !== 'up' && CATALOG[x.to].level > focus.cat.level && CATALOG[x.to].sector === focus.cat.sector).map((x) => x.to)])].filter((s) => career(s));
  const side = e.filter((x) => !up.includes(x.to) && CATALOG[x.to].sector === focus.cat.sector && CATALOG[x.to].level <= focus.cat.level + 1).map((x) => x.to);
  const cross = e.filter((x) => !up.includes(x.to) && CATALOG[x.to].sector !== focus.cat.sector).map((x) => x.to);
  const below = side.filter((s) => CATALOG[s].level < focus.cat.level);
  const across = side.filter((s) => CATALOG[s].level >= focus.cat.level);
  const isHome = focus.slug === home;

  const Node = ({ slug, kind }: { slug: string; kind: string }) => {
    const c = career(slug)!;
    return (
      <button className={`node ${kind}`} onClick={() => setPicked(slug)}>
        <span aria-hidden="true">{sectorEmoji(c.cat.sector)}</span>
        <span>
          {c.title}
          {kind === 'cross' && (
            <>
              <br />
              <small>{sectorShort(c.cat.sector)}</small>
            </>
          )}
        </span>
      </button>
    );
  };

  return (
    <>
      <TopBar title="Career map" />
      <main className="page">
        <div className="stack">
          <p className="muted small">Tap any role to explore it, re-centre the map on it, or see the steps to reach it.</p>
          <div className="legend" aria-hidden="true">
            <span>
              <i style={{ borderColor: 'var(--teal)' }} />
              Step up
            </span>
            <span>
              <i style={{ borderColor: 'var(--blue)' }} />
              Move across
            </span>
            <span>
              <i style={{ borderColor: 'var(--amber)' }} />
              Other industries
            </span>
          </div>
        </div>

        <div className="map" style={{ marginTop: 16 }}>
          {up.length > 0 && (
            <div className="map-col">
              <div className="map-label">Step up</div>
              <div className="map-nodes">
                {up.map((s) => (
                  <Node key={s} slug={s} kind="up" />
                ))}
              </div>
              <div className="map-arrow" aria-hidden="true">
                <Icon name="arrowUp" />
              </div>
            </div>
          )}

          <div className="map-center">
            <p className="eyebrow">{isHome ? (pw.start ? 'You are here' : 'Starting point') : 'Exploring'}</p>
            <p className="h2" style={{ margin: '4px 0' }}>
              {focus.title}
            </p>
            <p className="small muted">{sectorShort(focus.cat.sector)}</p>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <LinkButton to={`/career/${focus.slug}`} small>
                Details
              </LinkButton>
              {!isHome && home && (
                <LinkButton to={`/map/${focus.slug}`} small kind="primary">
                  Route here
                </LinkButton>
              )}
            </div>
          </div>

          {across.length > 0 && (
            <div className="map-col">
              <div className="map-arrow" aria-hidden="true">
                <Icon name="arrowDown" />
              </div>
              <div className="map-label">Move across</div>
              <div className="map-nodes">
                {across.map((s) => (
                  <Node key={s} slug={s} kind="side" />
                ))}
              </div>
            </div>
          )}
          {cross.length > 0 && (
            <div className="map-col">
              <div className="map-label">Other industries</div>
              <div className="map-nodes">
                {cross.map((s) => (
                  <Node key={s} slug={s} kind="cross" />
                ))}
              </div>
            </div>
          )}
          {below.length > 0 && (
            <div className="map-col">
              <div className="map-label">Earlier steps</div>
              <div className="map-nodes">
                {below.map((s) => (
                  <Node key={s} slug={s} kind="side" />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="stack" style={{ marginTop: 20 }}>
          {!isHome && home && (
            <button className="btn btn-secondary btn-block" onClick={() => go('/map')}>
              <Icon name="refresh" /> Return to my starting position
            </button>
          )}
          <CareerPicker label="Jump to another career" onPick={(s) => go(`/map?at=${s}`)} />
          <Notice icon="sparkle">
            <Idea>Suggestions</Idea> Links come from National Careers Service career paths and related careers, plus NextStep’s own grouping. They show possibilities, not guaranteed moves.
          </Notice>
        </div>
      </main>

      <NodeSheet slug={picked} home={home} onClose={() => setPicked(null)} />
    </>
  );
}

function NodeSheet({ slug, home, onClose }: { slug: string | null; home: string | null; onClose: () => void }) {
  const c = career(slug);
  return (
    <Sheet open={!!c} onClose={onClose} title={c?.title ?? ''}>
      {c && (
        <div className="stack">
          <span className="pill" style={{ alignSelf: 'flex-start' }}>
            {sectorShort(c.cat.sector)}
          </span>
          <p className="muted">{c.summary}</p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              onClose();
              go(`/career/${c.slug}`);
            }}
          >
            View career details
          </button>
          {home && home !== c.slug && (
            <button
              className="btn btn-secondary btn-block"
              onClick={() => {
                onClose();
                go(`/map/${c.slug}`);
              }}
            >
              <Icon name="map" /> Show the steps to get here
            </button>
          )}
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              onClose();
              go(`/map?at=${c.slug}`);
            }}
          >
            Re-centre the map here
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** Route map: different ways from a starting point to a chosen career. */
function RouteMap({ target, route }: { target: string; route: Route }) {
  const { state } = useStore();
  const t = career(target);
  const fromParam = route.query.get('from');
  const from = fromParam === 'none' ? null : fromParam && CATALOG[fromParam] ? fromParam : (state.profile?.roleSlug ?? null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const options = useMemo(() => {
    if (!t) return [];
    const list: { label: string; steps: Step[] }[] = [];
    if (from && from !== target) {
      alternativeRoutes(from, target, 3).forEach((r, i) => {
        const steps: Step[] = r.map((p, j) => ({
          slug: p.slug,
          title: career(p.slug)!.title,
          kind: j === 0 ? 'start' : j === r.length - 1 ? 'target' : (p.kind as Step['kind']),
          note: j === 0 ? 'Where you start.' : stepNote(p.kind, r[j - 1].slug, p.slug)
        }));
        list.push({ label: i === 0 ? 'Most direct route' : `Alternative ${i}`, steps });
      });
    }
    // Always offer the training route straight in.
    list.push({ label: list.length ? 'Training route' : 'Route in', steps: careerSteps(state.profile, target, null) });
    return list;
  }, [t, from, target, state.profile]);

  if (!t) {
    return (
      <>
        <TopBar title="Career map" backTo="/map" />
        <main className="page">
          <Empty emoji="🔎" title="We couldn’t find that career" />
        </main>
      </>
    );
  }
  const current = options[Math.min(idx, options.length - 1)];
  const fromCareer = career(from);

  return (
    <>
      <TopBar title={`Route to ${t.title}`} backTo={`/career/${target}`} />
      <main className="page">
        <div className="stack">
          <p className="eyebrow">Career map</p>
          <h1 className="h2">
            {fromCareer ? fromCareer.title : 'Starting out'} → {t.title}
          </h1>
          <CareerPicker
            label="Starting from"
            value={from ?? ''}
            allowNone="Not working in this field yet"
            onPick={(s) => {
              setIdx(0);
              go(`/map/${target}?from=${s || 'none'}`);
            }}
          />
          {options.length > 1 && (
            <div className="route-tabs" role="tablist" aria-label="Routes">
              {options.map((o, i) => (
                <button key={o.label} role="tab" aria-selected={i === idx} className={`chip${i === idx ? ' on' : ''}`} onClick={() => setIdx(i)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {fromCareer && options.length === 1 && (
            <Notice tone="amber" icon="alert">
              There’s no close link between {fromCareer.title.toLowerCase()} and {t.title.toLowerCase()} in our dataset, so this shows the usual training route in. Your transferable skills still count.
            </Notice>
          )}
        </div>

        <section className="card" style={{ marginTop: 16 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 className="h3" style={{ flex: 1 }}>
              {current?.label}
            </h2>
            <Idea>Illustrative</Idea>
          </div>
          {current && <StepList steps={current.steps} onPick={setPicked} />}
        </section>

        <div className="stack" style={{ marginTop: 16 }}>
          <div className="btn-row">
            <LinkButton to={`/plan/${target}`} kind="primary">
              Action plan
            </LinkButton>
            <LinkButton to={`/compare?a=${target}`}>
              <Icon name="compare" /> Compare
            </LinkButton>
          </div>
          <button className="btn btn-ghost btn-block" onClick={() => go('/map')}>
            <Icon name="refresh" /> Return to my starting position
          </button>
          <p className="source">Routes are built from National Careers Service career paths and related careers. Real routes depend on employers, opportunities and your own circumstances.</p>
        </div>
      </main>
      <NodeSheet slug={picked} home={from} onClose={() => setPicked(null)} />
    </>
  );
}
