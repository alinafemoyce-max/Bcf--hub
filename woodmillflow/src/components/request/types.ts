import type { CuttingRequirement, GrainDirection, MaterialCategory, RequestedPriority } from '@/lib/domain';

/** Raw form values (strings from inputs). The shared Zod schema converts and validates them. */
export interface ItemValues {
  materialCategory: MaterialCategory | '';
  materialDescription: string;
  thicknessMm: string;
  lengthMm: string;
  widthMm: string;
  quantity: string;
  grainDirection: GrainDirection | '';
  cuttingRequirements: CuttingRequirement[];
  cuttingOther: string;
  drawingReference: string;
  notes: string;
}

export interface FormValues {
  clockNumber: string;
  employeeName: string;
  departmentId: string;
  productionLineId: string;
  hullReference: string;
  dateRequired: string;
  requestedPriority: RequestedPriority;
  urgentReason: string;
  notes: string;
  items: ItemValues[];
}

export const emptyItem = (): ItemValues => ({
  materialCategory: '',
  materialDescription: '',
  thicknessMm: '',
  lengthMm: '',
  widthMm: '',
  quantity: '1',
  grainDirection: '',
  cuttingRequirements: ['straight_cut'],
  cuttingOther: '',
  drawingReference: '',
  notes: ''
});

export const emptyOrder = (): Omit<FormValues, 'clockNumber' | 'employeeName' | 'departmentId' | 'productionLineId'> => ({
  hullReference: '',
  dateRequired: '',
  requestedPriority: 'normal',
  urgentReason: '',
  notes: '',
  items: [emptyItem()]
});
