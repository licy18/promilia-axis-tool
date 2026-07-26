<template>
  <div
    ref="viewportRef"
    class="windowed-list"
    :style="viewportStyle"
    :data-item-count="items.length"
    :data-mounted-row-count="visibleItems.length"
    :data-window-start="visibleRange.start"
    :data-window-end="visibleRange.end"
    @scroll.passive="handleScroll"
  >
    <div class="windowed-list-spacer" :style="spacerStyle">
      <div
        v-for="entry in visibleItems"
        :key="entry.key"
        class="windowed-list-row"
        :style="rowStyle(entry.index)"
        :data-windowed-index="entry.index"
      >
        <slot :item="entry.item" :index="entry.index" />
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
  itemHeight: {
    type: Number,
    default: 40,
  },
  maxHeight: {
    type: Number,
    default: 240,
  },
  overscan: {
    type: Number,
    default: 4,
  },
  selectedIndex: {
    type: Number,
    default: -1,
  },
  itemKey: {
    type: [String, Function],
    default: '',
  },
});

const viewportRef = ref(null);
const scrollTop = ref(0);
const measuredHeight = ref(0);
let resizeObserver = null;

const safeItemHeight = computed(() => Math.max(1, Number(props.itemHeight)));
const safeMaxHeight = computed(() => Math.max(1, Number(props.maxHeight)));
const contentHeight = computed(() => props.items.length * safeItemHeight.value);
const viewportHeight = computed(() =>
  Math.max(
    1,
    Math.min(
      contentHeight.value || safeItemHeight.value,
      measuredHeight.value || safeMaxHeight.value,
      safeMaxHeight.value
    )
  )
);
const visibleRange = computed(() => {
  const overscan = Math.max(0, Math.floor(Number(props.overscan) || 0));
  const start = Math.max(
    0,
    Math.floor(scrollTop.value / safeItemHeight.value) - overscan
  );
  const visibleCount =
    Math.ceil(viewportHeight.value / safeItemHeight.value) + overscan * 2;
  const end = Math.min(props.items.length, start + visibleCount);
  return { start, end };
});
const visibleItems = computed(() =>
  props.items
    .slice(visibleRange.value.start, visibleRange.value.end)
    .map((item, offset) => {
      const index = visibleRange.value.start + offset;
      return {
        item,
        index,
        key: resolveItemKey(item, index),
      };
    })
);
const viewportStyle = computed(() => ({
  height: `${viewportHeight.value}px`,
  maxHeight: `${safeMaxHeight.value}px`,
}));
const spacerStyle = computed(() => ({
  height: `${contentHeight.value}px`,
}));

watch(
  () => props.selectedIndex,
  index => {
    if (index >= 0) {
      void nextTick(() => scrollToIndex(index));
    }
  },
  { flush: 'post' }
);

watch(
  () => props.items.length,
  () => {
    void nextTick(() => {
      clampScrollTop();
      measureViewport();
    });
  }
);

onMounted(() => {
  measureViewport();
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(measureViewport);
    resizeObserver.observe(viewportRef.value);
  }
  if (props.selectedIndex >= 0) {
    void nextTick(() => scrollToIndex(props.selectedIndex));
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

function handleScroll(event) {
  scrollTop.value = Math.max(0, Number(event.currentTarget?.scrollTop) || 0);
}

function scrollToIndex(index, { align = 'nearest' } = {}) {
  const viewport = viewportRef.value;
  if (!viewport || !props.items.length) return;
  const safeIndex = Math.min(
    props.items.length - 1,
    Math.max(0, Math.floor(Number(index) || 0))
  );
  const rowTop = safeIndex * safeItemHeight.value;
  const rowBottom = rowTop + safeItemHeight.value;
  const currentTop = viewport.scrollTop;
  const currentBottom = currentTop + viewportHeight.value;
  let nextTop = currentTop;
  if (align === 'start' || rowTop < currentTop) {
    nextTop = rowTop;
  } else if (align === 'end' || rowBottom > currentBottom) {
    nextTop = rowBottom - viewportHeight.value;
  }
  viewport.scrollTop = Math.max(
    0,
    Math.min(nextTop, Math.max(0, contentHeight.value - viewportHeight.value))
  );
  scrollTop.value = viewport.scrollTop;
}

function clampScrollTop() {
  const viewport = viewportRef.value;
  if (!viewport) return;
  const maximum = Math.max(0, contentHeight.value - viewportHeight.value);
  if (viewport.scrollTop > maximum) {
    viewport.scrollTop = maximum;
    scrollTop.value = maximum;
  }
}

function measureViewport() {
  const height = Number(viewportRef.value?.clientHeight) || 0;
  if (height > 0) {
    measuredHeight.value = Math.min(height, safeMaxHeight.value);
  }
}

function resolveItemKey(item, index) {
  if (typeof props.itemKey === 'function') {
    return props.itemKey(item, index);
  }
  if (props.itemKey && item?.[props.itemKey] != null) {
    return item[props.itemKey];
  }
  return item?.id ?? item?.key ?? index;
}

function rowStyle(index) {
  return {
    height: `${safeItemHeight.value}px`,
    transform: `translateY(${index * safeItemHeight.value}px)`,
  };
}

defineExpose({
  scrollToIndex,
  visibleRange,
  mountedCount: computed(() => visibleItems.value.length),
});
</script>

<style scoped>
.windowed-list {
  position: relative;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.windowed-list-spacer {
  position: relative;
  min-width: 0;
}

.windowed-list-row {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  box-sizing: border-box;
  min-width: 0;
}
</style>
