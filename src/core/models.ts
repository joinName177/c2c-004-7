export type Dimensions = Readonly<{ length: number; width: number; height: number }>;
export type PlanMode = 'minimal' | 'comfort' | 'shopping';
export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface Suitcase extends Dimensions {
  maxWeight: number;
}

export interface PackingItem extends Dimensions {
  id: string;
  name: string;
  category: string;
  weight: number;
  priority: 1 | 2 | 3;
  mustHave: boolean;
  fragile?: boolean;
  /** 从第几段开始携带（0 起，缺省为 0） */
  carryFrom?: number;
  /** 到第几段结束携带（含该段，缺省为最后一段） */
  carryTo?: number;
}

export interface Placement {
  itemId: string;
  x: number;
  y: number;
  z: number;
  dimensions: Dimensions;
}

export interface PackingPlan {
  id: PlanMode;
  name: string;
  placements: Placement[];
  unplaced: Array<{ item: PackingItem; reason: string }>;
  totalWeight: number;
  usedVolume: number;
  capacityRatio: number;
}

export interface Risk {
  id: string;
  severity: RiskSeverity;
  title: string;
  message: string;
  itemId?: string;
}

/** 行程中的一段路程，限额可独立于行李箱本身 */
export interface TripSegment extends Suitcase {
  id: string;
  name: string;
}

export interface SegmentPlan {
  index: number;
  segment: TripSegment;
  /** 该段应在箱内的物品 */
  activeItems: PackingItem[];
  plan: PackingPlan;
  risks: Risk[];
  /** 该段是否存在无解（critical 级风险） */
  feasible: boolean;
}

/** 相邻两段之间的交接变化 */
export interface SegmentHandoff {
  fromIndex: number;
  removed: PackingItem[];
  added: PackingItem[];
  rearranged: PackingItem[];
}

export interface TripPlan {
  id: string;
  createdAt: number;
  segments: SegmentPlan[];
  handoffs: SegmentHandoff[];
  /** 所有段均可行时整趟才可出发 */
  ready: boolean;
}

export interface PackingSnapshot {
  suitcase: Suitcase;
  items: PackingItem[];
  selectedPlan: PlanMode;
  tripSegments: TripSegment[];
  confirmedTrip: TripPlan | null;
}

export function itemVolume(item: Dimensions): number {
  return item.length * item.width * item.height;
}

export function suitcaseVolume(suitcase: Dimensions): number {
  return suitcase.length * suitcase.width * suitcase.height;
}
