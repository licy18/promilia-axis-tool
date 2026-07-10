<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="action-context-menu"
      :style="menuStyle"
      :data-menu-kind="mode"
      data-testid="workbench-action-context-menu"
      role="menu"
      @pointerdown.stop
      @contextmenu.prevent
    >
      <template v-if="mode === 'actions'">
        <button
          type="button"
          role="menuitem"
          data-testid="workbench-action-context-copy"
          :disabled="selectedCount === 0"
          @click="runCommand('copy')"
        >
          <CopyDocument />
          <span>复制</span>
          <kbd>Ctrl+C</kbd>
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="workbench-action-context-paste"
          :disabled="clipboardCount === 0"
          @click="runCommand('paste')"
        >
          <DocumentCopy />
          <span>粘贴到此处</span>
          <kbd>Ctrl+V</kbd>
        </button>
        <div class="menu-separator" role="separator"></div>
        <button
          type="button"
          role="menuitem"
          data-testid="workbench-action-context-nudge-left"
          :disabled="selectedCount === 0"
          @click="runCommand('nudge-left')"
        >
          <ArrowLeft />
          <span>前移 1 帧</span>
          <kbd>←</kbd>
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="workbench-action-context-nudge-right"
          :disabled="selectedCount === 0"
          @click="runCommand('nudge-right')"
        >
          <ArrowRight />
          <span>后移 1 帧</span>
          <kbd>→</kbd>
        </button>
        <div class="menu-separator" role="separator"></div>
        <button
          class="danger"
          type="button"
          role="menuitem"
          data-testid="workbench-action-context-delete"
          :disabled="selectedCount === 0"
          @click="runCommand('delete')"
        >
          <Delete />
          <span>删除所选动作</span>
          <kbd>Del</kbd>
        </button>
      </template>
      <button
        v-else
        class="danger"
        type="button"
        role="menuitem"
        data-testid="workbench-action-context-delete-relation"
        @click="runCommand('delete-relation')"
      >
        <Delete />
        <span>删除动作关系</span>
        <kbd>Del</kbd>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import {
  ArrowLeft,
  ArrowRight,
  CopyDocument,
  Delete,
  DocumentCopy,
} from '@element-plus/icons-vue';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

const props = defineProps({
  mode: {
    type: String,
    default: 'actions',
  },
  visible: {
    type: Boolean,
    default: false,
  },
  x: {
    type: Number,
    default: 0,
  },
  y: {
    type: Number,
    default: 0,
  },
  selectedCount: {
    type: Number,
    default: 0,
  },
  clipboardCount: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits([
  'close',
  'copy',
  'paste',
  'nudge-left',
  'nudge-right',
  'delete',
  'delete-relation',
]);
const menuRef = ref(null);
const position = ref({ left: 8, top: 8 });
const menuStyle = computed(() => ({
  left: `${position.value.left}px`,
  top: `${position.value.top}px`,
}));

watch(
  () => [props.visible, props.x, props.y],
  async () => {
    if (!props.visible) {
      return;
    }
    await nextTick();
    updatePosition();
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('pointerdown', closeMenu);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', closeMenu, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', closeMenu);
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('resize', closeMenu);
  window.removeEventListener('scroll', closeMenu, true);
});

function updatePosition() {
  const rect = menuRef.value?.getBoundingClientRect();
  const width = rect?.width || 220;
  const height = rect?.height || 210;
  position.value = {
    left: clampNumber(props.x, 8, Math.max(8, window.innerWidth - width - 8)),
    top: clampNumber(props.y, 8, Math.max(8, window.innerHeight - height - 8)),
  };
}

function runCommand(command) {
  emit(command);
  emit('close');
}

function closeMenu() {
  if (props.visible) {
    emit('close');
  }
}

function handleKeydown(event) {
  if (props.visible && event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}
</script>

<style scoped>
.action-context-menu {
  position: fixed;
  z-index: 3000;
  display: grid;
  width: 220px;
  padding: 6px;
  border: 1px solid rgba(121, 199, 185, 0.34);
  border-radius: 6px;
  background: #171d22;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}

button {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 6px 8px;
  border: 0;
  border-radius: 4px;
  color: #dce7e5;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

button:hover:not(:disabled),
button:focus-visible {
  outline: none;
  background: rgba(121, 199, 185, 0.13);
}

button:disabled {
  color: #657179;
  cursor: default;
}

button.danger:hover:not(:disabled),
button.danger:focus-visible {
  color: #ffaaa5;
  background: rgba(245, 108, 108, 0.12);
}

svg {
  width: 16px;
  height: 16px;
}

kbd {
  color: #84939b;
  font: inherit;
  font-size: 11px;
}

.menu-separator {
  height: 1px;
  margin: 4px 2px;
  background: rgba(255, 255, 255, 0.08);
}
</style>
