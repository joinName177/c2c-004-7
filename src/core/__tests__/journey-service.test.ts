import { describe, expect, it } from 'vitest';
import { computeJourneyRoute, isActiveInSegment } from '../journey-service';
import type { JourneySegment, PackingItem, Suitcase } from '../models';

const suitcase = (overrides: Partial<Suitcase> = {}): Suitcase => ({ length: 40, width: 30, height: 20, maxWeight: 10, ...overrides });
const seg = (id: string, limits: Partial<Suitcase> = {}): JourneySegment => ({ id, name: id, suitcase: suitcase(limits) });
const item = (id: string, overrides: Partial<PackingItem> = {}): PackingItem => ({ id, name: id, category: '衣物', length: 10, width: 8, height: 5, weight: 1, priority: 2, mustHave: false, ...overrides });

describe('computeJourneyRoute', () => {
  it('activates items only within their carry window', () => {
    const items = [item('a'), item('b', { carryFrom: 2, carryTo: 3 }), item('c', { carryTo: 1 })];
    const route = computeJourneyRoute([seg('s1'), seg('s2'), seg('s3')], items, 'comfort');
    expect(route.results[0].activeItemIds).toEqual(['a', 'c']);
    expect(route.results[1].activeItemIds).toEqual(['a', 'b']);
    expect(route.results[2].activeItemIds).toEqual(['a', 'b']);
    expect(route.canDepart).toBe(true);
  });

  it('treats an inverted carry window as never carried', () => {
    expect(isActiveInSegment(item('x', { carryFrom: 3, carryTo: 1 }), 0, 3)).toBe(false);
    expect(isActiveInSegment(item('x', { carryFrom: 3, carryTo: 1 }), 2, 3)).toBe(false);
  });

  it('never lets a must-have item dropped in an earlier segment reappear later', () => {
    const huge = item('huge', { mustHave: true, length: 100, width: 100, height: 100 });
    const route = computeJourneyRoute([seg('s1'), seg('s2')], [huge], 'comfort');
    expect(route.results[0].feasible).toBe(false);
    expect(route.results[1].plan.placements.some((p) => p.itemId === 'huge')).toBe(false);
    expect(route.results[1].plan.unplaced[0].reason).toContain('前段');
    expect(route.results[1].risks.find((risk) => risk.id === 'missing-huge')?.title).toContain('前段未装入');
    expect(route.results[1].feasible).toBe(false);
    expect(route.canDepart).toBe(false);
  });

  it('lists removed, added and rearranged items between adjacent segments', () => {
    const items = [item('a', { carryTo: 1 }), item('b', { carryFrom: 2 }), item('c', { weight: 2 })];
    const route = computeJourneyRoute([seg('s1'), seg('s2', { maxWeight: 0.5 })], items, 'comfort');
    const handoff = route.handoffs[0];
    expect(handoff.removed.map((entry) => entry.id)).toEqual(['a']);
    expect(handoff.added.map((entry) => entry.id)).toEqual(['b']);
    expect(handoff.rearranged.map((entry) => entry.id)).toEqual(['c']);
  });

  it('keeps other segments computed when one segment has no solution', () => {
    const items = [item('a', { mustHave: true })];
    const route = computeJourneyRoute([seg('s1'), seg('s2', { length: 5, width: 5, height: 5 }), seg('s3')], items, 'comfort');
    expect(route.results).toHaveLength(3);
    expect(route.results[0].feasible).toBe(true);
    expect(route.results[0].plan.placements.some((p) => p.itemId === 'a')).toBe(true);
    expect(route.results[1].feasible).toBe(false);
    expect(route.results[2].plan.unplaced[0].reason).toContain('前段');
    expect(route.canDepart).toBe(false);
  });

  it('changes the signature when a segment limit changes but not for identical input', () => {
    const items = [item('a')];
    const base = computeJourneyRoute([seg('s1')], items, 'comfort');
    expect(computeJourneyRoute([seg('s1')], items, 'comfort').signature).toBe(base.signature);
    expect(computeJourneyRoute([seg('s1', { maxWeight: 5 })], items, 'comfort').signature).not.toBe(base.signature);
  });
});
