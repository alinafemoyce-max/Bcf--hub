import { AthleteDB } from './db';
import { DexieRepository } from './repository';

/** The app's single local repository. Swap for a cloud-backed implementation of AthleteRepository later. */
export const db = new AthleteDB();
export const repo = new DexieRepository(db);
