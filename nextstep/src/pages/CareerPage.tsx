import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { ShareSheet } from '../components/ShareSheet';
import { Empty, Ext, Idea, LinkButton, Notice, SaveButton, TopBar, Typical, Verified } from '../components/ui';
import { LEVEL_LABEL, sectorLabel } from '../data/catalog';
import { CHECKED_ON, VERIFIED, ncsUrl } from '../data/sources';
import { career, retrievedOn } from '../lib/data';
import { careerSteps, compareSkills, qualNotes, whySuits } from '../lib/engine';
import type { Block } from '../lib/types';
import { careerLink, careerShareText } from '../lib/share';
import { useStore } from '../state/store';
import { StepList } from './MapPage';

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        'p' in b ? (
          <p key={i} style={{ marginTop: i ? 8 : 0 }} className="small">
            {b.p}
          </p>
        ) : (
          <ul key={i} className="list" style={{ marginTop: 4 }}>
            {b.ul.map((x) => (
              <li key={x} className="small">
                {x}
              </li>
            ))}
          </ul>
        )
      )}
    </>
  );
}

export function SourceLine({ slug }: { slug: string }) {
  const c = career(slug);
  if (!c) return null;
  return (
    <p className="source">
      Source: <Ext href={ncsUrl(slug)}>National Careers Service – {c.title}</Ext>, retrieved {formatDate(retrievedOn())}. Contains public sector information licensed under the Open Government Licence v3.0. Information is for England and can change – always check the source.
    </p>
  );
}

