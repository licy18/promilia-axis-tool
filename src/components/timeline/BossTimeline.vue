<template>
  <div class="boss-timeline-container">
    <div class="boss-timeline-header">
      <h4>BOSS时间轴</h4>
      <el-button size="small" @click="addEvent">
        <el-icon><Plus /></el-icon>
        添加事件
      </el-button>
    </div>
    <div class="boss-timeline-content" :style="{ width: `${totalWidth}px` }">
      <div class="time-scale">
        <div
          v-for="tick in timeTicks"
          :key="tick.frame"
          class="time-tick"
          :style="{ left: `${tick.position}px` }"
        >
          <div class="tick-mark"></div>
          <div class="tick-label">{{ tick.label }}</div>
        </div>
      </div>
      <div class="boss-events">
        <div
          v-for="event in bossEvents"
          :key="event.id"
          class="boss-event"
          :style="{ left: `${event.frame * scale}px` }"
          @click="selectEvent(event.id)"
        >
          <div class="event-icon" :style="{ backgroundColor: event.color }"></div>
          <div class="event-info">
            <div class="event-name">{{ event.name }}</div>
            <div class="event-time">{{ event.frame }}帧</div>
          </div>
          <div class="event-actions">
            <el-button
              size="mini"
              @click.stop="editEvent(event)"
              :title="'编辑'"
            >
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button
              size="mini"
              type="danger"
              @click.stop="deleteEvent(event.id)"
              :title="'删除'"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 事件编辑对话框 -->
    <el-dialog
      v-model="eventEditVisible"
      title="编辑BOSS事件"
      width="400px"
    >
      <el-form :model="eventEditForm" label-width="80px">
        <el-form-item label="事件名称">
          <el-input v-model="eventEditForm.name" />
        </el-form-item>
        <el-form-item label="时间点">
          <el-input v-model.number="eventEditForm.frame" type="number" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="eventEditForm.color" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input type="textarea" v-model="eventEditForm.description" rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="eventEditVisible = false">取消</el-button>
          <el-button type="primary" @click="saveEvent">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Plus, Edit, Delete } from '@element-plus/icons-vue';

const props = defineProps({
  bossEvents: {
    type: Array,
    default: () => []
  },
  scale: {
    type: Number,
    default: 2
  },
  totalWidth: {
    type: Number,
    default: 2400
  }
});

const emit = defineEmits(['event-select', 'event-add', 'event-update', 'event-delete']);

const eventEditVisible = ref(false);
const eventEditForm = ref({
  id: '',
  name: '',
  frame: 0,
  color: '#E6A23C',
  description: ''
});

const timeTicks = computed(() => {
  const ticks = [];
  const duration = 1200; // 假设总时长为1200帧
  const step = Math.max(1, Math.floor(duration / 20));

  for (let i = 0; i <= duration; i += step) {
    ticks.push({
      frame: i,
      position: i * props.scale,
      label: i
    });
  }
  return ticks;
});

const addEvent = () => {
  const newEvent = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    name: '新事件',
    frame: 0,
    color: '#E6A23C',
    description: ''
  };
  eventEditForm.value = { ...newEvent };
  eventEditVisible.value = true;
};

const editEvent = (event) => {
  eventEditForm.value = { ...event };
  eventEditVisible.value = true;
};

const saveEvent = () => {
  if (eventEditForm.value.id) {
    emit('event-update', eventEditForm.value);
  } else {
    emit('event-add', eventEditForm.value);
  }
  eventEditVisible.value = false;
};

const deleteEvent = (eventId) => {
  emit('event-delete', eventId);
};

const selectEvent = (eventId) => {
  emit('event-select', eventId);
};
</script>

<style scoped>
.boss-timeline-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.boss-timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-color-light);
}

.boss-timeline-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.boss-timeline-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: var(--bg-color);
}

.time-scale {
  position: relative;
  height: 20px;
  border-bottom: 1px solid var(--border-color-light);
}

.time-tick {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tick-mark {
  width: 1px;
  flex: 1;
  background-color: var(--border-color-light);
}

.tick-label {
  font-size: 10px;
  color: var(--text-color-secondary);
  margin-top: 2px;
}

.boss-events {
  position: relative;
  flex: 1;
  padding: 8px 0;
}

.boss-event {
  position: absolute;
  top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-color-light);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.boss-event:hover {
  background-color: var(--bg-color-hover);
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.event-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.event-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.event-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-color);
}

.event-time {
  font-size: 10px;
  color: var(--text-color-secondary);
}

.event-actions {
  display: flex;
  gap: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>