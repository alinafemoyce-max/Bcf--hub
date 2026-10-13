/** Shared domain vocabulary: statuses, priorities, material options and the status workflow. */

export const ORDER_STATUSES = [
  'submitted',
  'clarification_required',
  'accepted',
  'in_progress',
  'ready',
  'collected',
  'rejected',
  'cancelled'
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: 'Submitted',
  clarification_required: 'Clarification Required',
  accepted: 'Accepted',
  in_progress: 'In Progress',
  ready: 'Ready for Collection',
  collected: 'Collected',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

/** The main path shown on the employee tracking timeline. */
export const MAIN_PATH: OrderStatus[] = ['submitted', 'accepted', 'in_progress', 'ready', 'collected'];

export const TERMINAL_STATUSES: OrderStatus[] = ['collected', 'rejected', 'cancelled'];
export const OPEN_STATUSES: OrderStatus[] = ORDER_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s));

export type Actor = 'operator' | 'requester';

/**
 * Allowed transitions and who may perform them. Anything not listed is rejected by the server.
 * Requesters may only reply to a clarification (returning the order to Submitted) or cancel
 * before work starts.
 */
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, Actor[]>>> = {
  submitted: {
    accepted: ['operator'],
    clarification_required: ['operator'],
    rejected: ['operator'],
    cancelled: ['requester']
  },
  clarification_required: {
    submitted: ['requester'],
    accepted: ['operator'],
    rejected: ['operator'],
    cancelled: ['requester']
  },
  accepted: {
    in_progress: ['operator'],
    clarification_required: ['operator'],
    cancelled: ['operator']
  },
  in_progress: {
    ready: ['operator'],
    clarification_required: ['operator'],
    cancelled: ['operator']
  },
  ready: {
    collected: ['operator']
  },
  collected: {},
  rejected: {},
  cancelled: {}
};

export function canTransition(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  return TRANSITIONS[from]?.[to]?.includes(actor) ?? false;
}

export function allowedTransitions(from: OrderStatus, actor: Actor): OrderStatus[] {
  const options = TRANSITIONS[from] ?? {};
  return (Object.keys(options) as OrderStatus[]).filter((to) => options[to]?.includes(actor));
}

/** Transitions that must carry a message to the requester. */
export const COMMENT_REQUIRED: OrderStatus[] = ['clarification_required', 'rejected', 'cancelled'];

export const REQUESTED_PRIORITIES = ['normal', 'urgent'] as const;
export type RequestedPriority = (typeof REQUESTED_PRIORITIES)[number];

export const OPERATOR_PRIORITIES = ['normal', 'high', 'urgent'] as const;
export type OperatorPriority = (typeof OPERATOR_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<OperatorPriority, string> = {
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent'
};

export const PRIORITY_RANK: Record<OperatorPriority, number> = { urgent: 0, high: 1, normal: 2 };

export const MATERIAL_CATEGORIES = [
  'plywood',
  'mdf',
  'hardwood',
  'softwood',
  'veneered_board',
  'laminate',
  'other'
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  plywood: 'Plywood',
  mdf: 'MDF',
  hardwood: 'Hardwood',
  softwood: 'Softwood',
  veneered_board: 'Veneered Board',
  laminate: 'Laminate',
  other: 'Other'
};

/** Thickness is required for every category except "Other", where it may not apply. */
export function thicknessRequired(category: MaterialCategory): boolean {
  return category !== 'other';
}

export const GRAIN_DIRECTIONS = ['lengthways', 'widthways', 'not_applicable'] as const;
export type GrainDirection = (typeof GRAIN_DIRECTIONS)[number];

export const GRAIN_LABELS: Record<GrainDirection, string> = {
  lengthways: 'Lengthways',
  widthways: 'Widthways',
  not_applicable: 'Not applicable'
};

export const CUTTING_REQUIREMENTS = ['straight_cut', 'shaped_cut', 'drilling', 'routing', 'other'] as const;
export type CuttingRequirement = (typeof CUTTING_REQUIREMENTS)[number];

export const CUTTING_LABELS: Record<CuttingRequirement, string> = {
  straight_cut: 'Straight cut',
  shaped_cut: 'Shaped cut',
  drilling: 'Drilling',
  routing: 'Routing',
  other: 'Other'
};

export const DIMENSION_LIMITS = {
  thickness: { min: 0.5, max: 200 },
  length: { min: 1, max: 6000 },
  width: { min: 1, max: 3000 },
  quantity: { min: 1, max: 500 }
} as const;

export const MAX_ITEMS_PER_ORDER = 20;
