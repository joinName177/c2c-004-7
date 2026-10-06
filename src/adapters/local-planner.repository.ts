import { createDefaultTripSegments, createSampleSnapshot } from '../core/sample-data';
import type { PackingSnapshot } from '../core/models';
import type { LoadResult, PlannerRepository } from '../ports/planner-repository.port';

const KEY = 'c2c-004.planner';

/** 兼容旧版本地数据：补充分段行程字段 */
function normalizeSnapshot(snapshot: PackingSnapshot): PackingSnapshot {
  const tripSegments = Array.isArray(snapshot.tripSegments) && snapshot.tripSegments.length
    ? snapshot.tripSegments
    : createDefaultTripSegments(snapshot.suitcase);
  return { ...snapshot, tripSegments, confirmedTrip: snapshot.confirmedTrip ?? null };
}

export class LocalPlannerRepository implements PlannerRepository {
  constructor(private readonly storage: Storage) {}

  load(): LoadResult<PackingSnapshot> {
    const raw = this.storage.getItem(KEY);
    if (!raw) return { value: createSampleSnapshot() };
    try {
      return { value: normalizeSnapshot(JSON.parse(raw) as PackingSnapshot) };
    } catch {
      return { value: createSampleSnapshot(), warning: '本地数据无法读取，已恢复示例。' };
    }
  }

  save(snapshot: PackingSnapshot): void {
    this.storage.setItem(KEY, JSON.stringify(snapshot));
  }
}
