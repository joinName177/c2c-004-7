import { describe, expect, it } from 'vitest';
import { carryRange, planTrip, validateTripSegments } from '../trip-service';
import type { PackingItem, TripSegment } from '../models';

const segment = (id: string, name: string, maxWeight = 10, height = 23): TripSegment => ({
  id, name, length: 52, width: 35, height, maxWeight,
});

const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({
  id, name: id, category: '衣物', length: 10, width: 10, height: 5, weight: 1, priority: 2, mustHave: false, ...overrides,
});

describe('validateTripSegments', () => {
  it('requires at least one segment and positive limits', () => {
    expect(validateTripSegments([])).toContain('至少需要一段行程');
    const errors = validateTripSegments([segment('a', '', 0)]);
    expect(errors.some((error) => error.includes('重量上限'))).toBe(true);
    expect(validateTripSegments([segment('a', '去程')])).toHaveLength(0);
  });
});

describe('carryRange', () => {
  it('defaults to the whole trip and clamps out-of-range values', () => {
    expect(carryRange(item('a'), 3)).toEqual({ from: 0, to: 2 });
    expect(carryRange(item('a', { carryFrom: 5, carryTo: 9 }), 3)).toEqual({ from: 2, to: 2 });
    expect(carryRange(item('a', { carryFrom: 2, carryTo: 0 }), 3)).toEqual({ from: 2, to: 2 });
  });
});

describe('planTrip', () => {
  it('packs only the items active in each segment', () => {
    const items = [
      item('always', { carryFrom: 0, carryTo: 2 }),
      item('first-only', { carryFrom: 0, carryTo: 0 }),
      item('joined-later', { carryFrom: 1, carryTo: 2 }),
    ];
    const trip = planTrip([segment('s1', '去程'), segment('s2', '中转'), segment('s3', '返程')], items);
    expect(trip.segments[0].activeItems.map((i) => i.id).sort()).toEqual(['always', 'first-only']);
    expect(trip.segments[1].activeItems.map((i) => i.id).sort()).toEqual(['always', 'joined-later']);
    expect(trip.segments[2].activeItems.map((i) => i.id).sort()).toEqual(['always', 'joined-later']);
    expect(trip.ready).toBe(true);
  });

  it('lists removed, added and rearranged items in each handoff', () => {
    const items = [
      item('always', { carryFrom: 0, carryTo: 1, length: 20, width: 20, height: 10 }),
      item('first-only', { carryFrom: 0, carryTo: 0, length: 30, width: 30, height: 20 }),
      item('joined-later', { carryFrom: 1, carryTo: 1, length: 15, width: 15, height: 8 }),
    ];
    const trip = planTrip([segment('s1', '去程'), segment('s2', '返程')], items);
    const handoff = trip.handoffs[0];
    expect(handoff.removed.map((i) => i.id)).toEqual(['first-only']);
    expect(handoff.added.map((i) => i.id)).toEqual(['joined-later']);
    // 第一段 always 被体积更大的 first-only 挤到非原点位置，第二段独占时回到原点 → 需要重排
    expect(handoff.rearranged.map((i) => i.id)).toEqual(['always']);
  });

  it('keeps an unplaced must-have item from reappearing in later segments', () => {
    const items = [
      item('bulky-must', { mustHave: true, length: 60, width: 50, height: 40, carryFrom: 0, carryTo: 1 }),
      item('light', { carryFrom: 0, carryTo: 1 }),
    ];
    const trip = planTrip([segment('s1', '去程'), segment('s2', '返程')], items);
    expect(trip.segments[0].feasible).toBe(false);
    expect(trip.segments[1].plan.placements.map((p) => p.itemId)).not.toContain('bulky-must');
    expect(trip.segments[1].plan.unplaced.map((entry) => entry.item.id)).toContain('bulky-must');
    expect(trip.segments[1].risks.some((risk) => risk.severity === 'critical' && risk.title.includes('前段未装入'))).toBe(true);
    expect(trip.ready).toBe(false);
  });

  it('keeps other segments computed when one segment is infeasible, but blocks departure', () => {
    const items = [
      item('heavy-must', { mustHave: true, weight: 30, carryFrom: 1, carryTo: 1 }),
      item('light', { carryFrom: 0, carryTo: 2 }),
    ];
    const trip = planTrip([segment('s1', '去程'), segment('s2', '中转'), segment('s3', '返程')], items);
    expect(trip.segments[0].feasible).toBe(true);
    expect(trip.segments[1].feasible).toBe(false);
    expect(trip.segments[2].feasible).toBe(true);
    expect(trip.segments[0].plan.placements.length).toBeGreaterThan(0);
    expect(trip.segments[2].plan.placements.length).toBeGreaterThan(0);
    expect(trip.ready).toBe(false);
  });

  it('treats each segment limits independently of the suitcase', () => {
    const items = [item('heavy', { weight: 8, carryFrom: 0, carryTo: 1 })];
    const trip = planTrip([segment('s1', '宽松段', 10), segment('s2', '严格段', 5)], items);
    expect(trip.segments[0].plan.placements).toHaveLength(1);
    expect(trip.segments[1].plan.unplaced.map((entry) => entry.item.id)).toContain('heavy');
  });
});
