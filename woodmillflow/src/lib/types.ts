import type {
  CuttingRequirement,
  GrainDirection,
  MaterialCategory,
  OperatorPriority,
  OrderStatus,
  RequestedPriority
} from './domain';

export interface OrderItem {
  id: string;
  position: number;
  materialCategory: MaterialCategory;
  materialDescription: string;
  thicknessMm: number | null;
  lengthMm: number;
  widthMm: number;
  quantity: number;
  grainDirection: GrainDirection | null;
  cuttingRequirements: CuttingRequirement[];
  cuttingOther: string | null;
  drawingReference: string | null;
  notes: string | null;
}

export interface HistoryEntry {
  id: string;
  eventType: 'status' | 'priority';
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  changedAt: string;
  changedBy: string;
  changedByRole: 'employee' | 'operator';
  comment: string | null;
  commentInternal: boolean;
}

interface OrderBase {
  reference: string;
  status: OrderStatus;
  submittedAt: string;
  updatedAt: string;
  dateRequired: string | null;
  requestedPriority: RequestedPriority;
  urgentReason: string | null;
  requesterName: string;
  requesterClock: string;
  department: string;
  productionLine: string;
  hullReference: string | null;
  notes: string | null;
  items: OrderItem[];
}

/** Full order as seen by the woodmill operator (includes internal notes). */
export interface OperatorOrder extends OrderBase {
  id: string;
  approvedPriority: OperatorPriority | null;
  trackingToken: string;
  history: HistoryEntry[];
}

/** Order as seen by the requester through a tracking link. Internal operator notes are removed. */
export interface TrackedOrder extends OrderBase {
  approvedPriority: OperatorPriority | null;
  history: HistoryEntry[];
}

export interface CreatedOrder {
  reference: string;
  status: OrderStatus;
  submittedAt: string;
  trackingToken: string;
}

export interface ReferenceData {
  departments: { id: number; name: string }[];
  productionLines: { id: number; name: string }[];
}

export interface StatusCounts {
  counts: Record<OrderStatus, number>;
  completedToday: number;
}
