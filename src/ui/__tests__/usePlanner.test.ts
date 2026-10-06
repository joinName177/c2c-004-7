import { describe, expect, it } from 'vitest';
import { createSampleSnapshot } from '../../core/sample-data';
import { usePlanner } from '../usePlanner';
import type { PackingSnapshot } from '../../core/models';
import type { PlannerRepository } from '../../ports/planner-repository.port';

class MemoryRepository implements PlannerRepository {
  saved?: PackingSnapshot;
  constructor(private snapshot = createSampleSnapshot()) {}
  load() { return { value: structuredClone(this.snapshot) }; }
  save(snapshot: PackingSnapshot) { this.saved = structuredClone(snapshot); }
}

describe('usePlanner', () => {
  it('adds, updates and removes items while marking results stale', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    const initial = planner.state.items.length;
    planner.addItem({ id: 'new', name: '帽子', category: '衣物', length: 12, width: 12, height: 5, weight: 0.2, priority: 2, mustHave: false });
    expect(planner.state.items).toHaveLength(initial + 1);
    expect(planner.isStale.value).toBe(true);
    planner.updateItem('new', { name: '遮阳帽' });
    expect(planner.state.items.find((item) => item.id === 'new')?.name).toBe('遮阳帽');
    planner.removeItem('new');
    expect(planner.state.items).toHaveLength(initial);
  });

  it('regenerates plans and persists the selected mode', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    planner.updateSuitcase({ maxWeight: 12 });
    expect(planner.isStale.value).toBe(true);
    planner.regenerate();
    planner.selectPlan('shopping');
    expect(planner.isStale.value).toBe(false);
    expect(planner.plans.value.shopping.name).toBe('购物版');
    expect(repository.saved?.selectedPlan).toBe('shopping');
  });

  it('confirms the first rechecked trip immediately', () => {
    const planner = usePlanner({ repository: new MemoryRepository(), printPort: { print() {} } });
    expect(planner.confirmedTrip.value).toBeNull();
    planner.recheckTrip();
    expect(planner.confirmedTrip.value).not.toBeNull();
    expect(planner.draftTrip.value).toBeNull();
    expect(planner.confirmedTrip.value?.segments).toHaveLength(planner.state.tripSegments.length);
  });

  it('keeps the confirmed route until the new draft is accepted', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    planner.recheckTrip();
    const confirmedId = planner.confirmedTrip.value?.id;
    planner.updateSegment(planner.state.tripSegments[0].id, { maxWeight: 1 });
    expect(planner.tripStale.value).toBe(true);
    planner.recheckTrip();
    expect(planner.tripStale.value).toBe(false);
    expect(planner.confirmedTrip.value?.id).toBe(confirmedId);
    expect(planner.draftTrip.value).not.toBeNull();
    planner.acceptTrip();
    expect(planner.confirmedTrip.value?.id).not.toBe(confirmedId);
    expect(planner.draftTrip.value).toBeNull();
    expect(repository.saved?.confirmedTrip?.id).toBe(planner.confirmedTrip.value?.id);
  });

  it('discards a draft route without touching the confirmed one', () => {
    const planner = usePlanner({ repository: new MemoryRepository(), printPort: { print() {} } });
    planner.recheckTrip();
    const confirmedId = planner.confirmedTrip.value?.id;
    planner.addSegment();
    planner.recheckTrip();
    expect(planner.draftTrip.value).not.toBeNull();
    planner.discardTrip();
    expect(planner.draftTrip.value).toBeNull();
    expect(planner.confirmedTrip.value?.id).toBe(confirmedId);
  });

  it('clamps item carry ranges to the trip length', () => {
    const planner = usePlanner({ repository: new MemoryRepository(), printPort: { print() {} } });
    const target = planner.state.items[0];
    planner.updateItemCarry(target.id, 1, 99);
    const updated = planner.state.items.find((item) => item.id === target.id);
    expect(updated?.carryFrom).toBe(1);
    expect(updated?.carryTo).toBe(planner.state.tripSegments.length - 1);
    planner.updateItemCarry(target.id, 2, 0);
    expect(planner.state.items.find((item) => item.id === target.id)?.carryTo).toBe(2);
  });
});
