import { computed, reactive, ref } from 'vue';
import { createSampleSnapshot } from '../core/sample-data';
import { generatePlans } from '../core/plan-service';
import { detectRisks } from '../core/risk-engine';
import { computeJourneyRoute, createDefaultJourney } from '../core/journey-service';
import type { JourneySegment, PackingItem, PackingSnapshot, PlanMode, Suitcase } from '../core/models';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';

export interface PlannerDependencies { repository: PlannerRepository; printPort: PrintPort }

export function usePlanner({ repository, printPort }: PlannerDependencies) {
  const loaded = repository.load();
  const state = reactive<PackingSnapshot>(loaded.value);
  if (!state.journey?.segments?.length) state.journey = createDefaultJourney(state.suitcase);
  const notice = ref(loaded.warning ?? '');
  const isStale = ref(false);
  const plans = ref(generatePlans(state.suitcase, state.items));
  const currentPlan = computed(() => plans.value[state.selectedPlan]);
  const risks = computed(() => detectRisks(currentPlan.value, state.suitcase, state.items));

  // 新输入会即时重算草稿路线，但已确认的旧路线在用户接受前保持有效
  const draftRoute = computed(() => computeJourneyRoute(state.journey.segments, state.items, state.selectedPlan));
  const journeyDirty = computed(() => !state.journey.confirmedRoute || state.journey.confirmedRoute.signature !== draftRoute.value.signature);
  const displayRoute = computed(() => (journeyDirty.value && state.journey.confirmedRoute ? state.journey.confirmedRoute : draftRoute.value));
  const canDepart = computed(() => !journeyDirty.value && draftRoute.value.canDepart);

  const save = () => repository.save(JSON.parse(JSON.stringify(state)) as PackingSnapshot);
  const markStale = () => { isStale.value = true; save(); };

  function addItem(item: PackingItem) { state.items.push(item); markStale(); }
  function updateItem(id: string, patch: Partial<PackingItem>) {
    const index = state.items.findIndex((item) => item.id === id);
    if (index >= 0) state.items[index] = { ...state.items[index], ...patch } as PackingItem;
    markStale();
  }
  function removeItem(id: string) { state.items = state.items.filter((item) => item.id !== id); markStale(); }
  function updateSuitcase(patch: Partial<Suitcase>) { Object.assign(state.suitcase, patch); markStale(); }
  function regenerate() { plans.value = generatePlans(state.suitcase, state.items); isStale.value = false; notice.value = '三套方案已重新计算'; save(); }
  function selectPlan(mode: PlanMode) { state.selectedPlan = mode; save(); }

  function addSegment() {
    const index = state.journey.segments.length + 1;
    const id = `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    state.journey.segments.push({ id, name: `第 ${index} 段`, suitcase: { ...state.suitcase } });
    save();
  }
  function updateSegment(id: string, patch: Partial<JourneySegment>) {
    const segment = state.journey.segments.find((entry) => entry.id === id);
    if (segment) Object.assign(segment, patch);
    save();
  }
  function updateSegmentSuitcase(id: string, patch: Partial<Suitcase>) {
    const segment = state.journey.segments.find((entry) => entry.id === id);
    if (segment) Object.assign(segment.suitcase, patch);
    save();
  }
  function removeSegment(id: string) {
    if (state.journey.segments.length <= 1) return;
    state.journey.segments = state.journey.segments.filter((segment) => segment.id !== id);
    save();
  }
  function updateCarryWindow(id: string, patch: { carryFrom?: number; carryTo?: number }) { updateItem(id, patch); }
  function acceptRoute() {
    state.journey.confirmedRoute = JSON.parse(JSON.stringify(draftRoute.value));
    notice.value = '新路线已确认，整趟行程已更新';
    save();
  }

  function resetSample() {
    const sample = createSampleSnapshot();
    Object.assign(state, sample);
    plans.value = generatePlans(state.suitcase, state.items);
    isStale.value = false;
    notice.value = '已恢复登机箱示例';
    save();
  }

  return {
    state, notice, isStale, plans, currentPlan, risks,
    draftRoute, journeyDirty, displayRoute, canDepart,
    addItem, updateItem, removeItem, updateSuitcase, regenerate, selectPlan,
    addSegment, updateSegment, updateSegmentSuitcase, removeSegment, updateCarryWindow, acceptRoute,
    resetSample, print: () => printPort.print(),
  };
}