export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function CareerPage({ slug }: { slug: string }) {
  const { state } = useStore();
  const { profile, quiz } = state;
  const c = career(slug);
  const [share, setShare] = useState(false);
  const why = useMemo(() => (c ? whySuits(profile, slug, quiz) : []), [c, profile, slug, quiz]);
  const skills = useMemo(() => compareSkills(profile?.roleSlug, slug), [profile?.roleSlug, slug]);
  const steps = useMemo(() => careerSteps(profile, slug), [profile, slug]);
  const quals = useMemo(() => qualNotes(profile, slug), [profile, slug]);

  if (!c) {
    return (
      <>
        <TopBar title="Career" backTo="/explore" />
        <main className="page">
          <Empty emoji="🔎" title="We couldn’t find that career">
            <p className="muted" style={{ marginBottom: 16 }}>
              The link may be out of date.
            </p>
            <LinkButton to="/explore" kind="primary">
              Browse careers
            </LinkButton>
          </Empty>
        </main>
      </>
    );
  }

  const start = career(profile?.roleSlug);
  const isStart = start?.slug === slug;
  const verified = VERIFIED[slug] ?? [];
  const registration = c.info.find((i) => i.h === 'Registration')?.items ?? [];
  const tips = c.info.filter((i) => i.h !== 'Registration');
  const hasReqs = verified.length + c.restrictions.length + registration.length > 0;

  return (
    <>
      <TopBar
        title={c.title}
        backTo="/paths"
        right={
          <>
            <button className="icon-btn" onClick={() => setShare(true)} aria-label="Share this career">
              <Icon name="share" />
            </button>
            <SaveButton slug={slug} />
          </>
        }
      />
      <main className="page">
        <div className="stack">
          <div className="chips">
            <span className="pill">{sectorLabel(c.cat.sector)}</span>
            <span className="pill">{LEVEL_LABEL[c.cat.level]}</span>
            {isStart && <span className="pill" style={{ color: 'var(--teal)' }}>Your current role</span>}
          </div>
          <h1 className="h1">{c.title}</h1>
          {c.altTitles && <p className="small muted">Also called: {c.altTitles}</p>}
          <p className="lead">{c.summary}</p>

          <div className="kv" aria-label="Pay and hours from the National Careers Service">
            <div>
              <span>Typical starting salary</span>
              <b>{c.salary.starter ?? 'Not listed'}</b>
            </div>
            <div>
              <span>Typical experienced salary</span>
              <b>{c.salary.experienced ?? 'Not listed'}</b>
            </div>
            <div>
              <span>Typical hours</span>
              <b>{c.hours ?? 'Not listed'}</b>
            </div>
            <div>
              <span>You could work</span>
              <b style={{ fontSize: 14 }}>{c.pattern ?? 'Not listed'}</b>
            </div>
          </div>
          <p className="source">
            <Verified>NCS figures</Verified> National averages, not offers of pay. Pay varies by employer, region and experience.
          </p>

          <div className="btn-row no-print" style={{ marginTop: 8 }}>
            <LinkButton to={`/plan/${slug}`} kind="primary">
              Action plan
            </LinkButton>
            <LinkButton to={`/map/${slug}`}>
              <Icon name="map" /> Career map
            </LinkButton>
          </div>
          <LinkButton to={`/compare?a=${slug}`} block small kind="ghost">
            <Icon name="compare" /> Compare with another career
          </LinkButton>
        </div>

        <Section title="Why it might suit you" badge={<Idea />}>
          {why.length ? (
            <ul className="list amber">
              {why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="muted small">
              {profile ? 'We don’t have enough information to say why this might suit you. Try adding more answers.' : 'Answer a few questions to see why this might suit you.'}{' '}
              <a href="#/start">{profile ? 'Edit answers' : 'Get started'}</a>
            </p>
          )}
        </Section>

        <Section title="What the role involves" badge={<Verified />}>
          <ul className="list">
            {c.tasks.map((t) => (
              <li key={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</li>
            ))}
          </ul>
          {c.environment.length > 0 && (
            <details className="acc" style={{ marginTop: 12 }}>
              <summary>Working environment</summary>
              <div className="acc-body">
                {c.environment.map((e) => (
                  <p key={e} className="small muted" style={{ marginTop: 6 }}>
                    {e}
                  </p>
                ))}
              </div>
            </details>
          )}
        </Section>

        <Section title={start && !isStart ? 'Your transferable skills' : 'Skills this role uses'} badge={<Idea>Skill match</Idea>}>
          {start && !isStart ? (
            <div className="stack">
              {skills.shared.length ? (
                <>
                  <p className="small muted">Skills the National Careers Service lists for both {start.title.toLowerCase()} and {c.title.toLowerCase()}:</p>
                  <div className="chips">
                    {skills.shared.map((s) => (
                      <span className="pill" key={s} style={{ color: 'var(--green)' }}>
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="small muted">The NCS skills lists for these two roles don’t overlap much – but general skills like reliability and communication always transfer.</p>
              )}
              {skills.develop.length > 0 && (
                <>
                  <p className="h3" style={{ marginTop: 12 }}>
                    Skills you may need to develop
                  </p>
                  <div className="chips">
                    {skills.develop.map((s) => (
                      <span className="pill" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="chips">
              {skills.all.map((s) => (
                <span className="pill" key={s}>
                  {s}
                </span>
              ))}
            </div>
          )}
          {!start && (
            <p className="small muted" style={{ marginTop: 10 }}>
              Tell us your current job or course to see which of these skills you may already have.
            </p>
          )}
        </Section>

        {hasReqs && (
          <Section title="Requirements" badge={<Verified />}>
            <p className="small muted" style={{ marginBottom: 8 }}>
              Requirements stated by the National Careers Service or the official regulator (checked {CHECKED_ON}).
            </p>
            <ul className="list">
              {verified.map((v) => (
                <li key={v.text}>
                  {v.text} <span className="source">(<Ext href={v.url}>{v.source}</Ext>)</span>
                </li>
              ))}
              {registration
                .filter((r) => !verified.some((v) => sameBody(v.text, r)))
                .map((r) => (
                  <li key={r}>{r.charAt(0).toUpperCase() + r.slice(1)}.</li>
                ))}
              {c.restrictions.map((r) => (
                <li key={r}>You’ll need to {r}.</li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Qualifications and entry routes" badge={<Typical />}>
          <p className="small muted" style={{ marginBottom: 10 }}>
            Ways in described by the National Careers Service. These are common routes, not the only ones – entry requirements vary between employers and course providers.
          </p>
          {c.routes.map((r) => {
            const notes = quals.filter((q) => q.route === r.title);
            return (
              <details className="acc" key={r.id}>
                <summary>{r.title}</summary>
                <div className="acc-body">
                  <Blocks blocks={r.content} />
                  {r.requirements.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <p className="small" style={{ fontWeight: 650 }}>
                        Entry requirements (typical)
                      </p>
                      <ul className="list blue">
                        {notes.map((n) => (
                          <li key={n.req} className="small">
                            {n.req}
                            {n.state === 'have' && <span style={{ color: 'var(--green)' }}> – you’ve told us you have this or similar</span>}
                            {n.state === 'working' && <span style={{ color: 'var(--amber)' }}> – you’re working towards this</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
          {quals.some((q) => q.state) && (
            <p className="source" style={{ marginTop: 10 }}>
              Qualification matches are a rough guide only. Check exact requirements with the provider or employer.
            </p>
          )}
        </Section>

        {!isStart && (
          <Section title={start ? `Steps from ${start.title.toLowerCase()}` : 'A possible sequence of steps'} badge={<Idea>Illustrative</Idea>}>
            <StepList steps={steps} />
            {profile?.experience && ['none', 'lt1'].includes(profile.experience) && (
              <p className="small muted" style={{ marginBottom: 10 }}>
                Each step usually takes time and experience. Real timelines vary a lot from person to person.
              </p>
            )}
            <LinkButton to={`/map/${slug}`} block small>
              <Icon name="map" /> Explore routes on the career map
            </LinkButton>
          </Section>
        )}

        {c.progression.length > 0 && (
          <Section title="Career progression" badge={<Verified />}>
            {c.progression.map((p, i) =>
              p.startsWith('- ') ? (
                <ul className="list" key={i}>
                  <li className="small">{p.slice(2)}</li>
                </ul>
              ) : (
                <p className="small" key={i} style={{ marginTop: i ? 8 : 0 }}>
                  {p}
                </p>
              )
            )}
          </Section>
        )}

        {tips.length > 0 && (
          <Section title="More from the National Careers Service" badge={<Verified />}>
            {tips.map((t) => (
              <div key={t.h} style={{ marginBottom: 10 }}>
                <p className="small" style={{ fontWeight: 650 }}>
                  {t.h}
                </p>
                {t.items.map((x) => (
                  <p key={x} className="small muted">
                    {x}
                  </p>
                ))}
              </div>
            ))}
          </Section>
        )}

        <div className="stack" style={{ marginTop: 24 }}>
          <LinkButton to={`/plan/${slug}`} kind="primary" block>
            Build my action plan <Icon name="arrowRight" />
          </LinkButton>
          <Notice>
            Want to look for vacancies or courses? Use the <Ext href={ncsUrl(slug)}>National Careers Service profile</Ext>, which links to current apprenticeships and courses. NextStep doesn’t list vacancies.
          </Notice>
          <SourceLine slug={slug} />
        </div>
      </main>
      <ShareSheet open={share} onClose={() => setShare(false)} title={`Share: ${c.title}`} text={careerShareText(slug)} url={careerLink(slug)} />
    </>
  );
}

const BODIES = ['Nursing and Midwifery Council', 'Health and Care Professions Council', 'General Pharmaceutical Council', 'Financial Conduct Authority', 'Social Work England', 'qualified teacher status', 'Building Safety Regulator'];
const sameBody = (a: string, b: string) => BODIES.some((x) => a.includes(x) && b.includes(x));

export function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="row wrap" style={{ marginBottom: 12, gap: 8 }}>
        <h2 className="h3" style={{ flex: 1, minWidth: 160 }}>
          {title}
        </h2>
        {badge}
      </div>
      {children}
    </section>
  );
}
