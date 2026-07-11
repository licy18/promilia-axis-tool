<template>
  <div class="project-drop-host" data-testid="workbench-project-drop-host">
    <div
      v-if="active"
      class="project-drop-overlay"
      data-testid="workbench-project-drop-overlay"
      role="status"
      aria-live="polite"
    >
      <div class="project-drop-content">
        <UploadFilled class="project-drop-icon" />
        <strong>释放以导入项目</strong>
        <span>JSON / PNG</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { UploadFilled } from '@element-plus/icons-vue';
import { createWorkbenchProjectDropController } from '../../domain/workbenchProjectFileReceiver';

const emit = defineEmits(['files']);
const active = ref(false);
let controller = null;

onMounted(() => {
  controller = createWorkbenchProjectDropController({
    target: window,
    onActiveChange: value => {
      active.value = value;
    },
    onFiles: files => emit('files', files),
  });
  controller.mount();
});

onBeforeUnmount(() => {
  controller?.unmount();
  controller = null;
});
</script>

<style scoped>
.project-drop-host {
  display: contents;
}

.project-drop-overlay {
  position: fixed;
  z-index: 10000;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
  background: rgba(8, 12, 15, 0.9);
}

.project-drop-content {
  display: grid;
  justify-items: center;
  gap: 12px;
  color: #effffc;
}

.project-drop-icon {
  width: 54px;
  height: 54px;
  color: #79c7b9;
}

.project-drop-content strong {
  font-size: 20px;
}

.project-drop-content span {
  color: #94a5ad;
  font-size: 12px;
}
</style>
