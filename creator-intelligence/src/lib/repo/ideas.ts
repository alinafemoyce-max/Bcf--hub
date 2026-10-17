import type { Db } from '../db/client';
import { NotFoundError, UserError } from '../errors';
import type { Idea } from '../types';
import { toIdea } from './mappers';
import { getVideo, isUuid } from './videos';

type IdeaFields = Partial<Pick<Idea, 'title' | 'hook' | 'concept' | 'notes' | 'status' | 'rejection_reason' | 'video_id'>>;
const COLS = ['title', 'hook', 'concept', 'notes', 'status', 'rejection_reason', 'video_id'] as const;

export async function listIdeas(db: Db): Promise<Idea[]> {
  const rows = await db.query(
    `select * from ideas order by case status when 'rejected' then 2 when 'evaluated' then 1 else 0 end, updated_at desc`
  );
  return rows.map(toIdea);
}

export async function createIdea(db: Db, input: IdeaFields & { title: string }, source: Idea['source'] = 'manual'): Promise<Idea> {
  if (input.video_id && !(await getVideo(db, input.video_id))) throw new NotFoundError('Linked video');
  const rows = await db.query(
    `insert into ideas (title, hook, concept, notes, status, rejection_reason, video_id, source) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [input.title, input.hook ?? null, input.concept ?? null, input.notes ?? null, input.status ?? 'new', input.rejection_reason ?? null, input.video_id ?? null, source]
  );
  return toIdea(rows[0]);
}

export async function updateIdea(db: Db, id: string, patch: IdeaFields): Promise<Idea> {
  if (!isUuid(id)) throw new NotFoundError('Idea');
  if (patch.video_id && !(await getVideo(db, patch.video_id))) throw new NotFoundError('Linked video');
  if (patch.status === 'published' && patch.video_id === null) throw new UserError('Link the published video, or keep a different status.');
  const cols = COLS.filter((c) => c in patch && patch[c] !== undefined);
  if (!cols.length) {
    const rows = await db.query('select * from ideas where id = $1', [id]);
    if (!rows[0]) throw new NotFoundError('Idea');
    return toIdea(rows[0]);
  }
  const rows = await db.query(
    `update ideas set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1 returning *`,
    [id, ...cols.map((c) => patch[c] ?? null)]
  );
  if (!rows[0]) throw new NotFoundError('Idea');
  return toIdea(rows[0]);
}

export async function deleteIdea(db: Db, id: string): Promise<void> {
  if (!isUuid(id)) throw new NotFoundError('Idea');
  const rows = await db.query('delete from ideas where id = $1 returning id', [id]);
  if (!rows[0]) throw new NotFoundError('Idea');
}
