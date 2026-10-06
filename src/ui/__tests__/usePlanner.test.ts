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

  it('manages segments and carry windows', () => {
    const planner = usePlanner({ repository: new MemoryRepository(), printPort: { print() {} } });
    planner.addSegment();
    expect(planner.state.journey.segments).toHaveLength(2);
    planner.updateCarryWindow('jacket', { carryFrom: 2 });
    expect(planner.draftRoute.value.results[0].activeItemIds).not.toContain('jacket');
    expect(planner.draftRoute.value.results[1].activeItemIds).toContain('jacket');
    planner.removeSegment(planner.state.journey.segments[1].id);
    expect(planner.state.journey.segments).toHaveLength(1);
    planner.removeSegment(planner.state.journey.segments[0].id);
    expect(planner.state.journey.segments).toHaveLength(1);
  });

  it('keeps the confirmed route until the new result is accepted', () => {
    const repository = new MemoryRepository();
    const planner = usePlanner({ repository, printPort: { print() {} } });
    expect(planner.journeyDirty.value).toBe(true);
    expect(planner.canDepart.value).toBe(false);
    planner.acceptRoute();
    expect(planner.journeyDirty.value).toBe(false);
    expect(planner.canDepart.value).toBe(true);

    const confirmedWeight = planner.state.journey.confirmedRoute?.results[0].plan.totalWeight;
    planner.updateSegmentSuitcase(planner.state.journey.segments[0].id, { maxWeight: 0.1 });
    expect(planner.journeyDirty.value).toBe(true);
    expect(planner.displayRoute.value.results[0].plan.totalWeight).toBe(confirmedWeight);
    expect(planner.canDepart.value).toBe(false);

    planner.acceptRoute();
    expect(planner.journeyDirty.value).toBe(false);
    expect(planner.displayRoute.value.results[0].plan.totalWeight).not.toBe(confirmedWeight);
    expect(planner.canDepart.value).toBe(false);
    expect(repository.saved?.journey.confirmedRoute?.signature).toBe(planner.draftRoute.value.signature);
  });
});
