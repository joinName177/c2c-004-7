<script setup lang="ts">
import type { TripPlan } from '../../core/models';

defineProps<{ trip: TripPlan }>();

const handoffBefore = (trip: TripPlan, index: number) => trip.handoffs.find((handoff) => handoff.fromIndex === index - 1);
const names = (items: Array<{ name: string }>) => items.map((item) => item.name).join('、');
</script>

<template>
  <ol class="trip-route">
    <template v-for="segmentPlan in trip.segments" :key="segmentPlan.segment.id">
      <li v-if="segmentPlan.index > 0" class="handoff" :data-testid="`handoff-${segmentPlan.index}`">
        <span class="handoff-label">第 {{ segmentPlan.index }} 段 → 第 {{ segmentPlan.index + 1 }} 段交接</span>
        <template v-if="handoffBefore(trip, segmentPlan.index)">
          <span v-if="handoffBefore(trip, segmentPlan.index)!.removed.length" class="chip out">取出：{{ names(handoffBefore(trip, segmentPlan.index)!.removed) }}</span>
          <span v-if="handoffBefore(trip, segmentPlan.index)!.added.length" class="chip in">新增：{{ names(handoffBefore(trip, segmentPlan.index)!.added) }}</span>
          <span v-if="handoffBefore(trip, segmentPlan.index)!.rearranged.length" class="chip move">重排：{{ names(handoffBefore(trip, segmentPlan.index)!.rearranged) }}</span>
          <span v-if="!handoffBefore(trip, segmentPlan.index)!.removed.length && !handoffBefore(trip, segmentPlan.index)!.added.length && !handoffBefore(trip, segmentPlan.index)!.rearranged.length" class="chip">原样搬入下一段</span>
        </template>
      </li>
      <li class="segment-card" :class="{ infeasible: !segmentPlan.feasible }" :data-testid="`segment-${segmentPlan.index}`">
        <header>
          <div>
            <span>LEG {{ String(segmentPlan.index + 1).padStart(2, '0') }}</span>
            <h3>{{ segmentPlan.segment.name }}</h3>
            <small>{{ segmentPlan.segment.length }}×{{ segmentPlan.segment.width }}×{{ segmentPlan.segment.height }} cm · 限重 {{ segmentPlan.segment.maxWeight }} kg</small>
          </div>
          <b class="segment-status" :class="segmentPlan.feasible ? 'ok' : 'bad'">{{ segmentPlan.feasible ? '可行' : '无解' }}</b>
        </header>
        <div class="segment-metrics">
          <span><b>{{ segmentPlan.plan.placements.length }}</b>已装</span>
          <span><b>{{ Math.round(segmentPlan.plan.capacityRatio * 100) }}%</b>空间</span>
          <span><b>{{ segmentPlan.plan.totalWeight.toFixed(1) }}</b>kg</span>
          <span><b>{{ segmentPlan.plan.unplaced.length }}</b>未装</span>
        </div>
        <ul v-if="segmentPlan.plan.unplaced.length" class="unplaced-list">
          <li v-for="entry in segmentPlan.plan.unplaced" :key="entry.item.id">
            × {{ entry.item.name }}<i>{{ entry.reason }}</i>
          </li>
        </ul>
        <article v-for="risk in segmentPlan.risks" :key="risk.id" :class="['risk-row', risk.severity]">
          <i>{{ risk.severity === 'critical' ? '!' : risk.severity === 'warning' ? '△' : '✓' }}</i>
          <div><strong>{{ risk.title }}</strong><p>{{ risk.message }}</p></div>
        </article>
      </li>
    </template>
  </ol>
</template>
