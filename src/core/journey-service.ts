import { packItems } from './packing-engine';
import { detectRisks } from './risk-engine';
import type {
  JourneyRoute,
  JourneySegment,
  JourneyState,
  PackingItem,
  PlanMode,
  SegmentHandoff,
  SegmentResult,
  Suitcase,
} from './models';

export function createDefaultJourney(suitcase: Suitcase): JourneyState {
  return { segments: [{ id: 'seg-1', name: '第 1 段', suitcase: { ...suitcase } }], confirmedRoute: null };
}

/** 归一化物品的携带区间（1 起、含端点）；起点大于终点时视为整趟不携带 */
export function carryWindow(item: PackingItem, segmentCount: number): { from: number; to: number } {
  const count = Math.max(segmentCount, 1);
  const clamp = (value: number | undefined, fallback: number) => Math.min(Math.max(Math.round(value ?? fallback), 1), count);
  return { from: clamp(item.carryFrom, 1), to: clamp(item.carryTo, count) };
}

export function isActiveInSegment(item: PackingItem, segmentIndex: number, segmentCount: number): boolean {
  const { from, to } = carryWindow(item, segmentCount);
  const position = segmentIndex + 1;
  return from <= to && position >= from && position <= to;
}

function placementChanged(prev: SegmentResult, next: SegmentResult, itemId: string): boolean {
  const a = prev.plan.placements.find((placement) => placement.itemId === itemId);
  const b = next.plan.placements.find((placement) => placement.itemId === itemId);
  if (!a || !b) return a !== b;
  return a.x !== b.x || a.y !== b.y || a.z !== b.z
    || a.dimensions.length !== b.dimensions.length
    || a.dimensions.width !== b.dimensions.width
    || a.dimensions.height !== b.dimensions.height;
}

function computeHandoff(prev: SegmentResult, next: SegmentResult, items: PackingItem[]): SegmentHandoff {
  const byId = new Map(items.map((item) => [item.id, item]));
  const prevActive = new Set(prev.activeItemIds);
  const nextActive = new Set(next.activeItemIds);
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((item): item is PackingItem => Boolean(item));
  return {
    fromSegmentId: prev.segmentId,
    toSegmentId: next.segmentId,
    removed: pick([...prevActive].filter((id) => !nextActive.has(id))),
    added: pick([...nextActive].filter((id) => !prevActive.has(id))),
    rearranged: pick([...prevActive].filter((id) => nextActive.has(id) && placementChanged(prev, next, id))),
  };
}

/** 行程输入的指纹，用于判断已确认路线是否落后于当前输入 */
export function journeySignature(segments: JourneySegment[], items: PackingItem[], mode: PlanMode): string {
  return JSON.stringify({ segments, items, mode });
}

/**
 * 逐段计算装箱与风险。前段没装入的必带物品会进入失败名单，
 * 后续路段即使限额放宽也不能让它凭空出现；某段无解不影响其他段的结果。
 */
export function computeJourneyRoute(segments: JourneySegment[], items: PackingItem[], mode: PlanMode): JourneyRoute {
  const failedMustHave = new Set<string>();
  const results: SegmentResult[] = segments.map((segment, index) => {
    const active = items.filter((item) => isActiveInSegment(item, index, segments.length));
    const blocked = active.filter((item) => failedMustHave.has(item.id));
    const plan = packItems(segment.suitcase, active.filter((item) => !failedMustHave.has(item.id)), mode);
    for (const item of blocked) plan.unplaced.push({ item, reason: '前段未能装入，无法继续携带' });

    const risks = detectRisks(plan, segment.suitcase, active);
    for (const item of blocked) {
      const risk = risks.find((entry) => entry.id === `missing-${item.id}`);
      if (risk) {
        risk.title = `前段未装入：${item.name}`;
        risk.message = '该必带物品在前一路段未能装入，不能在本段凭空出现。';
      }
    }

    for (const entry of plan.unplaced) if (entry.item.mustHave) failedMustHave.add(entry.item.id);
    return {
      segmentId: segment.id,
      segmentName: segment.name,
      suitcase: { ...segment.suitcase },
      plan,
      risks,
      feasible: !risks.some((risk) => risk.severity === 'critical'),
      activeItemIds: active.map((item) => item.id),
    };
  });

  const handoffs = results.slice(1).map((next, index) => computeHandoff(results[index], next, items));
  return {
    signature: journeySignature(segments, items, mode),
    results,
    handoffs,
    canDepart: results.length > 0 && results.every((result) => result.feasible),
  };
}
