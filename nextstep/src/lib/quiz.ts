// The "Not sure yet?" interests questionnaire. It is a simple preference sorter, not a validated
// psychometric or aptitude test: each answer nudges the weight of some work-style tags up or down.
import { CATALOG, SECTORS, type Sector, type Tag } from '../data/catalog';
import { allSlugs, career } from './data';
import type { QuizAnswers } from './types';

export interface QuizOption {
  id: string;
  label: string;
  emoji: string;
  w: Partial<Record<Tag, number>>;
}
export interface QuizQuestion {
  id: string;
  title: string;
  hint?: string;
  multi?: boolean;
  options: QuizOption[];
}

export const QUIZ: QuizQuestion[] = [
  {
    id: 'people',
    title: 'Who would you rather work with?',
    options: [
      { id: 'lots', label: 'Lots of different people – customers, patients or the public', emoji: '🙌', w: { people: 3, care: 1, venue: 1, solo: -1 } },
      { id: 'team', label: 'A close team I get to know', emoji: '🤝', w: { team: 3, people: 1 } },
      { id: 'solo', label: 'Mostly on my own', emoji: '🎧', w: { solo: 3, people: -1 } },
      { id: 'any', label: 'No strong preference', emoji: '🤷', w: {} }
    ]
  },
  {
    id: 'hands',
    title: 'What kind of work do you enjoy most?',
    options: [
      { id: 'make', label: 'Making, building or fixing things', emoji: '🛠️', w: { hands: 3, workshop: 1, site: 1, desk: -1 } },
      { id: 'desk', label: 'Working at a desk or on a computer', emoji: '🖥️', w: { desk: 3, office: 1, hands: -1 } },
      { id: 'move', label: 'Being on my feet and active', emoji: '🏃', w: { active: 3, hands: 1, desk: -1 } },
      { id: 'mix', label: 'A mix of practical and desk work', emoji: '⚖️', w: { hands: 1, desk: 1 } }
    ]
  },
  {
    id: 'thinking',
    title: 'Which tasks sound more like you?',
    options: [
      { id: 'creative', label: 'Creating, designing or coming up with ideas', emoji: '🎨', w: { creative: 3 } },
      { id: 'analytical', label: 'Solving problems with numbers, data or logic', emoji: '🧮', w: { analytical: 3 } },
      { id: 'both', label: 'Both', emoji: '✨', w: { creative: 1.5, analytical: 1.5 } },
      { id: 'neither', label: 'Neither – I prefer clear, practical tasks', emoji: '✅', w: { hands: 1, creative: -1, analytical: -1 } }
    ]
  },
  {
    id: 'lead',
    title: 'Would you like to lead a team one day?',
    options: [
      { id: 'yes', label: 'Yes, I’d like to be in charge', emoji: '🧭', w: { lead: 3, business: 1 } },
      { id: 'maybe', label: 'Maybe, later on', emoji: '🌱', w: { lead: 1 } },
      { id: 'no', label: 'No, I’d rather focus on my own work', emoji: '🎯', w: { lead: -2, solo: 1 } }
    ]
  },
  {
    id: 'tech',
    title: 'How do you feel about technology?',
    options: [
      { id: 'love', label: 'I love it – I want it at the centre of my work', emoji: '💻', w: { tech: 3 } },
      { id: 'fine', label: 'Happy to use it as a tool', emoji: '👍', w: { tech: 0.5 } },
      { id: 'avoid', label: 'I’d rather keep screens to a minimum', emoji: '🌿', w: { tech: -2, desk: -1 } }
    ]
  },
  {
    id: 'care',
    title: 'How appealing is helping people directly – caring, teaching or supporting them?',
    options: [
      { id: 'very', label: 'Very – that’s what motivates me', emoji: '💙', w: { care: 3, people: 1 } },
      { id: 'some', label: 'Somewhat', emoji: '🙂', w: { care: 1 } },
      { id: 'no', label: 'Not really for me', emoji: '➖', w: { care: -2 } }
    ]
  },
  {
    id: 'money',
    title: 'How important is earning potential to you right now?',
    hint: 'There are no wrong answers. Pay varies a lot by employer and area.',
    options: [
      { id: 'top', label: 'Very important – I want to aim high', emoji: '📈', w: { business: 1.5, lead: 1, analytical: 0.5 } },
      { id: 'fair', label: 'Important, but so are other things', emoji: '⚖️', w: { business: 0.5 } },
      { id: 'other', label: 'Other things matter more to me', emoji: '🌟', w: { care: 0.5, creative: 0.5 } }
    ]
  },
  {
    id: 'place',
    title: 'Where would you like to work?',
    hint: 'Choose as many as you like.',
    multi: true,
    options: [
      { id: 'workshop', label: 'Workshop, factory or boatyard', emoji: '🏭', w: { workshop: 3, hands: 1 } },
      { id: 'site', label: 'Building sites, outdoors or people’s homes', emoji: '🏗️', w: { site: 3, active: 1 } },
      { id: 'office', label: 'Office or from home', emoji: '🏢', w: { office: 3, desk: 1 } },
      { id: 'clinical', label: 'Hospital, care home or clinic', emoji: '🏥', w: { clinical: 3, care: 1 } },
      { id: 'venue', label: 'Shop, restaurant, hotel or gym', emoji: '🛍️', w: { venue: 3, people: 1 } },
      { id: 'classroom', label: 'School, college or training centre', emoji: '🏫', w: { classroom: 3 } },
      { id: 'road', label: 'On the road, travelling around', emoji: '🚚', w: { road: 3 } },
      { id: 'any', label: 'Anywhere – no preference', emoji: '🗺️', w: {} }
    ]
  }
];

