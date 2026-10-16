import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Option, Progress, TopBar, useToast } from '../components/ui';
import { SECTORS, sectorLabel } from '../data/catalog';
import { career } from '../lib/data';
import { matchRole } from '../lib/engine';
import { EXPERIENCE, INTERESTS, QUALS, STATUSES } from '../lib/options';
import type { Profile, QualId, StatusId } from '../lib/types';
import { go, type Route } from '../state/router';
import { useStore } from '../state/store';

const blank = (): Profile => ({ quals: {}, interests: [] });
const TOTAL = 6;

const roleQuestion = (s?: StatusId) =>
  ({
    school: { q: 'What are you studying at school?', hint: 'For example GCSEs, A levels or a subject you enjoy. A job or work experience is fine too.', ph: 'e.g. A levels, GCSE design and technology' },
    college: { q: 'What course are you studying?', hint: 'Type your course name – we’ll try to match it to a career area.', ph: 'e.g. Level 2 carpentry, health and social care' },
    apprentice: { q: 'What is your apprenticeship?', hint: 'Your apprenticeship title or the job you’re training for.', ph: 'e.g. Boatbuilder, electrician, business admin' },
    employed: { q: 'What is your current job?', hint: 'Your job title, or describe what you do.', ph: 'e.g. Laminator, warehouse operative, chef' },
    'self-employed': { q: 'What work do you do?', hint: 'Your trade or the service you offer.', ph: 'e.g. Plumber, personal trainer, bookkeeper' },
    looking: { q: 'What was your most recent job or course?', hint: 'Or the kind of work you’ve done before.', ph: 'e.g. Retail assistant, care worker' },
    changing: { q: 'What is your current or most recent job?', hint: 'We’ll look for skills that could transfer.', ph: 'e.g. Admin assistant, carpenter' }
  })[s ?? 'employed'] ?? { q: 'What is your current job, course or apprenticeship?', hint: '', ph: 'e.g. Boat builder' };

