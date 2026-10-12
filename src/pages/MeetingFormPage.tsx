import { useState } from 'react';
import { useActions, useData } from '../state/store';
import { useRouter } from '../state/router';
import { useNotify } from '../components/notify';
import { EmptyState, PageHeader, SelectField, TextArea, TextField } from '../components/ui';
import { MEETING_STATUSES, MEETING_TYPES, type Meeting, type MeetingType } from '../types';
import { hasErrors, validateMeeting, type Errors } from '../lib/validation';
import { addDays, isValidISODate, todayISO } from '../lib/dates';
import { nowISO, uid } from '../lib/ids';

const DEFAULT_TITLE: Record<MeetingType, string> = { 'Pre-BCF': 'Pre-BCF reps catch-up', BCF: 'Business Communication Forum' };

export function MeetingFormPage({ id }: { id?: string }) {
  const { meetings } = useData();
  const actions = useActions();
  const router = useRouter();
  const { runFor } = useNotify();
  const existing = id ? meetings.find((m) => m.id === id) : undefined;

  const [draft, setDraft] = useState<Meeting>(() => {
    if (existing) return existing;
    const qType = router.query.get('type');
    const type: MeetingType = qType === 'BCF' || qType === 'Pre-BCF' ? qType : 'BCF';
    const qDate = router.query.get('date') ?? '';
    return {
      id: uid(),
      type,
      title: DEFAULT_TITLE[type],
      date: isValidISODate(qDate) ? qDate : addDays(todayISO(), 7),
      time: '',
      location: '',
      status: 'Planned',
      attendees: '',
      agenda: [],
      minutes: '',
      notesApproved: false,
      followUps: [],
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
  });
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof Meeting>(k: K, v: Meeting[K]) => setDraft((d) => ({ ...d, [k]: v }));

  if (id && !existing) {
    return (
      <div className="page">
        <PageHeader title="Meeting" back="/meetings" />
        <EmptyState icon="calendar" title="Meeting not found" />
      </div>
    );
  }

  const save = async () => {
    const e = validateMeeting(draft);
    setErrors(e);
    if (hasErrors(e)) return;
    const saved = await runFor(() => actions.saveMeeting({ ...draft, title: draft.title.trim() }), existing ? 'Meeting updated' : 'Meeting scheduled');
    if (saved) router.navigate(`/meetings/${saved.id}`, { replace: true });
  };

  const changeType = (t: MeetingType) => {
    setDraft((d) => ({ ...d, type: t, title: !d.title || Object.values(DEFAULT_TITLE).includes(d.title) ? DEFAULT_TITLE[t] : d.title }));
  };

  return (
    <div className="page">
      <PageHeader
        title={existing ? 'Edit meeting' : 'New meeting'}
        back={existing ? `/meetings/${existing.id}` : '/meetings'}
        actions={
          <button className="btn btn-primary btn-sm" onClick={save}>
            Save
          </button>
        }
      />
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="type-picker" role="radiogroup" aria-label="Meeting type">
          {MEETING_TYPES.map((t) => (
            <button type="button" key={t} role="radio" aria-checked={draft.type === t} className={`type-opt ${draft.type === t ? 'selected' : ''} ${t === 'BCF' ? 'bcf' : 'pre'}`} onClick={() => changeType(t)}>
              <strong>{t === 'BCF' ? 'Formal BCF' : 'Pre-BCF'}</strong>
              <span>{t === 'BCF' ? 'Business Communication Forum with management' : 'Reps prepare points before the forum'}</span>
            </button>
          ))}
        </div>
        <TextField label="Title" required value={draft.title} onChange={(v) => set('title', v)} error={errors.title} maxLength={120} />
        <div className="grid-2">
          <TextField label="Date" type="date" required value={draft.date} onChange={(v) => set('date', v)} error={errors.date} />
          <TextField label="Time" type="time" value={draft.time} onChange={(v) => set('time', v)} error={errors.time} />
        </div>
        <TextField label="Location" value={draft.location} onChange={(v) => set('location', v)} error={errors.location} placeholder="e.g. Training Centre, Room 2" />
        <TextArea label="Attendees" value={draft.attendees} onChange={(v) => set('attendees', v)} rows={2} hint="Roles are usually enough, e.g. “Forum chair, Training Manager, apprentice reps”." />
        {existing && <SelectField label="Status" value={draft.status} onChange={(v) => set('status', v as Meeting['status'])} options={MEETING_STATUSES} />}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => router.back(existing ? `/meetings/${existing.id}` : '/meetings')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {existing ? 'Save changes' : 'Create meeting'}
          </button>
        </div>
      </form>
    </div>
  );
}
