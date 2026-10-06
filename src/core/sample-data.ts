import type { PackingItem, PackingSnapshot, Suitcase, TripSegment } from './models';

const seed = (
  id: string,
  name: string,
  category: string,
  dimensions: [number, number, number],
  weight: number,
  priority: 1 | 2 | 3,
  mustHave = false,
  fragile = false,
  carryFrom?: number,
  carryTo?: number,
): PackingItem => ({
  id, name, category, length: dimensions[0], width: dimensions[1], height: dimensions[2], weight, priority, mustHave, fragile, carryFrom, carryTo,
});

/** 未配置分段时的兜底：一段与行李箱同限额的“全程” */
export function createDefaultTripSegments(suitcase: Suitcase): TripSegment[] {
  return [{ id: 'seg-1', name: '全程', length: suitcase.length, width: suitcase.width, height: suitcase.height, maxWeight: suitcase.maxWeight }];
}

export function createSampleSnapshot(): PackingSnapshot {
  return {
    suitcase: { length: 52, width: 35, height: 23, maxWeight: 10 },
    selectedPlan: 'comfort',
    tripSegments: [
      { id: 'seg-out', name: '去程 · 高铁', length: 52, width: 35, height: 23, maxWeight: 10 },
      { id: 'seg-mid', name: '中转 · 航班', length: 55, width: 40, height: 20, maxWeight: 8 },
      { id: 'seg-back', name: '返程 · 航班', length: 55, width: 40, height: 20, maxWeight: 12 },
    ],
    confirmedTrip: null,
    items: [
      seed('jacket', '轻薄外套', '衣物', [30, 24, 5], 0.65, 3, true, false, 0, 2),
      seed('shoes', '运动鞋', '鞋履', [31, 20, 12], 0.9, 3, true, false, 0, 2),
      seed('camera', '微单相机', '数码', [18, 14, 10], 0.72, 2, false, true, 0, 2),
      seed('toiletry', '洗漱包', '洗护', [22, 14, 8], 0.48, 3, true, false, 0, 2),
      seed('book', '旅行读物', '随身', [21, 15, 2], 0.38, 1, false, false, 0, 0),
      seed('gifts', '伴手礼预留盒', '预留', [24, 18, 9], 0.2, 1, false, false, 1, 2),
    ],
  };
}