export default function Onboarding({ route }: { route: Route }) {
  const { state, setProfile } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<Profile>(() => state.profile ?? blank());
  const step = Math.min(TOTAL, Math.max(1, Number(route.query.get('q')) || 1));
  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));

  const next = () => {
    setProfile(draft); // save progress after every question
    if (step < TOTAL) go(`/start?q=${step + 1}`);
    else {
      toast('Your pathways are ready');
      go('/paths');
    }
  };
  const skip = (patch: Partial<Profile>) => {
    setDraft((d) => {
      const nd = { ...d, ...patch };
      setProfile(nd);
      return nd;
    });
    if (step < TOTAL) go(`/start?q=${step + 1}`);
    else go('/paths');
  };

  return (
    <>
      <TopBar title={`Question ${step} of ${TOTAL}`} backTo={step > 1 ? `/start?q=${step - 1}` : '/'} />
      <main className="page no-tabs">
        <div className="stack-lg">
          <Progress value={(step / TOTAL) * 100} label={`Question ${step} of ${TOTAL}`} />
          {step === 1 && <StatusStep draft={draft} set={set} />}
          {step === 2 && <RoleStep draft={draft} set={set} />}
          {step === 3 && <IndustryStep draft={draft} set={set} />}
          {step === 4 && <QualStep draft={draft} set={set} />}
          {step === 5 && <ExperienceStep draft={draft} set={set} />}
          {step === 6 && <InterestStep draft={draft} set={set} />}
          <div className="stack">
            <button className="btn btn-primary btn-block" onClick={next}>
              {step < TOTAL ? 'Next' : 'See my pathways'} <Icon name="arrowRight" />
            </button>
            <button
              className="btn btn-ghost btn-block"
              onClick={() =>
                skip(
                  [
                    { status: undefined },
                    { role: undefined, roleSlug: null },
                    { industry: undefined },
                    { quals: {}, qualOther: undefined },
                    { experience: undefined },
                    { interests: [] }
                  ][step - 1]
                )
              }
            >
              Skip this question
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

type StepProps = { draft: Profile; set: (p: Partial<Profile>) => void };

function Q({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <h2 className="h1" style={{ fontSize: 'clamp(24px, 6.4vw, 32px)' }}>
        {title}
      </h2>
      {hint && <p className="muted">{hint}</p>}
    </div>
  );
}

function StatusStep({ draft, set }: StepProps) {
  return (
    <>
      <Q title="What best describes you?" />
      <div className="options" role="radiogroup" aria-label="What best describes you?">
        {STATUSES.map((s) => (
          <Option key={s.id} title={s.label} hint={s.hint} on={draft.status === s.id} onClick={() => set({ status: draft.status === s.id ? undefined : s.id })} />
        ))}
      </div>
    </>
  );
}

function RoleStep({ draft, set }: StepProps) {
  const rq = roleQuestion(draft.status);
  const [text, setText] = useState(draft.role ?? '');
  const matches = useMemo(() => matchRole(text, 4), [text]);
  const [chosen, setChosen] = useState<string | null | undefined>(draft.roleSlug);

  // Auto-pick a confident match unless the user has chosen something themselves.
  const [touched, setTouched] = useState(draft.roleSlug !== undefined && draft.roleSlug !== null);
  useEffect(() => {
    const auto = !touched ? (matches[0] && matches[0].score >= 45 ? matches[0].slug : null) : chosen;
    if (!touched) setChosen(auto);
    set({ role: text.trim() || undefined, roleSlug: (touched ? chosen : auto) ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, matches, chosen, touched]);

  const pick = (slug: string | null) => {
    setTouched(true);
    setChosen(slug);
  };

  return (
    <>
      <Q title={rq.q} hint={rq.hint} />
      <label className="field">
        <span className="sr-only">{rq.q}</span>
        <input
          className="input"
          value={text}
          maxLength={120}
          placeholder={rq.ph}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="next"
          onChange={(e) => {
            setText(e.target.value);
            setTouched(false);
          }}
        />
      </label>
      {text.trim().length >= 2 && (
        <div className="suggest stack" aria-live="polite">
          {matches.length ? (
            <>
              <p className="small muted">Which is closest? This helps us find realistic next steps.</p>
              <div className="chips">
                {matches.map((m) => (
                  <button key={m.slug} type="button" className={`chip${chosen === m.slug ? ' on' : ''}`} aria-pressed={chosen === m.slug} onClick={() => pick(chosen === m.slug ? null : m.slug)}>
                    {chosen === m.slug && <Icon name="check" size={16} />}
                    {career(m.slug)?.title}
                  </button>
                ))}
                <button type="button" className={`chip${chosen === null && touched ? ' on' : ''}`} onClick={() => pick(null)}>
                  None of these
                </button>
              </div>
            </>
          ) : (
            <p className="small muted">
              We couldn’t match that to a career in our starter dataset yet. That’s fine – we’ll use your industry and interests instead.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function IndustryStep({ draft, set }: StepProps) {
  const suggested = career(draft.roleSlug)?.cat.sector;
  useEffect(() => {
    if (!draft.industry && suggested) set({ industry: suggested });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <Q title="Which industry are you in?" hint={suggested ? `We’ve suggested ${sectorLabel(suggested)} from your answer – change it if that’s not right.` : 'Choose the closest, if it applies to you.'} />
      <div className="chips" role="radiogroup" aria-label="Industry">
        {SECTORS.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={draft.industry === s.id} className={`chip${draft.industry === s.id ? ' on' : ''}`} onClick={() => set({ industry: draft.industry === s.id ? undefined : s.id })}>
            <span aria-hidden="true">{s.emoji}</span> {s.label}
          </button>
        ))}
        <button type="button" role="radio" aria-checked={draft.industry === 'none'} className={`chip${draft.industry === 'none' ? ' on' : ''}`} onClick={() => set({ industry: draft.industry === 'none' ? undefined : 'none' })}>
          Not in an industry yet / not sure
        </button>
      </div>
    </>
  );
}

function QualStep({ draft, set }: StepProps) {
  const setQual = (id: QualId, v: 'done' | 'studying' | null) => {
    const quals = { ...draft.quals };
    if (v) quals[id] = v;
    else delete quals[id];
    set({ quals });
  };
  return (
    <>
      <Q title="What qualifications do you have, or are you studying?" hint="Mark each one as completed or studying now. Leave anything that doesn’t apply." />
      <div className="options">
        {QUALS.map((q) => {
          const v = draft.quals[q.id];
          return (
            <div key={q.id} className={`qual-row${v ? ' on' : ''}`}>
              <span style={{ fontWeight: 600 }} id={`q-${q.id}`}>
                {q.label}
              </span>
              <div className="seg" role="group" aria-labelledby={`q-${q.id}`}>
                <button type="button" className={v === 'done' ? 'on' : ''} aria-pressed={v === 'done'} onClick={() => setQual(q.id, v === 'done' ? null : 'done')}>
                  Completed
                </button>
                <button type="button" className={v === 'studying' ? 'on' : ''} aria-pressed={v === 'studying'} onClick={() => setQual(q.id, v === 'studying' ? null : 'studying')}>
                  Studying now
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <label className="field">
        <span className="field-label">Anything else? (optional)</span>
        <input className="input" value={draft.qualOther ?? ''} maxLength={120} placeholder="e.g. Level 2 food hygiene, driving licence" onChange={(e) => set({ qualOther: e.target.value || undefined })} />
      </label>
    </>
  );
}

function ExperienceStep({ draft, set }: StepProps) {
  return (
    <>
      <Q title="How much relevant experience do you have?" hint="Count work, apprenticeship time and placements in your current field." />
      <div className="options" role="radiogroup" aria-label="Experience">
        {EXPERIENCE.map((x) => (
          <Option key={x.id} title={x.label} on={draft.experience === x.id} onClick={() => set({ experience: draft.experience === x.id ? undefined : x.id })} />
        ))}
      </div>
    </>
  );
}

function InterestStep({ draft, set }: StepProps) {
  const toggle = (id: Profile['interests'][number]) => set({ interests: draft.interests.includes(id) ? draft.interests.filter((i) => i !== id) : [...draft.interests, id] });
  return (
    <>
      <Q title="What interests you?" hint="Choose as many as you like." />
      <div className="options" role="group" aria-label="Interests">
        {INTERESTS.map((i) => (
          <Option key={i.id} multi emoji={i.emoji} title={i.label} on={draft.interests.includes(i.id)} onClick={() => toggle(i.id)} />
        ))}
      </div>
    </>
  );
}
