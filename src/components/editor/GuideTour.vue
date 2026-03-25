<template>
  <div v-if="showTour" class="guide-tour">
    <div class="guide-overlay" @click="nextStep"></div>
    <div
      class="guide-step"
      :class="{ active: currentStep === step.index }"
      v-for="step in steps"
      :key="step.index"
    >
      <div class="guide-content" :style="step.position">
        <h3>{{ step.title }}</h3>
        <p>{{ step.description }}</p>
        <div class="guide-actions">
          <el-button v-if="currentStep > 0" @click="prevStep">{{
            $t('common.previous')
          }}</el-button>
          <el-button type="primary" @click="nextStep">
            {{
              currentStep === steps.length - 1
                ? $t('common.finish')
                : $t('common.next')
            }}
          </el-button>
        </div>
      </div>
      <div class="guide-arrow" :class="step.arrowDirection"></div>
    </div>
    <div class="guide-progress">
      <div class="guide-progress-bar">
        <div
          class="guide-progress-fill"
          :style="{ width: (currentStep / (steps.length - 1)) * 100 + '%' }"
        ></div>
      </div>
      <div class="guide-progress-text">
        {{ currentStep + 1 }} / {{ steps.length }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const showTour = ref(false);
const currentStep = ref(0);

const steps = ref([
  {
    index: 0,
    title: '欢迎使用排轴编辑器',
    description:
      '这是一个专为《蓝色星原：旅谣》设计的排轴工具，帮助您规划和优化战斗策略。',
    position: { top: '20%', left: '50%', transform: 'translateX(-50%)' },
    arrowDirection: 'bottom',
  },
  {
    index: 1,
    title: '技能库',
    description: '从这里选择角色技能，拖拽到时间轴上进行排轴。',
    position: { top: '20%', left: '15%' },
    arrowDirection: 'right',
  },
  {
    index: 2,
    title: '时间轴',
    description:
      '在这里编辑技能的释放时间和顺序，拖拽技能块可以调整位置和持续时间。',
    position: { top: '20%', left: '50%', transform: 'translateX(-50%)' },
    arrowDirection: 'bottom',
  },
  {
    index: 3,
    title: '控制面板',
    description: '使用这里的按钮进行播放预览、保存排轴等操作。',
    position: { bottom: '15%', left: '50%', transform: 'translateX(-50%)' },
    arrowDirection: 'top',
  },
  {
    index: 4,
    title: '完成',
    description:
      '现在您已经了解了排轴编辑器的基本功能，开始创建您的第一个排轴吧！',
    position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    arrowDirection: 'none',
  },
]);

const nextStep = () => {
  if (currentStep.value < steps.value.length - 1) {
    currentStep.value++;
  } else {
    showTour.value = false;
    localStorage.setItem('promilia_axis_tour_completed', 'true');
  }
};

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
};

const startTour = () => {
  showTour.value = true;
  currentStep.value = 0;
};

onMounted(() => {
  const tourCompleted = localStorage.getItem('promilia_axis_tour_completed');
  if (!tourCompleted) {
    setTimeout(() => {
      showTour.value = true;
    }, 1000);
  }
});

defineExpose({
  startTour,
});
</script>

<style scoped>
.guide-tour {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
}

.guide-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
}

.guide-step {
  position: absolute;
  display: none;
  z-index: 10000;
}

.guide-step.active {
  display: block;
}

.guide-content {
  position: relative;
  background-color: var(--bg-color-light);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  max-width: 300px;
  box-shadow: var(--box-shadow);
}

.guide-content h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--text-color);
}

.guide-content p {
  font-size: 14px;
  margin-bottom: 20px;
  color: var(--text-color-secondary);
  line-height: 1.5;
}

.guide-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.guide-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 10px solid transparent;
}

.guide-arrow.top {
  bottom: -20px;
  left: 20px;
  border-top-color: var(--bg-color-light);
}

.guide-arrow.bottom {
  top: -20px;
  left: 20px;
  border-bottom-color: var(--bg-color-light);
}

.guide-arrow.left {
  right: -20px;
  top: 20px;
  border-left-color: var(--bg-color-light);
}

.guide-arrow.right {
  left: -20px;
  top: 20px;
  border-right-color: var(--bg-color-light);
}

.guide-progress {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 10000;
}

.guide-progress-bar {
  width: 200px;
  height: 4px;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  overflow: hidden;
}

.guide-progress-fill {
  height: 100%;
  background-color: var(--primary-color);
  transition: width 0.3s ease;
}

.guide-progress-text {
  color: white;
  font-size: 14px;
}

@media (max-width: 768px) {
  .guide-content {
    max-width: 250px;
    padding: 15px;
  }

  .guide-content h3 {
    font-size: 14px;
  }

  .guide-content p {
    font-size: 12px;
  }
}
</style>
