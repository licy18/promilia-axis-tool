<template>
  <span
    class="timeline-initial-energy-editor"
    @click.stop
    @mousedown.stop
    @pointerdown.stop
  >
    <span class="timeline-initial-energy-owner">{{ label }}</span>
    <input
      :value="displayValue"
      type="number"
      min="0"
      :max="normalizedMaxValue"
      :step="normalizedStepValue"
      :aria-label="`${label}${isSpecialResource ? '初始值' : '初始能量'}`"
      :data-owner-kind="ownerKind"
      :data-actor-id="actorId"
      :data-character-id="characterId"
      :data-team-slot-id="slotId"
      :data-kibo-id="kiboId"
      :data-resource-identity="resourceIdentity"
      :data-testid="
        isSpecialResource
          ? 'workbench-timeline-initial-special-resource-input'
          : 'workbench-timeline-initial-energy-input'
      "
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
      @click.stop
      @dblclick.stop
      @mousedown.stop
      @pointerdown.stop
      @wheel.stop
    />
    <span class="timeline-initial-energy-max">
      / {{ formatEnergyValue(normalizedMaxValue) }}
    </span>
  </span>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    required: true,
  },
  maxValue: {
    type: Number,
    required: true,
  },
  stepValue: {
    type: Number,
    default: 0.01,
  },
  ownerKind: {
    type: String,
    required: true,
  },
  actorId: {
    type: String,
    default: '',
  },
  characterId: {
    type: [Number, String],
    default: '',
  },
  slotId: {
    type: String,
    default: '',
  },
  kiboId: {
    type: [Number, String],
    default: '',
  },
  resourceIdentity: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['commit']);
const normalizedMaxValue = computed(() => normalizeMaxValue(props.maxValue));
const normalizedStepValue = computed(() => normalizeStepValue(props.stepValue));
const isSpecialResource = computed(() => props.ownerKind === 'special-resource');
const draftValue = ref(formatEnergyValue(props.value));
const dirty = ref(false);
const displayValue = computed(() =>
  dirty.value ? draftValue.value : formatEnergyValue(props.value)
);

function handleInput(event) {
  draftValue.value = event.currentTarget.value;
  dirty.value = true;
}

function handleFocus() {
  draftValue.value = formatEnergyValue(props.value);
  dirty.value = false;
}

function handleBlur() {
  commitDraft();
}

function handleKeydown(event) {
  event.stopPropagation();
  if (event.key === 'Enter') {
    event.preventDefault();
    commitDraft();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    dirty.value = false;
    draftValue.value = formatEnergyValue(props.value);
    event.currentTarget.blur();
  }
}

function commitDraft() {
  if (!dirty.value) {
    draftValue.value = formatEnergyValue(props.value);
    return;
  }
  const parsedValue = Number(draftValue.value);
  if (draftValue.value === '' || !Number.isFinite(parsedValue)) {
    dirty.value = false;
    draftValue.value = formatEnergyValue(props.value);
    return;
  }
  const clampedValue = Math.min(
    normalizedMaxValue.value,
    Math.max(0, parsedValue)
  );
  if (!isValueAlignedToStep(clampedValue, normalizedStepValue.value)) {
    dirty.value = false;
    draftValue.value = formatEnergyValue(props.value);
    return;
  }
  const nextValue = roundInputValue(clampedValue, normalizedStepValue.value);
  dirty.value = false;
  draftValue.value = formatEnergyValue(nextValue);
  if (
    nextValue !== roundInputValue(props.value, normalizedStepValue.value)
  ) {
    emit('commit', nextValue);
  }
}

function normalizeMaxValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeStepValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0.01;
}

function isValueAlignedToStep(value, step) {
  const ratio = Number(value) / Number(step);
  return Math.abs(ratio - Math.round(ratio)) < 1e-8;
}

function roundInputValue(value, step = normalizedStepValue.value) {
  const precision = Math.min(
    8,
    Math.max(0, String(step).split('.')[1]?.length ?? 0)
  );
  const factor = 10 ** precision;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function formatEnergyValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(roundInputValue(number)) : '0';
}
</script>

<style scoped>
.timeline-initial-energy-editor {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) 54px auto;
  align-items: center;
  gap: 3px;
  color: #a9b4b9;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
}

.timeline-initial-energy-owner {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

input {
  box-sizing: border-box;
  width: 54px;
  height: 18px;
  min-width: 0;
  padding: 0 3px;
  border: 1px solid #46535a;
  border-radius: 2px;
  outline: 0;
  background: #0b1114;
  color: #f3f7f8;
  font: inherit;
  text-align: right;
}

input:focus-visible {
  border-color: var(--lane-accent, #79c7b9);
  box-shadow: 0 0 0 1px var(--lane-accent, #79c7b9);
}

.timeline-initial-energy-max {
  white-space: nowrap;
}
</style>