export function quizTagWeights(answers: QuizAnswers): Partial<Record<Tag, number>> {
  const w: Partial<Record<Tag, number>> = {};
  for (const q of QUIZ) {
    for (const id of answers[q.id] ?? []) {
      const opt = q.options.find((o) => o.id === id);
      if (!opt) continue;
      for (const [t, v] of Object.entries(opt.w) as [Tag, number][]) w[t] = (w[t] ?? 0) + v;
    }
  }
  return w;
}

export const quizComplete = (a: QuizAnswers | null) => !!a && QUIZ.every((q) => (a[q.id] ?? []).length > 0);
export const quizAnswered = (a: QuizAnswers | null) => (a ? QUIZ.filter((q) => (a[q.id] ?? []).length > 0).length : 0);

export interface QuizResult {
  sector: Sector;
  score: number;
  careers: string[];
}

/** Scores every career by its tags, then ranks sectors by their best-matching careers. */
export function quizResults(answers: QuizAnswers): QuizResult[] {
  const w = quizTagWeights(answers);
  const scored = allSlugs().map((s) => ({ s, score: CATALOG[s].tags.reduce((sum, t) => sum + (w[t] ?? 0), 0) / Math.sqrt(CATALOG[s].tags.length) }));
  return SECTORS.map((sec) => {
    const mine = scored
      .filter((x) => CATALOG[x.s].sector === sec.id && career(x.s))
      .sort((a, b) => b.score - a.score || CATALOG[a.s].level - CATALOG[b.s].level);
    const top = mine.slice(0, 3);
    return { sector: sec.id, score: top.reduce((s, x) => s + x.score, 0) / Math.max(top.length, 1), careers: mine.slice(0, 4).map((x) => x.s) };
  }).sort((a, b) => b.score - a.score);
}

/** Plain-English summary of the strongest preferences. */
export function quizHighlights(answers: QuizAnswers, phrases: Partial<Record<Tag, string>>): string[] {
  const w = quizTagWeights(answers);
  return (Object.entries(w) as [Tag, number][])
    .filter(([, v]) => v >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t]) => phrases[t] ?? t);
}
