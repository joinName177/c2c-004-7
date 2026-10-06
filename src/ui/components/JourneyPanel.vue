<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { carryWindow } from '../../core/journey-service';
import type { JourneyRoute, JourneySegment, PackingItem, SegmentHandoff, Suitcase } from '../../core/models';
import PackingProjection from './PackingProjection.vue';

const props = defineProps<{
  segments: JourneySegment[];
  items: PackingItem[];
  /** 当前生效的路线（有未确认变更时为旧路线） */
  route: JourneyRoute;
  /** 按当前输入即时重算的草稿路线 */
  draft: JourneyRoute;
  dirty: boolean;
  canDepart: boolean;
  hasConfirmed: boolean;
}>();

const emit = defineEmits<{
  'add-segment': [];
  'remove-segment': [id: string];
  'update-segment': [id: string, patch: Partial<JourneySegment>];
  'update-segment-suitcase': [id: string, patch: Partial<Suitcase>];
  'update-carry': [id: string, patch: { carryFrom?: number; carryTo?: number }];
  accept: [];
}>();

const previewDraft = ref(false);
const previewIndex = ref(0);
const selectedItem = ref('');
watch(() => props.dirty, () => { previewDraft.value = false; });

const shownRoute = computed(() => (props.dirty && props.hasConfirmed && previewDraft.value ? props.draft : props.route));
const clampedIndex = computed(() => Math.min(previewIndex.value, Math.max(shownRoute.value.results.length - 1, 0)));
const previewResult = computed(() => shownRoute.value.results[clampedIndex.value]);

const depart = computed(() => {
  if (props.dirty) return { label: '路线待确认', class: 'pending' };
  if (!props.route.results.length) return { label: '未规划', class: 'pending' };
  return props.canDepart ? { label: '可出发', class: 'ok' } : { label: '不可出发', class: 'bad' };
});

const windowOf = (item: PackingItem) => carryWindow(item, props.segments.length);
const handoffGroups = (handoff: SegmentHandoff) => [
  { label: '取出', items: handoff.removed },
  { label: '新增', items: handoff.added },
  { label: '需重排', items: handoff.rearranged },
];
const numberOf = (event: Event) => Number((event.target as HTMLInputElement).value);
</script>

