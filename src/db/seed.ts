// Fictional demonstration data. Every record is flagged `demo: true` so it can be cleared in one step.
// None of this content describes real people, real complaints or real Sunseeker business matters.
import type { ActivityLog, AppData, CommsUpdate, Feedback, HistoryEntry, Issue, IssueStatus, Meeting, Priority, Template, WeeklyPlan } from '../types';
import { DONE_STATUSES } from '../types';
import { addDays, formatDate, startOfWeek } from '../lib/dates';
import { formatIssueRef, uid } from '../lib/ids';

const at = (iso: string, hour = 10) => new Date(`${iso}T${String(hour).padStart(2, '0')}:15:00`).toISOString();

interface IssueSeed {
  key: string;
  raised: number; // days ago
  title: string;
  description: string;
  department: string;
  category: string;
  priority: Priority;
  status: IssueStatus;
  response?: string;
  owner?: string;
  followUp?: number; // offset from today
  resolution?: string;
  resolvedAgo?: number;
  archived?: boolean;
}

const ISSUE_SEEDS: IssueSeed[] = [
  {
    key: 'ppe', raised: 41, title: 'Replacement gloves running out mid-shift', description: 'Apprentices report the nitrile glove dispenser near the resin area is often empty by early afternoon, meaning trips to stores during lay-up.', department: 'Lamination', category: 'Health & Safety', priority: 'High', status: 'Resolved',
    response: 'Stores team to move to twice-daily restock of PPE points in Lamination. Trial for four weeks.', owner: 'Stores Team Leader', resolution: 'Twice-daily restock in place. No further reports in follow-up check with apprentices.', resolvedAgo: 12
  },
  {
    key: 'college', raised: 33, title: 'College day clashes with Friday overtime rota', description: 'Some second-year apprentices are being listed on the Friday overtime rota when they are scheduled for college, causing confusion about where they should be.', department: 'Hull & Deck Assembly', category: 'Pay, Hours & Rotas', priority: 'High', status: 'Awaiting Response',
    owner: 'Production Planning Lead', followUp: -3
  },
  {
    key: 'mentor', raised: 27, title: 'Mentor check-ins not happening consistently', description: 'Several first-years say their monthly mentor check-in has slipped for two months running. They would like a reliable slot even if it is short.', department: 'Joinery', category: 'Mentoring & Support', priority: 'Medium', status: 'In Progress',
    response: 'Apprentice Coordinator to publish a check-in calendar and remind mentors at the monthly supervisors briefing.', owner: 'Apprentice Coordinator', followUp: 4
  },
  {
    key: 'canteen', raised: 22, title: 'Microwave queue at lunch in east welfare block', description: 'Only two microwaves serve the east welfare block. Apprentices on the later lunch break report losing 10–15 minutes queuing.', department: 'Paint & Finishing', category: 'Welfare & Facilities', priority: 'Low', status: 'Raised with Management',
    owner: 'Facilities Lead', followUp: 2
  },
  {
    key: 'tools', raised: 19, title: 'Shared torque wrench frequently out for calibration', description: 'The single torque wrench issued to the apprentice bay is regularly away for calibration, so tasks are paused or borrowed tools are used.', department: 'Mechanical & Engineering', category: 'Tools & Equipment', priority: 'Medium', status: 'Under Review',
    owner: 'Apprentice Rep', followUp: 1
  },
  {
    key: 'portfolio', raised: 16, title: 'Time to update e-portfolio during work hours', description: 'Apprentices would like clarity on whether time can be allocated during the working week to update their e-portfolio evidence.', department: 'Training Centre', category: 'College & Off-the-Job Learning', priority: 'Medium', status: 'Awaiting Response',
    owner: 'Training Manager', followUp: -1
  },
  {
    key: 'noticeboard', raised: 12, title: 'Apprentice noticeboard out of date', description: 'The apprentice noticeboard by the training centre still shows last quarter’s information. Suggest moving key notices to the Teams channel as well.', department: 'Training Centre', category: 'Communication', priority: 'Low', status: 'New',
    followUp: 6
  },
  {
    key: 'ventilation', raised: 9, title: 'Ventilation in small spray booth feels weak', description: 'Two apprentices mentioned the extraction in the small spray booth seems weaker than usual. Raised for a check rather than a confirmed fault.', department: 'Paint & Finishing', category: 'Health & Safety', priority: 'High', status: 'New',
    followUp: 0
  },
  {
    key: 'induction', raised: 58, title: 'Induction pack missing shed-specific safety info', description: 'New starters said the induction pack covers site rules but not the specific hazards of the shed they join.', department: 'Electrical', category: 'Training & Development', priority: 'Medium', status: 'Closed',
    response: 'H&S Advisor and supervisors to add a one-page shed safety sheet to each induction pack.', owner: 'H&S Advisor', resolution: 'Shed safety sheets added for all production areas. Confirmed with latest intake.', resolvedAgo: 30
  },
  {
    key: 'parking', raised: 70, title: 'Bike storage near north gate', description: 'Apprentices who cycle asked for covered bike storage closer to the north gate.', department: 'Stores & Logistics', category: 'Welfare & Facilities', priority: 'Low', status: 'Closed',
    response: 'Not possible this year due to site works. Will be reconsidered in next facilities plan.', owner: 'Facilities Lead', resolution: 'Management explained constraint; apprentices informed via Teams. Closed with agreement to revisit next year.', resolvedAgo: 45, archived: true
  },
  {
    key: 'cad', raised: 6, title: 'CAD software licences for design apprentices', description: 'Design Office apprentices sometimes wait for a licence to become free before they can continue training exercises.', department: 'Design Office', category: 'Tools & Equipment', priority: 'Medium', status: 'Raised with Management',
    owner: 'Design Office Manager', followUp: 8
  },
  {
    key: 'feedbackloop', raised: 4, title: 'Apprentices unsure what happens after BCF', description: 'Feedback suggests apprentices don’t always hear the outcome of points raised at BCF. Proposal: a short summary in Teams after every meeting.', department: 'Training Centre', category: 'Communication', priority: 'Medium', status: 'In Progress',
    response: 'Agreed in principle. Rep to draft summaries for approval before posting.', owner: 'Apprentice Rep', followUp: 3
  }
];

