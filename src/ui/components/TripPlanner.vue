<script setup lang="ts">
import { computed } from 'vue';
import type { TripPlan, TripSegment } from '../../core/models';
import { validateTripSegments } from '../../core/trip-service';
import TripRoute from './TripRoute.vue';

const props = defineProps<{
  segments: TripSegment[];
  confirmedTrip: TripPlan | null;
  draftTrip: TripPlan | null;
  stale: boolean;
}>();
const emit = defineEmits<{
  addSegment: [];
  removeSegment: [id: string];
  updateSegment: [id: string, patch: Partial<TripSegment>];
  recheck: [];
  accept: [];
  discard: [];
}>();

const errors = computed(() => validateTripSegments(props.segments));
const displayedTrip = computed(() => props.draftTrip ?? props.confirmedTrip);
const numberInput = (event: Event) => Number((event.target as HTMLInputElement).value);
</script>

<template>
  <section class="panel trip-planner">
    <div class="section-title">
      <div><span>04 / TRIP ROUTE</span><h2>分段行程</h2></div>
      <b>{{ segments.length }} 段</b>
    </div>

    <div class="segment-editor">
      <div v-for="(segment, index) in segments" :key="segment.id" class="segment-row" :data-testid="`segment-editor-${index}`">
        <span class="segment-index">{{ index + 1 }}</span>
        <input class="segment-name" :aria-label="`第 ${index + 1} 段名称`" :value="segment.name" placeholder="路段名称" @input="emit('updateSegment', segment.id, { name: ($event.target as HTMLInputElement).value })" />
        <label>长<input :aria-label="`第 ${index + 1} 段长度`" type="number" min="1" :value="segment.length" @input="emit('updateSegment', segment.id, { length: numberInput($event) })" /></label>
        <label>宽<input :aria-label="`第 ${index + 1} 段宽度`" type="number" min="1" :value="segment.width" @input="emit('updateSegment', segment.id, { width: numberInput($event) })" /></label>
        <label>高<input :aria-label="`第 ${index + 1} 段高度`" type="number" min="1" :value="segment.height" @input="emit('updateSegment', segment.id, { height: numberInput($event) })" /></label>
        <label>限重<input :aria-label="`第 ${index + 1} 段限重`" type="number" min="0.5" step="0.5" :value="segment.maxWeight" @input="emit('updateSegment', segment.id, { maxWeight: numberInput($event) })" /></label>
        <button class="icon-button" type="button" :disabled="segments.length <= 1" :aria-label="`删除第 ${index + 1} 段`" @click="emit('removeSegment', segment.id)">×</button>
      </div>
      <button type="button" class="add-segment" data-testid="add-segment" @click="emit('addSegment')">＋ 添加路段</button>
      <p v-for="error in errors" :key="error" class="field-error">{{ error }}</p>
    </div>

    <div class="trip-actions">
      <button type="button" class="primary" data-testid="recheck-trip" :disabled="errors.length > 0" @click="emit('recheck')">
        {{ stale ? '行程已修改 · 重新检查' : '重新检查行程' }}
      </button>
      <span v-if="stale" class="trip-hint">路段或携带区间已变更，旧路线暂未更新</span>
    </div>

    <div v-if="displayedTrip" class="trip-banner" :class="displayedTrip.ready ? 'ready' : 'blocked'" data-testid="trip-banner">
      {{ displayedTrip.ready ? '✓ 整趟可出发' : '✕ 存在无解路段，整趟不可出发' }}
    </div>
    <p v-else class="trip-hint">尚未生成行程路线，点击“重新检查行程”开始规划。</p>

    <template v-if="draftTrip">
      <div class="trip-version pending">
        <header>
          <b>新路线 · 待确认</b>
          <div class="version-actions">
            <button type="button" class="primary" data-testid="accept-trip" @click="emit('accept')">接受新路线</button>
            <button type="button" data-testid="discard-trip" @click="emit('discard')">放弃</button>
          </div>
        </header>
        <TripRoute :trip="draftTrip" />
      </div>
    </template>
    <div v-if="confirmedTrip" class="trip-version" :class="{ superseded: !!draftTrip }">
      <header><b>{{ draftTrip ? '当前已确认路线（接受前保持有效）' : '已确认路线' }}</b></header>
      <TripRoute :trip="confirmedTrip" />
    </div>
  </section>
</template>
