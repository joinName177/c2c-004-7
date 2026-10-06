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
  /** 从第几段开始携带（1 起，含），缺省为第 1 段 */
  carryFrom?: number;
  /** 携带到第几段结束（1 起，含），缺省为最后一段 */
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

export interface JourneySegment {
  id: string;
  name: string;
  suitcase: Suitcase;
}

export interface SegmentResult {
  segmentId: string;
  segmentName: string;
  /** 计算时该段使用的限额快照，保证旧路线可回看 */
  suitcase: Suitcase;
  plan: PackingPlan;
  risks: Risk[];
  feasible: boolean;
  activeItemIds: string[];
}

export interface SegmentHandoff {
  fromSegmentId: string;
  toSegmentId: string;
  removed: PackingItem[];
  added: PackingItem[];
  rearranged: PackingItem[];
}

export interface JourneyRoute {
  signature: string;
  results: SegmentResult[];
  handoffs: SegmentHandoff[];
  canDepart: boolean;
}

export interface JourneyState {
  segments: JourneySegment[];
  /** 用户已确认的路线；新计算结果在被接受前不会替换它 */
  confirmedRoute: JourneyRoute | null;
}

export interface PackingSnapshot {
  suitcase: Suitcase;
  items: PackingItem[];
  selectedPlan: PlanMode;
  journey: JourneyState;
}

export function itemVolume(item: Dimensions): number {
  return item.length * item.width * item.height;
}

export function suitcaseVolume(suitcase: Dimensions): number {
  return suitcase.length * suitcase.width * suitcase.height;
}
