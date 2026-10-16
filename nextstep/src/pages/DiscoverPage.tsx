import { Icon } from '../components/Icon';
import { CareerCard, LinkButton, Notice, Option, Progress, TopBar, sectorEmoji } from '../components/ui';
import { sectorLabel } from '../data/catalog';
import { TAG_PHRASES } from '../lib/engine';
import { QUIZ, quizAnswered, quizHighlights, quizResults } from '../lib/quiz';
import { go, type Route } from '../state/router';
import { useStore } from '../state/store';

export default function DiscoverPage({ route }: { route: Route }) {
  if (route.parts[1] === 'results') return <Results />;
  return <Questions route={route} />;
}

function Questions({ route }: { route: Route }) {
  const { state, setQuiz } = useStore();
  const answers = state.quiz ?? {};
  const n = Math.min(QUIZ.length, Math.max(1, Number(route.query.get('q')) || 1));
  const q = QUIZ[n - 1];
  const chosen = answers[q.id] ?? [];

  const pick = (id: string) => {
    let next: string[];
    if (q.multi) {
      if (id === 'any') next = chosen.includes('any') ? [] : ['any'];
      else next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen.filter((x) => x !== 'any'), id];
    } else next = chosen.includes(id) ? [] : [id];
    setQuiz({ ...answers, [q.id]: next });
    if (!q.multi && next.length) setTimeout(() => go(n < QUIZ.length ? `/discover?q=${n + 1}` : '/discover/results'), 220);
  };
  const advance = () => go(n < QUIZ.length ? `/discover?q=${n + 1}` : '/discover/results');

  return (
    <>
      <TopBar title={`Interests ${n} of ${QUIZ.length}`} backTo={n > 1 ? `/discover?q=${n - 1}` : '/'} />
      <main className="page no-tabs">
        <div className="stack-lg">
          <Progress value={(n / QUIZ.length) * 100} label={`Question ${n} of ${QUIZ.length}`} />
          {n === 1 && (
            <Notice>
              This is a quick way to spark ideas – not a scientific aptitude or personality test. There are no right or wrong answers.
            </Notice>
          )}
          <div className="stack" style={{ gap: 6 }}>
            <h1 className="h1" style={{ fontSize: 'clamp(24px, 6.4vw, 32px)' }}>
              {q.title}
            </h1>
            {q.hint && <p className="muted">{q.hint}</p>}
          </div>
          <div className="options" role={q.multi ? 'group' : 'radiogroup'} aria-label={q.title}>
            {q.options.map((o) => (
              <Option key={o.id} multi={q.multi} emoji={o.emoji} title={o.label} on={chosen.includes(o.id)} onClick={() => pick(o.id)} />
            ))}
          </div>
          <div className="stack">
            <button className="btn btn-primary btn-block" onClick={advance}>
              {n < QUIZ.length ? 'Next' : 'See my matches'} <Icon name="arrowRight" />
            </button>
            {!chosen.length && (
              <button className="btn btn-ghost btn-block" onClick={advance}>
                Skip this question
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function Results() {
  const { state, setQuiz } = useStore();
  const answers = state.quiz;
  const answered = quizAnswered(answers);

  if (!answers || answered === 0) {
    return (
      <>
        <TopBar title="Your interests" backTo="/explore" />
        <main className="page">
          <div className="stack">
            <h1 className="h2">You haven’t answered any questions yet</h1>
            <LinkButton to="/discover?q=1" kind="primary" block>
              Start the questionnaire
            </LinkButton>
          </div>
        </main>
      </>
    );
  }

  const results = quizResults(answers).slice(0, 4);
  const highlights = quizHighlights(answers, TAG_PHRASES);

  return (
    <>
      <TopBar title="Your interests" backTo="/explore" />
      <main className="page">
        <div className="stack">
          <p className="eyebrow">Career areas to explore</p>
          <h1 className="h1">Here’s where your interests point</h1>
          {highlights.length > 0 && (
            <p className="lead">
              You said you enjoy <strong>{highlights.join(', ')}</strong>.
            </p>
          )}
          {answered < QUIZ.length && (
            <Notice tone="amber" icon="alert">
              You answered {answered} of {QUIZ.length} questions, so these matches are rougher. <a href="#/discover?q=1">Answer the rest</a>
            </Notice>
          )}
        </div>

        {results.map((r, i) => (
          <section key={r.sector} style={{ marginTop: 24 }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 26 }} aria-hidden="true">
                {sectorEmoji(r.sector)}
              </span>
              <h2 className="h2" style={{ flex: 1 }}>
                {sectorLabel(r.sector)}
              </h2>
              {i === 0 && <span className="pill" style={{ color: 'var(--teal)' }}>Top match</span>}
            </div>
            <div className="stack">
              {r.careers.slice(0, 3).map((s) => (
                <CareerCard key={s} slug={s} />
              ))}
            </div>
          </section>
        ))}

        <div className="stack" style={{ marginTop: 24 }}>
          <Notice>
            These are areas to explore, based only on your answers – not a scientific assessment. For a more detailed assessment, try the free{' '}
            <a href="https://nationalcareers.service.gov.uk/discover-your-skills-and-careers" target="_blank" rel="noopener noreferrer">
              National Careers Service skills assessment
            </a>
            .
          </Notice>
          {state.profile ? (
            <LinkButton to="/paths" kind="primary" block>
              See my personalised pathways
            </LinkButton>
          ) : (
            <LinkButton to="/start" kind="primary" block>
              Add your details for personalised pathways
            </LinkButton>
          )}
          <LinkButton to="/explore" block>
            Browse all careers
          </LinkButton>
          <button
            className="btn btn-ghost btn-block"
            onClick={() => {
              setQuiz(null);
              go('/discover?q=1');
            }}
          >
            Retake the questionnaire
          </button>
        </div>
      </main>
    </>
  );
}
