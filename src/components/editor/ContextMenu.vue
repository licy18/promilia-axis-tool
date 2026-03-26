<template>
  <div 
    v-if="visible" 
    class="context-menu" 
    :style="menuStyle"
    @click.stop
  >
    <div 
      v-for="item in menuItems" 
      :key="item.id"
      class="menu-item"
      :class="{ 'menu-item-separator': item.type === 'separator' }"
      @click="handleMenuItemClick(item)"
    >
      <span v-if="item.icon" class="menu-item-icon">
        <component :is="item.icon" />
      </span>
      <span class="menu-item-label">{{ item.label }}</span>
      <span v-if="item.shortcut" class="menu-item-shortcut">{{ item.shortcut }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  menuItems: {
    type: Array,
    default: () => []
  }
});

// Emits
const emit = defineEmits(['select', 'close']);

// 计算属性：菜单样式
const menuStyle = computed(() => {
  return {
    left: `${props.position.x}px`,
    top: `${props.position.y}px`
  };
});

// 方法：处理菜单项点击
const handleMenuItemClick = (item) => {
  if (item.action) {
    emit('select', item.action, item.data);
  }
  emit('close');
};

// 监听点击事件，关闭菜单
const handleClickOutside = (event) => {
  if (props.visible) {
    emit('close');
  }
};

// 监听右键菜单事件，阻止默认行为
const handleContextMenu = (event) => {
  event.preventDefault();
};

// 组件挂载时添加事件监听器
import { onMounted, onUnmounted } from 'vue';
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('contextmenu', handleContextMenu);
});

// 组件卸载时移除事件监听器
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('contextmenu', handleContextMenu);
});
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 10000;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  min-width: 120px;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-color);
  transition: background-color 0.2s;
}

.menu-item:hover {
  background-color: var(--primary-color-light);
}

.menu-item-separator {
  height: 1px;
  background-color: var(--border-color);
  margin: 4px 0;
  padding: 0;
  cursor: default;
}

.menu-item-separator:hover {
  background-color: var(--border-color);
}

.menu-item-icon {
  margin-right: 8px;
  font-size: 14px;
  color: var(--text-color-secondary);
}

.menu-item-label {
  flex: 1;
}

.menu-item-shortcut {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-left: 8px;
}
</style>