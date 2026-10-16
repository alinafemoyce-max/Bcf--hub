import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { CareerCard, Empty, Ext, Idea, LinkButton, Notice, TopBar } from '../components/ui';
import { sectorLabel } from '../data/catalog';
import { LINKS } from '../data/sources';
import { career } from '../lib/data';
import { buildPathways, type Suggestion } from '../lib/engine';
import { EXPERIENCE, INTERESTS, STATUSES, label } from '../lib/options';
import { quizComplete } from '../lib/quiz';
import { useStore } from '../state/store';

export default function Paths() {
  const { state } = useStore();
  const { profile, quiz } = state;
  const pw = useMemo(() => buildPathways(profile, quiz), [profile, quiz]);

  if (!profile) {
    return (
      <>
        <TopBar brand />
        <main className="page">
          <Empty emoji="🧭" title="Let’s find your next steps">
            <p className="muted" style={{ marginBottom: 18 }}>
              Answer six quick questions – you can skip any you’re unsure about.
            </p>
            <div className="stack">
              <LinkButton to="/start" kind="primary" block>
                Get started
              </LinkButton>
              <LinkButton to="/discover" block>
                Not sure? Explore your interests
              </LinkButton>
            </div>
          </Empty>
        </main>
      </>
    );
  }

  const start = pw.start;
  const base = pw.base;
  const unsure = profile.interests.includes('unsure') || (!start && !profile.industry);
  const wantsBusiness = profile.interests.includes('business') || profile.status === 'self-employed';
  const wantsEducation = profile.interests.includes('education') || profile.status === 'school' || profile.status === 'college';
  const crossFirst = profile.interests.includes('change') || profile.status === 'changing';

  const chips = [
    label(STATUSES, profile.status),
    start ? start.title : profile.role,
    profile.industry && profile.industry !== 'none' ? sectorLabel(profile.industry) : undefined,
    profile.experience ? `${label(EXPERIENCE, profile.experience)} experience` : undefined,
    ...profile.interests.map((i) => label(INTERESTS, i))
  ].filter(Boolean) as string[];

  const sections: ReactNode[] = [
    <PathSection
      key="up"
      icon="arrowUp"
      title="Upward progression"
      intro={`Possible promotions and more senior roles${base ? ` from ${base.title.toLowerCase()}` : ''}.`}
      items={pw.upward}
      empty="We don’t have senior roles linked to this career in our starter dataset yet. Check the National Careers Service profile for progression ideas."
    />,
    <PathSection key="side" icon="arrowRight" title="Sideways moves" intro="Related roles in the same industry that use similar skills." items={pw.sideways} empty="No closely related roles found in our starter dataset yet." />,
    <PathSection key="cross" icon="refresh" title="Cross-industry" intro="Roles in other sectors where your existing skills could transfer." items={pw.cross} empty="No strong cross-industry matches found yet." />
  ];
  if (crossFirst) sections.unshift(sections.pop());

  return (
    <>
      <TopBar
        brand
        right={
          <a className="icon-btn" href="#/start" aria-label="Edit my answers">
            <Icon name="edit" />
          </a>
        }
      />
      <main className="page">
        <div className="stack">
          <p className="eyebrow">Your pathways</p>
          <h1 className="h1">{start ? <>From {start.title.toLowerCase()}, you could go…</> : <>Here’s where you could start</>}</h1>
          <div className="chips" aria-label="Based on your answers">
            {chips.map((c) => (
              <span className="pill" key={c}>
                {c}
              </span>
            ))}
            <a className="pill" href="#/start" style={{ color: 'var(--teal)', textDecoration: 'none' }}>
              Edit
            </a>
          </div>
        </div>

        <div className="stack" style={{ marginTop: 16 }}>
          {!start && profile.role && (
            <Notice tone="amber" icon="alert">
              We couldn’t match “{profile.role}” to a career in our starter dataset
              {pw.basis === 'industry' && base ? `, so these ideas start from entry roles in ${sectorLabel(base.cat.sector).toLowerCase()}` : ''}. You can{' '}
              <a href="#/start?q=2">try a different description</a>.
            </Notice>
          )}
          {profile.experience && ['none', 'lt1'].includes(profile.experience) && start && (
            <Notice>Most next steps here come “with experience”. Building a solid track record in your current role is often the first move.</Notice>
          )}
          <Notice icon="sparkle">
            <Idea>Suggestions</Idea> These are possibilities based on National Careers Service progression information and your answers – not guaranteed promotions or vacancies.
          </Notice>
        </div>

        {(unsure || !quizComplete(quiz)) && (
          <a className="card hero" href="#/discover" style={{ display: 'block', marginTop: 16, textDecoration: 'none', color: 'inherit' }}>
            <p className="eyebrow">{quizComplete(quiz) ? 'Your interests' : 'Not sure yet?'}</p>
            <p className="h2" style={{ margin: '6px 0' }}>
              {quizComplete(quiz) ? 'See your interest matches' : 'Take the 2-minute interests questionnaire'}
            </p>
            <p className="muted small">Answer 8 quick questions about how you like to work and we’ll suggest career areas to explore.</p>
          </a>
        )}

        {pw.starting.length > 0 && (
          <PathSection
            icon="compass"
            title={pw.basis === 'industry' && base ? `Starting points in ${sectorLabel(base.cat.sector).toLowerCase()}` : 'Possible starting points'}
            intro="Entry-level and skilled roles you could aim for first."
            items={pw.starting}
            empty=""
          />
        )}

        {base ? sections : null}

        {wantsBusiness && (
          <section>
            <SectionHead icon="sparkle" title="Running your own business" />
            <div className="card stack">
              <p className="muted">
                Many trades and services can lead to self-employment. The National Careers Service mentions it as an option for these careers:
              </p>
              <div className="chips">
                {pw.business.map((s) => (
                  <a className="chip" key={s.slug} href={`#/career/${s.slug}`}>
                    {career(s.slug)?.title}
                  </a>
                ))}
              </div>
              <ul className="list">
                <li>
                  <Ext href={LINKS.setUpBusiness.url}>{LINKS.setUpBusiness.label}</Ext> – legal structures, registering and tax.
                </li>
                <li>
                  <Ext href={LINKS.selfEmployed.url}>{LINKS.selfEmployed.label}</Ext> – what being self-employed involves.
                </li>
              </ul>
            </div>
          </section>
        )}

        {wantsEducation && (
          <section>
            <SectionHead icon="list" title="Further education routes" />
            <div className="card stack">
              <p className="muted">Common ways to build qualifications in the UK. Each career page lists the routes the National Careers Service describes for that role.</p>
              <ul className="list">
                <li>
                  <strong>Apprenticeships</strong> – earn while you learn, from level 2 up to degree level. <Ext href={LINKS.apprenticeships.url}>Find an apprenticeship</Ext>
                </li>
                <li>
                  <strong>T Levels and college courses</strong> – practical level 3 qualifications. <Ext href={LINKS.tlevels.url}>T Levels</Ext> ·{' '}
                  <Ext href={LINKS.feCourses.url}>Further education</Ext>
                </li>
                <li>
                  <strong>Access to HE diploma</strong> – a route into university for adults without A levels. <Ext href={LINKS.accessHe.url}>Access to HE</Ext>
                </li>
                <li>
                  <strong>Higher education</strong> – HNCs, HNDs, foundation degrees and degrees. <Ext href={LINKS.heCourses.url}>Find a course</Ext>
                </li>
              </ul>
              <p className="source">
                Not sure what a level means? <Ext href={LINKS.levels.url}>See what qualification levels mean (GOV.UK)</Ext>.
              </p>
            </div>
          </section>
        )}

        <p className="source" style={{ marginTop: 28 }}>
          Career information from the National Careers Service (England), used under the Open Government Licence v3.0. In Scotland, Wales or Northern Ireland see{' '}
          <Ext href={LINKS.scotland.url}>My World of Work</Ext>, <Ext href={LINKS.wales.url}>Careers Wales</Ext> or <Ext href={LINKS.ni.url}>nidirect</Ext>.
        </p>
      </main>
    </>
  );
}

function SectionHead({ icon, title, count }: { icon: string; title: string; count?: number }) {
  return (
    <div className="section-head">
      <span style={{ color: 'var(--teal)' }}>
        <Icon name={icon} size={22} />
      </span>
      <h2 className="h2">{title}</h2>
      {count !== undefined && <span className="pill">{count}</span>}
    </div>
  );
}

function PathSection({ icon, title, intro, items, empty }: { icon: string; title: string; intro: string; items: Suggestion[]; empty: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 3);
  return (
    <section>
      <SectionHead icon={icon} title={title} count={items.length} />
      <p className="muted small" style={{ marginBottom: 12 }}>
        {intro}
      </p>
      {items.length ? (
        <div className="stack">
          {shown.map((s) => (
            <CareerCard key={s.slug} slug={s.slug} reason={s.reasons[0]} />
          ))}
          {items.length > shown.length && (
            <button className="btn btn-ghost btn-block btn-sm" onClick={() => setAll(true)}>
              Show {items.length - shown.length} more
            </button>
          )}
        </div>
      ) : (
        empty && <p className="card flat small muted">{empty}</p>
      )}
    </section>
  );
}
