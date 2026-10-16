import { CareerCard, Empty, LinkButton, TopBar } from '../components/ui';
import { career } from '../lib/data';
import { buildPlan } from '../lib/plan';
import { useStore } from '../state/store';

export default function SavedPage() {
  const { state } = useStore();
  const plans = Object.entries(state.plans).filter(([s, ids]) => ids.length && career(s));

  return (
    <>
      <TopBar title="Saved" />
      <main className="page">
        <h1 className="h2" style={{ margin: '8px 0 12px' }}>
          Your shortlist
        </h1>
        {state.saved.length ? (
          <div className="stack">
            {state.saved.map((s) => (
              <CareerCard key={s} slug={s} />
            ))}
            {state.saved.length >= 2 && (
              <LinkButton to={`/compare?a=${state.saved[0]}&b=${state.saved[1]}`} block>
                Compare saved careers
              </LinkButton>
            )}
          </div>
        ) : (
          <Empty emoji="⭐" title="Nothing saved yet">
            <p className="muted" style={{ marginBottom: 16 }}>
              Tap the star on any career to add it to your shortlist.
            </p>
            <LinkButton to="/paths" kind="primary">
              See my pathways
            </LinkButton>
          </Empty>
        )}

        {plans.length > 0 && (
          <>
            <h2 className="h2" style={{ margin: '28px 0 12px' }}>
              Action plans in progress
            </h2>
            <div className="stack">
              {plans.map(([s, ids]) => {
                const total = buildPlan(state.profile, s).flatMap((x) => x.items);
                const done = total.filter((i) => ids.includes(i.id)).length;
                const pct = total.length ? Math.round((done / total.length) * 100) : 0;
                return (
                  <a key={s} className="card row" href={`#/plan/${s}`}>
                    <div className="ring" style={{ ['--p' as string]: pct, width: 48, height: 48 }}>
                      <span style={{ width: 38, height: 38, fontSize: 12 }}>{pct}%</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="h3">{career(s)!.title}</p>
                      <p className="small muted">
                        {done} of {total.length} actions done
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </>
        )}
        <p className="source" style={{ marginTop: 24 }}>
          Saved on this device only. It won’t appear on your other devices or browsers.
        </p>
      </main>
    </>
  );
}