interface FeedbackSeed { ago: number; department: string; category: string; description: string; link?: string }

const FEEDBACK_SEEDS: FeedbackSeed[] = [
  { ago: 44, department: 'Lamination', category: 'Health & Safety', description: 'Glove dispenser by the resin bench empty again after lunch.', link: 'ppe' },
  { ago: 42, department: 'Lamination', category: 'Health & Safety', description: 'Had to go to stores twice for gloves during lay-up this week.', link: 'ppe' },
  { ago: 34, department: 'Hull & Deck Assembly', category: 'Pay, Hours & Rotas', description: 'Put on the Friday overtime rota but it is my college day.', link: 'college' },
  { ago: 30, department: 'Hull & Deck Assembly', category: 'Pay, Hours & Rotas', description: 'Rota for Friday overtime doesn’t take college days into account.', link: 'college' },
  { ago: 28, department: 'Joinery', category: 'Mentoring & Support', description: 'Haven’t had a mentor check-in for about two months.', link: 'mentor' },
  { ago: 18, department: 'Joinery', category: 'Mentoring & Support', description: 'Mentor meetings keep getting moved because of production deadlines.' },
  { ago: 17, department: 'Training Centre', category: 'College & Off-the-Job Learning', description: 'Not clear if we can do e-portfolio updates in work time or only at home.', link: 'portfolio' },
  { ago: 11, department: 'Electrical', category: 'College & Off-the-Job Learning', description: 'Would be useful to have protected time for e-portfolio evidence each month.' },
  { ago: 10, department: 'Paint & Finishing', category: 'Health & Safety', description: 'Extraction in the small spray booth seems weaker than normal.', link: 'ventilation' },
  { ago: 8, department: 'Paint & Finishing', category: 'Welfare & Facilities', description: 'Microwave queue on late lunch is long, lose a lot of the break.' },
  { ago: 5, department: 'Training Centre', category: 'Communication', description: 'Never really find out what happened with things raised at the forum.', link: 'feedbackloop' },
  { ago: 2, department: 'Mechanical & Engineering', category: 'Tools & Equipment', description: 'Torque wrench away for calibration again so had to wait to finish the job.' }
];

