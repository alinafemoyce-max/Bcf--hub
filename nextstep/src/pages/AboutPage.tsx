import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ShareSheet } from '../components/ShareSheet';
import { Ext, Idea, Notice, Sheet, TopBar, Typical, Verified, useToast } from '../components/ui';
import { LINKS } from '../data/sources';
import { allSlugs, retrievedOn } from '../lib/data';
import { appUrl, go } from '../state/router';
import { useStore } from '../state/store';
import { formatDate } from './CareerPage';

export default function AboutPage() {
  const { state, reset, canSave } = useStore();
  const toast = useToast();
  const [share, setShare] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const stored = [state.profile ? 'your answers' : '', state.saved.length ? `${state.saved.length} saved careers` : '', Object.keys(state.plans).length ? 'action plan ticks' : '', state.quiz ? 'questionnaire answers' : ''].filter(Boolean);

  return (
    <>
      <TopBar title="More" />
      <main className="page">
        <div className="stack">
          <section className="card stack">
            <h2 className="h3">Share NextStep</h2>
            <p className="small muted">Send the app link to friends or classmates. Everyone who opens it starts their own, separate experience – nothing of yours is included.</p>
            <button className="btn btn-primary btn-block" onClick={() => setShare(true)}>
              <Icon name="share" /> Share app link
            </button>
          </section>

          <section className="card stack">
            <h2 className="h3">Add to your Home Screen</h2>
            <p className="small muted">On iPhone in Safari: tap the Share button, then “Add to Home Screen”. NextStep then opens like an app and works offline.</p>
          </section>

          <section className="card stack" id="privacy">
            <h2 className="h3">Your privacy</h2>
            <ul className="list small">
              <li>No account, no sign-up, no tracking or analytics, no cookies.</li>
              <li>Your answers, saved careers and plan ticks are stored only in this browser on this device.</li>
              <li>
                <strong>They don’t sync between devices.</strong> If you open NextStep on another phone, computer or browser, you’ll start fresh.
              </li>
              <li>Clearing Safari’s website data, or using Private Browsing, will remove your progress.</li>
              <li>Shared links only ever contain a career name – never your answers. You always see exactly what will be shared first.</li>
            </ul>
            <p className="small">
              Stored on this device right now: <strong>{stored.length ? stored.join(', ') : 'nothing'}</strong>.
            </p>
            {!canSave && (
              <Notice tone="amber" icon="alert">
                This browser is blocking storage, so nothing will be kept after you close the page.
              </Notice>
            )}
            <button className="btn btn-danger btn-block" onClick={() => setConfirm(true)}>
              <Icon name="trash" /> Reset and delete my data
            </button>
          </section>

          <section className="card stack">
            <h2 className="h3">How to read NextStep</h2>
            <div className="stack small">
              <p>
                <Verified /> Taken from an official source we checked, such as the National Careers Service or a regulator.
              </p>
              <p>
                <Typical /> A common way into a role. Not the only way, and requirements vary by employer.
              </p>
              <p>
                <Idea /> NextStep’s own illustrative ideas, based on your answers. Not guaranteed promotions, salaries or vacancies.
              </p>
            </div>
          </section>

          <section className="card stack">
            <h2 className="h3">Where the information comes from</h2>
            <p className="small muted">
              Career details for {allSlugs().length} careers come from <Ext href={LINKS.ncsHome.url}>National Careers Service</Ext> job profiles (retrieved {formatDate(retrievedOn())}),
              used under the Open Government Licence v3.0. Regulated requirements were checked against the regulators’ own websites. NextStep adds its own grouping and progression links to build pathways.
            </p>
            <p className="small muted">
              Suggestions are made by simple, transparent rules on this device – not by live AI. Adding AI would need a paid service and a secure server to keep its key private, so it isn’t included in this prototype.
            </p>
            <p className="small muted">
              The National Careers Service covers England. Elsewhere in the UK: <Ext href={LINKS.scotland.url}>My World of Work</Ext> (Scotland), <Ext href={LINKS.wales.url}>Careers Wales</Ext>, and{' '}
              <Ext href={LINKS.ni.url}>nidirect</Ext> (Northern Ireland).
            </p>
          </section>

          <section className="card stack">
            <h2 className="h3">Need to talk to someone?</h2>
            <p className="small muted">
              NextStep is a prototype for exploring ideas, not professional careers guidance. Free advice is available from the <Ext href={LINKS.ncsAdvice.url}>National Careers Service</Ext>, your school or college careers adviser, or your employer.
            </p>
          </section>
          <p className="source">NextStep prototype · v0.1</p>
        </div>
      </main>

      <ShareSheet
        open={share}
        onClose={() => setShare(false)}
        title="Share NextStep"
        text="NextStep – explore where your skills, qualifications and experience could take you. Free, no sign-up."
        url={appUrl()}
        note="This is exactly what will be shared: the app link only. Nothing from your answers is included."
      />
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Delete everything?">
        <div className="stack">
          <p className="muted">This removes your answers, saved careers, action plan ticks and questionnaire answers from this device. It can’t be undone.</p>
          <button
            className="btn btn-danger btn-block"
            onClick={() => {
              reset();
              setConfirm(false);
              toast('Your data has been deleted');
              go('/');
            }}
          >
            Yes, delete my data
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </>
  );
}