<template>
  <section class="panel journey-panel">
    <div class="section-title">
      <div><span>04 / JOURNEY</span><h2>分段行程规划</h2></div>
      <b class="depart-badge" :class="depart.class" data-testid="depart-status">{{ depart.label }}</b>
    </div>

    <div class="segment-editors">
      <article v-for="(segment, index) in segments" :key="segment.id" class="segment-card">
        <header>
          <input class="segment-name" :value="segment.name" :aria-label="`第 ${index + 1} 段名称`" @input="emit('update-segment', segment.id, { name: ($event.target as HTMLInputElement).value })" />
          <button v-if="segments.length > 1" class="icon-button" type="button" :aria-label="`删除 ${segment.name}`" @click="emit('remove-segment', segment.id)">×</button>
        </header>
        <div class="segment-dims">
          <label>长 CM<input type="number" min="1" :value="segment.suitcase.length" :aria-label="`${segment.name} 长度`" @input="emit('update-segment-suitcase', segment.id, { length: numberOf($event) })" /></label>
          <label>宽 CM<input type="number" min="1" :value="segment.suitcase.width" :aria-label="`${segment.name} 宽度`" @input="emit('update-segment-suitcase', segment.id, { width: numberOf($event) })" /></label>
          <label>高 CM<input type="number" min="1" :value="segment.suitcase.height" :aria-label="`${segment.name} 高度`" @input="emit('update-segment-suitcase', segment.id, { height: numberOf($event) })" /></label>
          <label>承重 KG<input type="number" min="0.5" step="0.5" :value="segment.suitcase.maxWeight" :aria-label="`${segment.name} 承重`" @input="emit('update-segment-suitcase', segment.id, { maxWeight: numberOf($event) })" /></label>
        </div>
      </article>
      <button class="add-segment" type="button" data-testid="add-segment" @click="emit('add-segment')">＋ 添加路段</button>
    </div>

    <div class="carry-table">
      <header>物品携带区间（从哪段开始携带、到哪段结束）</header>
      <div v-for="item in items" :key="item.id" class="carry-row">
        <span>{{ item.name }}<i v-if="item.mustHave">必带</i></span>
        <label>从
          <select :value="windowOf(item).from" :aria-label="`${item.name} 起始段`" @change="emit('update-carry', item.id, { carryFrom: numberOf($event) })">
            <option v-for="n in segments.length" :key="n" :value="n">第 {{ n }} 段</option>
          </select>
        </label>
        <label>到
          <select :value="windowOf(item).to" :aria-label="`${item.name} 结束段`" @change="emit('update-carry', item.id, { carryTo: numberOf($event) })">
            <option v-for="n in segments.length" :key="n" :value="n">第 {{ n }} 段</option>
          </select>
        </label>
      </div>
    </div>

    <div v-if="dirty" class="journey-banner">
      <p>行程已修改，受影响路段与后续交接已重新检查。接受前仍沿用已确认的旧路线。</p>
      <div class="banner-actions">
        <button v-if="hasConfirmed" type="button" data-testid="toggle-preview" @click="previewDraft = !previewDraft">{{ previewDraft ? '查看旧路线' : '预览新结果' }}</button>
        <button class="primary" type="button" data-testid="accept-route" @click="emit('accept')">接受新路线</button>
      </div>
    </div>
    <p v-else-if="!canDepart" class="journey-hint">有路段无解，请调整限额或清单；其余路段的计算结果已保留。</p>

    <div class="route-timeline">
      <template v-for="(result, index) in shownRoute.results" :key="result.segmentId">
        <article class="route-segment" :class="{ infeasible: !result.feasible }">
          <header>
            <b>{{ index + 1 }}</b>
            <div>
              <strong>{{ result.segmentName }}</strong>
              <span>{{ result.plan.placements.length }}/{{ result.activeItemIds.length }} 件 · {{ result.plan.totalWeight.toFixed(1) }}/{{ result.suitcase.maxWeight }}kg · {{ Math.round(result.plan.capacityRatio * 100) }}% 空间</span>
            </div>
            <i :class="result.feasible ? 'ok' : 'bad'">{{ result.feasible ? '可行' : '无解' }}</i>
          </header>
          <ul v-if="result.plan.unplaced.length" class="unplaced-list">
            <li v-for="entry in result.plan.unplaced" :key="entry.item.id">未装入 · {{ entry.item.name }} — {{ entry.reason }}</li>
          </ul>
          <ul v-if="result.risks.some((risk) => risk.severity !== 'info')" class="segment-risks">
            <li v-for="risk in result.risks.filter((risk) => risk.severity !== 'info')" :key="risk.id" :class="risk.severity">{{ risk.title }}：{{ risk.message }}</li>
          </ul>
        </article>
        <div v-if="shownRoute.handoffs[index]" class="handoff" :data-testid="`handoff-${index}`">
          <div v-for="group in handoffGroups(shownRoute.handoffs[index])" :key="group.label" class="handoff-group">
            <span>{{ group.label }}</span>
            <p>{{ group.items.length ? group.items.map((item) => item.name).join('、') : '无' }}</p>
          </div>
        </div>
      </template>
    </div>

    <div v-if="previewResult" class="segment-preview">
      <header>
        <span>分段摆放预览</span>
        <select v-model.number="previewIndex" aria-label="预览路段">
          <option v-for="(result, index) in shownRoute.results" :key="result.segmentId" :value="index">{{ result.segmentName }}</option>
        </select>
      </header>
      <div class="projections">
        <PackingProjection view="top" :plan="previewResult.plan" :suitcase="previewResult.suitcase" :items="items" :selected-id="selectedItem" @select="selectedItem = $event" />
        <PackingProjection view="side" :plan="previewResult.plan" :suitcase="previewResult.suitcase" :items="items" :selected-id="selectedItem" @select="selectedItem = $event" />
      </div>
    </div>
  </section>
</template>
