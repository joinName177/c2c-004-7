<script setup lang="ts">
import type { PackingItem, TripSegment } from '../../core/models';

const props = defineProps<{ items: PackingItem[]; segments: TripSegment[] }>();
const emit = defineEmits<{
  remove: [id: string];
  toggle: [id: string, mustHave: boolean];
  carry: [id: string, from: number, to: number];
}>();

const carryFrom = (item: PackingItem) => item.carryFrom ?? 0;
const carryTo = (item: PackingItem) => Math.min(item.carryTo ?? props.segments.length - 1, props.segments.length - 1);
const pick = (event: Event) => Number((event.target as HTMLSelectElement).value);
</script>

<template>
  <div class="item-list">
    <article v-for="item in items" :key="item.id" class="item-row">
      <div class="item-icon">{{ item.category.slice(0, 1) }}</div>
      <div class="item-copy">
        <strong>{{ item.name }}</strong>
        <span>{{ item.length }}×{{ item.width }}×{{ item.height }} cm · {{ item.weight }} kg</span>
        <span v-if="segments.length > 1" class="carry-range">
          携带
          <select :aria-label="`${item.name} 开始段`" :value="carryFrom(item)" @change="emit('carry', item.id, pick($event), carryTo(item))">
            <option v-for="(segment, index) in segments" :key="segment.id" :value="index">{{ index + 1 }}</option>
          </select>
          →
          <select :aria-label="`${item.name} 结束段`" :value="carryTo(item)" @change="emit('carry', item.id, carryFrom(item), pick($event))">
            <option v-for="(segment, index) in segments" :key="segment.id" :value="index">{{ index + 1 }}</option>
          </select>
          段
        </span>
      </div>
      <button class="must-button" :class="{ checked: item.mustHave }" type="button" @click="emit('toggle', item.id, !item.mustHave)">{{ item.mustHave ? '必带' : '可选' }}</button>
      <b class="priority">P{{ item.priority }}</b>
      <button class="icon-button" type="button" :aria-label="`删除 ${item.name}`" @click="emit('remove', item.id)">×</button>
    </article>
  </div>
</template>
