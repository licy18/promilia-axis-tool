<template>
  <div class="hit-list" data-testid="workbench-hit-override-panel">
    <div class="title">
      <span>场景命中</span>
      <strong
        >{{ hitBindings.length - disabledCount }}/{{
          hitBindings.length
        }}</strong
      >
    </div>
    <label
      v-for="hit in hitBindings"
      :key="hit.identity"
      class="row"
      :data-hit-identity="hit.identity"
      data-testid="workbench-hit-override-row"
      :title="hit.identity"
    >
      <input
        type="checkbox"
        :checked="hit.willHit"
        :aria-label="hit.label + ' 是否命中'"
        @change="$emit('change', hit.identity, $event.target.checked)"
      />
      <span>{{ hit.label }}</span>
      <small>{{ hit.frame }}F</small>
      <em>{{ formatScenarioStatus(hit) }}</em>
    </label>
  </div>
</template>

<script setup>
defineProps({
  hitBindings: { type: Array, default: () => [] },
  disabledCount: { type: Number, default: 0 },
});

defineEmits(['change']);

function formatScenarioStatus(hit) {
  if (hit.scenarioRuntimeStatus === 'scenario-assumed-zero-distance') {
    return '零距离';
  }
  return hit.sourceKind === 'projectile' ? '投射物' : '直接';
}
</script>

<style scoped>
.hit-list {
  display: grid;
  gap: 5px;
  margin: 10px 14px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
}

.title,
.row {
  display: grid;
  align-items: center;
  min-width: 0;
}

.title {
  grid-template-columns: 1fr auto;
  color: #aeb8be;
  font-size: 12px;
}

.title strong {
  color: #79c7b9;
}

.row {
  grid-template-columns: 16px minmax(0, 1fr) auto auto;
  gap: 7px;
  min-height: 26px;
  color: #d7dfe2;
  font-size: 11px;
}

.row input {
  width: 14px;
  height: 14px;
  margin: 0;
}

.row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row small,
.row em {
  color: #87949b;
  font-size: 9px;
  font-style: normal;
}
</style>
