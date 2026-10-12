import { PageHeader, Section, Card } from '../components/ui';
import { Icon } from '../components/Icon';

const APPROVALS: [string, string][] = [
  ['Sponsor approval', 'Agreement from the apprenticeship/HR lead and the BCF chair that a digital tool may be used for representative work, and on what terms.'],
  ['IT & information security review', 'Assessment by the company IT team, including whether a personal device and a self-hosted web app are acceptable at all.'],
  ['Data protection (UK GDPR)', 'A Data Protection Impact Assessment, a lawful basis for processing, a retention schedule and a privacy notice explaining to apprentices how their feedback is recorded.'],
  ['Approved platform', 'Real use would most likely move to a company-managed platform (for example Microsoft 365 / SharePoint / Power Apps) with company sign-in, rather than local browser storage.'],
  ['Access control', 'Company single sign-on, role-based access for other reps, and removal of access when a rep steps down.'],
  ['Device security', 'Managed or approved device, passcode/Face ID, device encryption, and a plan for lost or stolen phones.'],
  ['Encrypted backups', 'Backups stored in an approved, access-controlled location — not personal cloud drives or email.'],
  ['Audit & retention', 'Audit trail of changes, defined retention periods and a deletion process for closed issues and feedback.'],
  ['Communications sign-off', 'Agreement on who approves Teams updates before they are posted.'],
  ['Brand & naming', 'Permission before using any company name, logo or branding in the app.']
];

export function AboutPage() {
  return (
    <div className="page">
      <PageHeader title="Privacy & security" back="/more" />
      <div className="page-intro">
        <h1>Privacy, security & approval</h1>
        <p className="muted">How BCF Hub handles information, and what would be needed before real workplace use.</p>
      </div>

      <div className="alert alert-warning" role="note">
        <Icon name="shield" size={18} />
        <div>
          <strong>Personal prototype.</strong> BCF Hub isn’t an authorised, official or endorsed Sunseeker International system. Use fictional data until the approvals below are in place.
        </div>
      </div>

      <Section title="How your data is handled">
        <Card>
          <ul className="check-list">
            <li><Icon name="check" size={16} /> All records are stored only in this browser’s local database (IndexedDB) on this device.</li>
            <li><Icon name="check" size={16} /> No accounts, servers, cloud sync, analytics, trackers or third-party fonts. The app makes no network requests for your data.</li>
            <li><Icon name="check" size={16} /> Nothing is posted to Microsoft Teams. You copy approved text and post it yourself.</li>
            <li><Icon name="check" size={16} /> PDFs and backups are created on the device and only leave it if you choose to share or save them.</li>
            <li><Icon name="check" size={16} /> A strict Content Security Policy blocks scripts and connections to other sites.</li>
            <li><Icon name="info" size={16} /> Local data isn’t encrypted by the app. Anyone who can unlock this device and open the app can read it.</li>
            <li><Icon name="info" size={16} /> Clearing Safari website data, or deleting the Home Screen app, deletes the data. Export backups regularly.</li>
          </ul>
        </Card>
      </Section>

      <Section title="Please don’t record">
        <Card>
          <ul className="dont-list">
            <li>Names, clock numbers or contact details of apprentices or staff</li>
            <li>Complaints that identify an individual, or grievance/disciplinary matters</li>
            <li>Health, medical or other special-category information</li>
            <li>Confidential business information, internal minutes or commercially sensitive details</li>
          </ul>
          <p className="small muted">BCF Hub warns you if text looks like it contains an email address, phone number or employee number.</p>
        </Card>
      </Section>

      <Section title="Needed before real workplace use">
        <ol className="approval-list">
          {APPROVALS.map(([t, d], i) => (
            <li key={t} className="card">
              <span className="approval-num">{i + 1}</span>
              <div>
                <p className="row-title">{t}</p>
                <p className="small muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Install on iPhone">
        <Card>
          <ol className="steps">
            <li>Open BCF Hub in <strong>Safari</strong>.</li>
            <li>
              Tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.
            </li>
            <li>Open BCF Hub from the new Home Screen icon. It runs full-screen and works offline.</li>
          </ol>
          <p className="small muted">Data in the Home Screen app is separate from data in Safari tabs. Use the same one consistently, and use Export/Restore to move data.</p>
        </Card>
      </Section>
    </div>
  );
}
