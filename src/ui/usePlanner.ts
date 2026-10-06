import { computed, reactive, ref } from 'vue';
import { createSampleSnapshot } from '../core/sample-data';
import { generatePlans } from '../core/plan-service';
import { detectRisks } from '../core/risk-engine';
import { planTrip } from '../core/trip-service';
import type { PackingItem, PackingSnapshot, PlanMode, Suitcase, TripPlan, TripSegment } from '../core/models';
import type { PlannerRepository } from '../ports/planner-repository.port';
import type { PrintPort } from '../ports/print.port';

export interface PlannerDependencies { repository: PlannerRepository; printPort: PrintPort }

export function usePlanner({ repository, printPort }: PlannerDependencies) {
  const loaded = repository.load();
  const state = reactive<PackingSnapshot>(loaded.value);
  const notice = ref(loaded.warning ?? '');
  const isStale = ref(false);
  const plans = ref(generatePlans(state.suitcase, state.items));
  const currentPlan = computed(() => plans.value[state.selectedPlan]);
  const risks = computed(() => detectRisks(currentPlan.value, state.suitcase, state.items));

  const tripStale = ref(false);
  const confirmedTrip = ref<TripPlan | null>(state.confirmedTrip ?? null);
  const draftTrip = ref<TripPlan | null>(null);

  const save = () => {
    state.confirmedTrip = confirmedTrip.value ? JSON.parse(JSON.stringify(confirmedTrip.value)) as TripPlan : null;
    repository.save(JSON.parse(JSON.stringify(state)) as PackingSnapshot);
  };
  const markStale = () => { isStale.value = true; tripStale.value = true; save(); };

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
    state.tripSegments.push({
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `第 ${state.tripSegments.length + 1} 段`,
      length: state.suitcase.length,
      width: state.suitcase.width,
      height: state.suitcase.height,
      maxWeight: state.suitcase.maxWeight,
    });
    markStale();
  }
  function updateSegment(id: string, patch: Partial<TripSegment>) {
    const index = state.tripSegments.findIndex((segment) => segment.id === id);
    if (index >= 0) state.tripSegments[index] = { ...state.tripSegments[index], ...patch } as TripSegment;
    markStale();
  }
  function removeSegment(id: string) {
    if (state.tripSegments.length <= 1) return;
    state.tripSegments = state.tripSegments.filter((segment) => segment.id !== id);
    markStale();
  }
  function updateItemCarry(id: string, from: number, to: number) {
    const last = Math.max(state.tripSegments.length - 1, 0);
    const carryFrom = Math.min(Math.max(from, 0), last);
    const carryTo = Math.min(Math.max(to, carryFrom), last);
    updateItem(id, { carryFrom, carryTo });
  }

  /** 重新检查行程：生成待确认的新路线，已确认的旧路线保留到用户接受为止 */
  function recheckTrip() {
    const trip = planTrip(state.tripSegments, state.items);
    tripStale.value = false;
    if (!confirmedTrip.value) {
      confirmedTrip.value = trip;
      draftTrip.value = null;
      notice.value = trip.ready ? '行程路线已确认，整趟可出发' : '行程路线已确认，但存在无解路段';
    } else {
      draftTrip.value = trip;
      notice.value = '新路线已生成，接受后才会替换当前路线';
    }
    save();
  }
  function acceptTrip() {
    if (!draftTrip.value) return;
    confirmedTrip.value = draftTrip.value;
    draftTrip.value = null;
    notice.value = '已替换为新的行程路线';
    save();
  }
  function discardTrip() {
    if (!draftTrip.value) return;
    draftTrip.value = null;
    notice.value = '已放弃新路线，保留当前确认路线';
  }

  function resetSample() {
    const sample = createSampleSnapshot();
    Object.assign(state, sample);
    plans.value = generatePlans(state.suitcase, state.items);
    confirmedTrip.value = null;
    draftTrip.value = null;
    isStale.value = false;
    tripStale.value = false;
    notice.value = '已恢复登机箱示例';
    save();
  }

  return {
    state, notice, isStale, plans, currentPlan, risks,
    tripStale, confirmedTrip, draftTrip,
    addItem, updateItem, removeItem, updateSuitcase, regenerate, selectPlan,
    addSegment, updateSegment, removeSegment, updateItemCarry, recheckTrip, acceptTrip, discardTrip,
    resetSample, print: () => printPort.print(),
  };
}
