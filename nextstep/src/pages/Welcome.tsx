import { BrandMark, Icon } from '../components/Icon';
import { InstallTip } from '../components/InstallTip';
import { LinkButton, Notice } from '../components/ui';
import { useStore } from '../state/store';

export default function Welcome() {
  const { state, canSave } = useStore();
  const returning = !!state.profile;
  return (
    <main className="page no-tabs" style={{ paddingTop: 'calc(var(--safe-t) + 20px)' }}>
      <div className="stack-lg">
        <div className="row" style={{ gap: 10 }}>
          <BrandMark size={40} />
          <span style={{ font: '700 22px/1 var(--font-display)', letterSpacing: '-0.01em' }}>NextStep</span>
        </div>

        <InstallTip />

        <section className="hero stack">
          <p className="eyebrow">UK career pathways</p>
          <h1 className="h1">
            Your future <span className="grad-text">starts here.</span>
          </h1>
          <p className="lead">See where your skills, qualifications and experience could take you – up, across, or into a whole new industry.</p>
          <div className="stack" style={{ paddingTop: 8 }}>
            {returning ? (
              <>
                <LinkButton to="/paths" kind="primary" block>
                  Continue to my paths <Icon name="arrowRight" />
                </LinkButton>
                <LinkButton to="/start" block>
                  Update my answers
                </LinkButton>
              </>
            ) : (
              <LinkButton to="/start" kind="primary" block>
                Get started – about 2 minutes <Icon name="arrowRight" />
              </LinkButton>
            )}
            <LinkButton to="/discover" block>
              Not sure yet? Explore your interests
            </LinkButton>
          </div>
        </section>

        <section className="stack">
          <h2 className="h3">What you can do</h2>
          <div className="grid-2">
            {[
              ['🧭', 'Personal pathways', 'Upward, sideways and cross-industry ideas based on your answers.'],
              ['🗺️', 'Career maps', 'Tap through the steps to a role and compare different routes.'],
              ['✅', 'Action plans', 'Practical steps for this month and beyond. Tick them off as you go.'],
              ['🇬🇧', 'Real UK information', 'Career details from the National Careers Service, with sources.']
            ].map(([e, t, d]) => (
              <div className="card tight row" key={t} style={{ alignItems: 'flex-start' }}>
                <span style={{ fontSize: 24 }} aria-hidden="true">
                  {e}
                </span>
                <div>
                  <p className="h3">{t}</p>
                  <p className="small muted">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Notice icon="lock">
          <strong>No account needed.</strong> Your answers stay on this device only and are never sent anywhere.{' '}
          {canSave ? 'They won’t sync to your other devices, and Safari may clear them if you don’t open NextStep for a while – adding it to your Home Screen avoids that.' : 'Your browser is blocking storage (for example in Private Browsing), so progress won’t be saved after you close this page.'}{' '}
          <a href="#/about">Privacy and reset</a>
        </Notice>

        <p className="source">
          A prototype for exploring ideas, not professional careers advice. For free, personal advice in England, speak to the{' '}
          <a href="https://nationalcareers.service.gov.uk/help-and-support" target="_blank" rel="noopener noreferrer">
            National Careers Service
          </a>
          .
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <a className="chip" href="#/explore">
            Browse all careers
          </a>
          <a className="chip" href="#/about">
            About and privacy
          </a>
        </div>
      </div>
    </main>
  );
}
