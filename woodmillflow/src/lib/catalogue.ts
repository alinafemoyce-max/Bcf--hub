import type { MaterialCategory } from './domain';

/**
 * Fictional sample catalogue used to reduce typing. Entries are generic material descriptions,
 * not a real stock list. "Not listed" lets the requester type their own description.
 */
export interface CatalogueEntry {
  description: string;
  thicknesses: number[];
}

export const MATERIAL_CATALOGUE: Record<MaterialCategory, CatalogueEntry[]> = {
  plywood: [
    { description: 'Birch plywood', thicknesses: [6, 9, 12, 15, 18, 24] },
    { description: 'Marine plywood', thicknesses: [6, 9, 12, 18, 25] },
    { description: 'Lightweight poplar plywood', thicknesses: [5, 10, 15, 18] }
  ],
  mdf: [
    { description: 'Standard MDF', thicknesses: [6, 9, 12, 18, 25] },
    { description: 'Moisture-resistant MDF', thicknesses: [9, 12, 18, 25] },
    { description: 'Fire-retardant MDF', thicknesses: [12, 18] }
  ],
  hardwood: [
    { description: 'Oak', thicknesses: [20, 27, 32, 45] },
    { description: 'Ash', thicknesses: [20, 27, 32] },
    { description: 'Sapele', thicknesses: [20, 27, 32, 45] },
    { description: 'Teak', thicknesses: [10, 15, 20, 27] }
  ],
  softwood: [
    { description: 'Redwood (planed)', thicknesses: [19, 22, 25, 44] },
    { description: 'Spruce', thicknesses: [19, 25, 44] }
  ],
  veneered_board: [
    { description: 'Oak-faced board', thicknesses: [6, 12, 18] },
    { description: 'Walnut-veneered MDF', thicknesses: [12, 18] },
    { description: 'Teak-faced plywood', thicknesses: [6, 12, 18] }
  ],
  laminate: [
    { description: 'High-pressure laminate (white gloss)', thicknesses: [0.8, 1.2] },
    { description: 'Compact laminate panel', thicknesses: [6, 10, 12] }
  ],
  other: []
};

export function catalogueEntry(category: MaterialCategory, description: string): CatalogueEntry | undefined {
  return MATERIAL_CATALOGUE[category].find((e) => e.description === description);
}

export const COMMON_THICKNESSES = [6, 9, 12, 18, 25];
