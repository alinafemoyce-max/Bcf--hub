import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { ShareSheet } from '../components/ShareSheet';
import { Empty, Ext, LinkButton, Notice, TopBar, Verified } from '../components/ui';
import { career } from '../lib/data';
import { buildPlan, planText } from '../lib/plan';
import { useStore } from '../state/store';
import { SourceLine } from './CareerPage';

export default function PlanPage({ slug }: { slug: string }) {
  const { state, togglePlanItem, canSave } = useStore();
  const c = career(slug);
  const sections = useMemo(() => buildPlan(state.profile, slug), [state.profile, slug]);
  const done = useMemo(() => new Set(state.plans[slug] ?? []), [state.plans, slug]);
  const [share, setShare] = useState(false);

  if (!c) {
    return (
      <>
        <TopBar title="Action plan" backTo="/saved" />
        <main className="page">
          <Empty emoji="🔎" title="We couldn’t find that career" />
        </main>
      </>
    );
  }

  const all = sections.flatMap((s) => s.items);
  const ticked = all.filter((i) => done.has(i.id)).length;
  const pct = all.length ? Math.round((ticked / all.length) * 100) : 0;

  return (
    <>
      <TopBar
        title="Action plan"
        backTo={`/career/${slug}`}
        right={
          <button className="icon-btn" onClick={() => setShare(true)} aria-label="Share or export this plan">
            <Icon name="share" />
          </button>
        }
      />
      <main className="page">
        <div className="row" style={{ alignItems: 'center', gap: 16 }}>
          <div className="ring" style={{ ['--p' as string]: pct }} role="img" aria-label={`${pct}% complete`}>
            <span>{pct}%</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow">Action plan</p>
            <h1 className="h2">{c.title}</h1>
            <p className="small muted">
              {ticked} of {all.length} actions done
            </p>
          </div>
        </div>

        {!canSave && (
          <div style={{ marginTop: 14 }}>
            <Notice tone="amber" icon="alert">
              Your browser is blocking storage, so ticks won’t be kept after you close this page.
            </Notice>
          </div>
        )}

        {sections.map((s) => {
          const n = s.items.filter((i) => done.has(i.id)).length;
          return (
            <section className="card" key={s.id} style={{ marginTop: 16 }}>
              <div className="row" style={{ marginBottom: 4 }}>
                <h2 className="h3" style={{ flex: 1 }}>
                  {s.title}
                </h2>
                <span className="pill">
                  {n}/{s.items.length}
                </span>
              </div>
              <p className="small muted" style={{ marginBottom: 6 }}>
                {s.intro}
              </p>
              <div role="group" aria-label={s.title}>
                {s.items.map((i) => {
                  const on = done.has(i.id);
                  return (
                    <div key={i.id}>
                      <button className={`check${on ? ' done' : ''}`} role="checkbox" aria-checked={on} onClick={() => togglePlanItem(slug, i.id)}>
                        <span className="check-box" aria-hidden="true">
                          <Icon name="check" />
                        </span>
                        <span>
                          <span className="check-text">
                            {i.text} {i.verified && <Verified>Requirement</Verified>}
                          </span>
                          {i.detail && <span className="check-detail">{i.detail}</span>}
                        </span>
                      </button>
                      {i.link && (
                        <p className="small" style={{ margin: '-4px 0 8px 40px' }}>
                          <Ext href={i.link.url}>{i.link.label}</Ext>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <div className="stack no-print" style={{ marginTop: 20 }}>
          <button className="btn btn-secondary btn-block" onClick={() => setShare(true)}>
            <Icon name="share" /> Share or copy this plan
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => window.print()}>
            <Icon name="print" /> Print or save as PDF
          </button>
          <LinkButton to={`/map/${slug}`} block kind="ghost">
            <Icon name="map" /> See the route on the career map
          </LinkButton>
        </div>
        <div className="stack" style={{ marginTop: 16 }}>
          <Notice>Ticks are saved on this device only. This plan never includes your personal answers, so it’s safe to share.</Notice>
          <SourceLine slug={slug} />
        </div>
      </main>
      <ShareSheet
        open={share}
        onClose={() => setShare(false)}
        title="Share action plan"
        text={planText(slug, sections, done)}
        note="This is exactly what will be shared: the plan and your ticks, with no personal details from your answers."
      />
    </>
  );
}
