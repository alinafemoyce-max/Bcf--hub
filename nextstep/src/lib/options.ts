import type { ExperienceId, InterestId, QualId, StatusId } from './types';

export const STATUSES: { id: StatusId; label: string; hint: string }[] = [
  { id: 'school', label: 'School student', hint: 'At school, including sixth form' },
  { id: 'college', label: 'College student', hint: 'At college or studying a course' },
  { id: 'apprentice', label: 'Apprentice', hint: 'On an apprenticeship' },
  { id: 'employed', label: 'Employed', hint: 'Working for an employer' },
  { id: 'self-employed', label: 'Self-employed', hint: 'Working for yourself' },
  { id: 'looking', label: 'Looking for work', hint: 'Between jobs or starting out' },
  { id: 'changing', label: 'Exploring a career change', hint: 'Thinking about something different' }
];

/** `level` is the regulated qualification level (RQF), used only for rough comparisons. */
export const QUALS: { id: QualId; label: string; level: number }[] = [
  { id: 'gcse-em', label: 'GCSE English and maths (grade 4 / C or above)', level: 2 },
  { id: 'gcse', label: 'Other GCSEs', level: 2 },
  { id: 'functional', label: 'Functional Skills English or maths', level: 1 },
  { id: 'l2', label: 'Level 2 course, NVQ or diploma', level: 2 },
  { id: 'l3', label: 'Level 3 course, BTEC, NVQ or diploma', level: 3 },
  { id: 'alevels', label: 'A levels', level: 3 },
  { id: 'tlevel', label: 'T Level', level: 3 },
  { id: 'app2', label: 'Intermediate apprenticeship (level 2)', level: 2 },
  { id: 'app3', label: 'Advanced apprenticeship (level 3)', level: 3 },
  { id: 'app4', label: 'Higher or degree apprenticeship (level 4+)', level: 4 },
  { id: 'access', label: 'Access to Higher Education diploma', level: 3 },
  { id: 'hnc', label: 'HNC, HND or foundation degree', level: 5 },
  { id: 'degree', label: 'Degree', level: 6 },
  { id: 'postgrad', label: "Postgraduate (e.g. master's, PGCE)", level: 7 },
  { id: 'cards', label: 'Industry cards or short courses (e.g. CSCS, first aid, food hygiene)', level: 1 }
];

export const EXPERIENCE: { id: ExperienceId; label: string }[] = [
  { id: 'none', label: 'None yet' },
  { id: 'lt1', label: 'Less than 1 year' },
  { id: '1to2', label: '1–2 years' },
  { id: '3to5', label: '3–5 years' },
  { id: '5plus', label: 'More than 5 years' }
];

export const INTERESTS: { id: InterestId; label: string; emoji: string }[] = [
  { id: 'leadership', label: 'Leadership and management', emoji: '🧭' },
  { id: 'business', label: 'Business ownership', emoji: '🚀' },
  { id: 'specialist', label: 'Technical specialisation', emoji: '🔧' },
  { id: 'earnings', label: 'Higher earnings', emoji: '📈' },
  { id: 'change', label: 'Changing industries', emoji: '🔀' },
  { id: 'education', label: 'Further education', emoji: '🎓' },
  { id: 'unsure', label: 'Not sure yet', emoji: '🤔' }
];

export const label = <T extends { id: string; label: string }>(list: T[], id: string | undefined) => list.find((x) => x.id === id)?.label;
