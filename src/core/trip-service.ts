import { packItems } from './packing-engine';
import { detectRisks } from './risk-engine';
import type {
  PackingItem,
  Placement,
  Risk,
  SegmentHandoff,
  SegmentPlan,
  TripPlan,
  TripSegment,
} from './models';

export function validateTripSegments(segments: TripSegment[]): string[] {
  const errors: string[] = [];
  if (!segments.length) errors.push('至少需要一段行程');
  segments.forEach((segment, index) => {
    const label = segment.name.trim() || `第 ${index + 1} 段`;
    if (!(segment.length > 0) || !(segment.width > 0) || !(segment.height > 0)) {
      errors.push(`${label} 的可用尺寸必须大于 0`);
    }
    if (!(segment.maxWeight > 0)) errors.push(`${label} 的重量上限必须大于 0`);
  });
  return errors;
}

/** 物品的携带区间，裁剪到实际段数内 */
export function carryRange(item: PackingItem, segmentCount: number): { from: number; to: number } {
  const last = Math.max(segmentCount - 1, 0);
  const from = Math.min(Math.max(item.carryFrom ?? 0, 0), last);
  const to = Math.min(Math.max(item.carryTo ?? last, 0), last);
  return { from, to: Math.max(to, from) };
}

function samePlacement(a: Placement, b: Placement): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z
    && a.dimensions.length === b.dimensions.length
    && a.dimensions.width === b.dimensions.width
    && a.dimensions.height === b.dimensions.height;
}

function buildHandoff(previous: SegmentPlan, next: SegmentPlan, byId: Map<string, PackingItem>): SegmentHandoff {
  const prevPlaced = new Map(previous.plan.placements.map((p) => [p.itemId, p]));
  const nextPlaced = new Map(next.plan.placements.map((p) => [p.itemId, p]));
  const lookup = (id: string) => byId.get(id);
  const present = (item: PackingItem | undefined): item is PackingItem => Boolean(item);

  const removed = [...prevPlaced.keys()].filter((id) => !nextPlaced.has(id)).map(lookup).filter(present);
  const added = [...nextPlaced.keys()].filter((id) => !prevPlaced.has(id)).map(lookup).filter(present);
  const rearranged = [...nextPlaced.keys()]
    .filter((id) => {
      const before = prevPlaced.get(id);
      const after = nextPlaced.get(id);
      return Boolean(before && after && !samePlacement(before, after));
    })
    .map(lookup)
    .filter(present);

  return { fromIndex: previous.index, removed, added, rearranged };
}

/**
 * 逐段规划整趟行程。
 * - 每段只装当时应在箱内的物品（按携带区间）；
 * - 前段没装入的必带物品不会在后段凭空出现，而是标记为无法继续携带；
 * - 某段无解不影响其他段的计算，但整趟 ready 为 false。
 */
export function planTrip(segments: TripSegment[], items: PackingItem[]): TripPlan {
  const byId = new Map(items.map((item) => [item.id, item]));
  const lostMustHave = new Set<string>();

  const segmentPlans: SegmentPlan[] = segments.map((segment, index) => {
    const activeItems = items.filter((item) => {
      const { from, to } = carryRange(item, segments.length);
      return from <= index && index <= to;
    });
    const dropped = activeItems.filter((item) => lostMustHave.has(item.id));
    const candidates = activeItems.filter((item) => !lostMustHave.has(item.id));

    const plan = packItems(segment, candidates, 'comfort');
    for (const item of dropped) plan.unplaced.push({ item, reason: '前段未装入，无法继续携带' });

    let risks: Risk[] = detectRisks(plan, segment, activeItems);
    if (dropped.length) {
      risks = risks.filter((risk) => risk.id !== 'all-clear');
      for (const item of dropped) {
        risks.push({
          id: `lost-${item.id}-${index}`,
          severity: 'critical',
          title: `前段未装入：${item.name}`,
          message: '必带物品在前面的路段已经装不下，本段及之后无法凭空出现。',
          itemId: item.id,
        });
      }
    }

    for (const { item } of plan.unplaced) {
      if (item.mustHave) lostMustHave.add(item.id);
    }

    return {
      index,
      segment,
      activeItems,
      plan,
      risks,
      feasible: !risks.some((risk) => risk.severity === 'critical'),
    };
  });

  const handoffs: SegmentHandoff[] = [];
  for (let index = 1; index < segmentPlans.length; index += 1) {
    handoffs.push(buildHandoff(segmentPlans[index - 1], segmentPlans[index], byId));
  }

  return {
    id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    segments: segmentPlans,
    handoffs,
    ready: segmentPlans.length > 0 && segmentPlans.every((segment) => segment.feasible),
  };
}