export function buildDemoData(today: string, startNumber: number): { data: Omit<AppData, 'settings'>; nextIssueNumber: number } {
  let n = startNumber;
  const keyToId = new Map<string, string>();
  const activity: ActivityLog[] = [];
  const log = (atTs: string, entity: ActivityLog['entity'], entityId: string, kind: ActivityLog['kind'], text: string) =>
    activity.push({ id: uid(), at: atTs, entity, entityId, kind, text, demo: true });

  const issues: Issue[] = ISSUE_SEEDS.map((s) => {
    const id = uid();
    keyToId.set(s.key, id);
    const ref = formatIssueRef(n++);
    const raised = addDays(today, -s.raised);
    const history: HistoryEntry[] = [{ id: uid(), at: at(raised, 9), kind: 'created', text: `Issue logged from apprentice feedback` }];
    const steps: IssueStatus[] = ['New', 'Under Review', 'Raised with Management', 'Awaiting Response', 'In Progress', 'Resolved', 'Closed'];
    const target = steps.indexOf(s.status);
    const span = s.resolvedAgo !== undefined ? s.raised - s.resolvedAgo : Math.max(1, s.raised - 1);
    for (let k = 1; k <= target; k++) {
      const day = addDays(raised, Math.min(span, Math.round((span * k) / Math.max(target, 1))));
      history.push({ id: uid(), at: at(day, 9 + k), kind: DONE_STATUSES.includes(steps[k]) ? 'resolved' : 'status', text: `Status changed from ${steps[k - 1]} to ${steps[k]}` });
      if (steps[k] === 'In Progress' && s.response) history.push({ id: uid(), at: at(day, 9 + k), kind: 'response', text: `Management response recorded: “${s.response}”` });
    }
    if (s.response && target >= 3 && !history.some((h) => h.kind === 'response')) {
      history.splice(history.length - 1, 0, { id: uid(), at: at(addDays(raised, Math.max(1, span - 1)), 11), kind: 'response', text: `Management response recorded: “${s.response}”` });
    }
    if (s.followUp !== undefined) history.push({ id: uid(), at: at(addDays(today, -1), 16), kind: 'followup', text: `Next follow-up set to ${formatDate(addDays(today, s.followUp))}` });
    if (s.archived) history.push({ id: uid(), at: at(addDays(today, -40), 12), kind: 'archived', text: 'Issue archived' });
    history.sort((a, b) => a.at.localeCompare(b.at));
    const resolvedAt = s.resolvedAgo !== undefined ? at(addDays(today, -s.resolvedAgo), 15) : undefined;
    log(at(raised, 9), 'issue', id, 'created', `${ref} raised: ${s.title}`);
    if (resolvedAt) log(resolvedAt, 'issue', id, 'resolved', `${ref} marked ${s.status.toLowerCase()}`);
    return {
      id, ref, dateRaised: raised, title: s.title, description: s.description, department: s.department, category: s.category,
      priority: s.priority, status: s.status, managementResponse: s.response ?? '', actionOwner: s.owner ?? '',
      nextFollowUp: s.followUp !== undefined && !DONE_STATUSES.includes(s.status) ? addDays(today, s.followUp) : '',
      resolutionNotes: s.resolution ?? '', resolvedAt, archived: !!s.archived, history,
      createdAt: at(raised, 9), updatedAt: history[history.length - 1].at, demo: true
    };
  });
  const iid = (k: string) => keyToId.get(k)!;

  const feedback: Feedback[] = FEEDBACK_SEEDS.map((f) => {
    const d = addDays(today, -f.ago);
    const id = uid();
    log(at(d, 13), 'feedback', id, 'feedback', `Feedback logged — ${f.category} (${f.department})`);
    return { id, dateReceived: d, department: f.department, category: f.category, description: f.description, linkedIssueId: f.link ? iid(f.link) : undefined, createdAt: at(d, 13), updatedAt: at(d, 13), demo: true };
  });

  const pastBcf = addDays(today, -14);
  const pastPre = addDays(today, -21);
  const nextPre = addDays(today, 3);
  const nextBcf = addDays(today, 10);
  const meetings: Meeting[] = [
    {
      id: uid(), type: 'Pre-BCF', title: 'Pre-BCF reps catch-up', date: pastPre, time: '12:30', location: 'Training Centre, Room 2', status: 'Completed',
      attendees: 'Apprentice reps (4), Apprentice Coordinator', minutes: 'Reviewed new feedback. Agreed top three points for the forum: PPE restocking, college/rota clash and mentor check-ins.', notesApproved: true,
      agenda: [
        { id: uid(), title: 'Review feedback since last forum', presenterNotes: '11 pieces of feedback logged across 6 areas.', managementResponse: '', decision: 'Prioritise PPE, rota clash and mentoring for BCF.' },
        { id: uid(), title: 'Replacement gloves running out mid-shift', issueId: iid('ppe'), presenterNotes: 'Two reports in one week.', managementResponse: '', decision: 'Take to BCF as high priority.' }
      ],
      followUps: [{ id: uid(), text: 'Send agreed BCF points to forum chair', done: true, dueDate: addDays(pastPre, 2) }],
      createdAt: at(addDays(pastPre, -5)), updatedAt: at(pastPre, 15), demo: true
    },
    {
      id: uid(), type: 'BCF', title: 'Business Communication Forum', date: pastBcf, time: '14:00', location: 'Main Office, Boardroom', status: 'Completed',
      attendees: 'Forum chair, HR Business Partner, Production Manager, Training Manager, Apprentice reps', minutes: 'Forum reviewed three apprentice points. Actions agreed as recorded against each agenda item.', notesApproved: true,
      agenda: [
        { id: uid(), title: 'Replacement gloves running out mid-shift', issueId: iid('ppe'), presenterNotes: 'Repeated reports from Lamination.', managementResponse: 'Stores team to move to twice-daily restock of PPE points in Lamination. Trial for four weeks.', decision: 'Trial twice-daily restock; review in four weeks.' },
        { id: uid(), title: 'College day clashes with Friday overtime rota', issueId: iid('college'), presenterNotes: 'Two apprentices affected last month.', managementResponse: 'Production Planning to review how college days are shown on the rota.', decision: 'Planning lead to respond before next forum.' },
        { id: uid(), title: 'Mentor check-ins not happening consistently', issueId: iid('mentor'), presenterNotes: 'Joinery first-years mainly.', managementResponse: 'Apprentice Coordinator to publish a check-in calendar and remind mentors at the monthly supervisors briefing.', decision: 'Coordinator to circulate calendar.', actionIssueId: undefined }
      ],
      followUps: [
        { id: uid(), text: 'Post forum summary in apprentice Teams channel', done: true, dueDate: addDays(pastBcf, 2) },
        { id: uid(), text: 'Chase Planning lead for rota response', done: false, dueDate: addDays(today, -3) },
        { id: uid(), text: 'Check PPE restock trial with Lamination apprentices', done: false, dueDate: addDays(today, 5) }
      ],
      createdAt: at(addDays(pastBcf, -7)), updatedAt: at(pastBcf, 17), demo: true
    },
    {
      id: uid(), type: 'Pre-BCF', title: 'Pre-BCF reps catch-up', date: nextPre, time: '12:30', location: 'Training Centre, Room 2', status: 'Planned',
      attendees: 'Apprentice reps, Apprentice Coordinator', minutes: '', notesApproved: false,
      agenda: [
        { id: uid(), title: 'E-portfolio time during work hours', issueId: iid('portfolio'), presenterNotes: '', managementResponse: '', decision: '' },
        { id: uid(), title: 'Spray booth extraction concern', issueId: iid('ventilation'), presenterNotes: 'Raise with H&S before the forum if possible.', managementResponse: '', decision: '' }
      ],
      followUps: [], createdAt: at(addDays(today, -2)), updatedAt: at(addDays(today, -2)), demo: true
    },
    {
      id: uid(), type: 'BCF', title: 'Business Communication Forum', date: nextBcf, time: '14:00', location: 'Main Office, Boardroom', status: 'Planned',
      attendees: '', minutes: '', notesApproved: false,
      agenda: [{ id: uid(), title: 'College day clashes with Friday overtime rota', issueId: iid('college'), presenterNotes: 'Still awaiting response from last forum.', managementResponse: '', decision: '' }],
      followUps: [], createdAt: at(addDays(today, -1)), updatedAt: at(addDays(today, -1)), demo: true
    }
  ];
  log(at(pastPre, 15), 'meeting', meetings[0].id, 'meeting', 'Pre-BCF meeting completed');
  log(at(pastBcf, 17), 'meeting', meetings[1].id, 'meeting', 'BCF meeting completed — 3 points discussed');
  log(at(addDays(today, -1)), 'meeting', meetings[3].id, 'meeting', 'BCF meeting scheduled');

  const updates: CommsUpdate[] = [
    {
      id: uid(), title: 'BCF summary — PPE, rota and mentoring', status: 'Published', meetingId: meetings[1].id, publishedAt: at(addDays(pastBcf, 1), 9),
      body: 'Hi all 👋\n\nHere’s a quick summary from this month’s Business Communication Forum:\n\n• PPE restocking (Lamination): Stores will restock PPE points twice a day as a four-week trial.\n• College days & Friday overtime: Planning will review how college days show on the rota. We’ll chase for an answer before the next forum.\n• Mentor check-ins: A check-in calendar will be shared and mentors reminded.\n\nKeep the feedback coming — message any of the apprentice reps.',
      history: [{ at: at(pastBcf, 18), text: 'Draft created' }, { at: at(addDays(pastBcf, 1), 8), text: 'Marked approved' }, { at: at(addDays(pastBcf, 1), 9), text: 'Marked published' }],
      createdAt: at(pastBcf, 18), updatedAt: at(addDays(pastBcf, 1), 9), demo: true
    },
    {
      id: uid(), title: 'Reminder: share feedback before Pre-BCF', status: 'Approved',
      body: `Hi all,\n\nThe next Pre-BCF catch-up is on ${formatDate(nextPre, { weekday: true, year: false })}. If there’s anything you want raised at the forum, let one of the reps know by the day before.\n\nPlease don’t include names or personal details — we only need the issue and the area it affects.`,
      history: [{ at: at(addDays(today, -2), 10), text: 'Draft created' }, { at: at(addDays(today, -1), 11), text: 'Marked approved' }],
      createdAt: at(addDays(today, -2), 10), updatedAt: at(addDays(today, -1), 11), demo: true
    },
    {
      id: uid(), title: 'PPE restock trial — how is it going?', status: 'Draft',
      body: 'Hi Lamination apprentices,\n\nThe PPE restock trial is halfway through. Has it made a difference? Reply here or speak to a rep.',
      history: [{ at: at(addDays(today, -1), 15), text: 'Draft created' }],
      createdAt: at(addDays(today, -1), 15), updatedAt: at(addDays(today, -1), 15), demo: true
    }
  ];
  for (const u of updates) log(u.updatedAt, 'update', u.id, 'note', `Update “${u.title}” ${u.status.toLowerCase()}`);

  const templates: Template[] = [
    { id: uid(), name: 'Feedback reminder', body: 'Hi all,\n\nThe next BCF is on {date}. If there’s anything you’d like raised, let one of the apprentice reps know by {deadline}.\n\nPlease don’t include names or personal details.', createdAt: at(addDays(today, -60)), updatedAt: at(addDays(today, -60)), demo: true },
    { id: uid(), name: 'Issue progress update', body: 'Update on: {issue}\n\nWhere we are: {status}\nManagement response: {response}\nNext step: {next step}\n\nThanks for your patience — we’ll keep you posted.', createdAt: at(addDays(today, -60)), updatedAt: at(addDays(today, -60)), demo: true },
    { id: uid(), name: 'Meeting outcome (short)', body: 'Quick update from today’s meeting:\n\n• {point 1}\n• {point 2}\n\nFull summary to follow once notes are approved.', createdAt: at(addDays(today, -60)), updatedAt: at(addDays(today, -60)), demo: true }
  ];

  const plan: WeeklyPlan = {
    id: startOfWeek(today),
    priorities: [
      { text: 'Chase Planning lead on college/rota clash', done: false },
      { text: 'Confirm spray booth check with H&S Advisor', done: false },
      { text: 'Post feedback reminder before Pre-BCF', done: true }
    ],
    notes: '',
    updatedAt: at(addDays(today, -1)),
    demo: true
  };

  activity.sort((a, b) => b.at.localeCompare(a.at));
  return { data: { issues, meetings, feedback, updates, templates, plans: [plan], activity }, nextIssueNumber: n };
}
