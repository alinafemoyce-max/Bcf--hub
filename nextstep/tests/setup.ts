import { setData } from '../src/lib/data';
import ncs from '../src/data/ncs.json';
import type { NcsData } from '../src/lib/types';

setData(ncs as unknown as NcsData);
