<template>
  <el-dialog v-model="dialogVisible" title="编辑技能" width="500px">
    <el-form :model="skillForm" :rules="skillRules" ref="skillFormRef">
      <el-form-item label="技能名称" prop="skillName">
        <el-input v-model="skillForm.skillName" disabled />
      </el-form-item>

      <el-form-item label="角色" prop="characterName">
        <el-input v-model="skillForm.characterName" disabled />
      </el-form-item>

      <el-form-item label="释放时间" prop="startFrame">
        <el-input-number
          v-model="skillForm.startFrame"
          :min="0"
          :max="maxDuration"
          :step="1"
        />
        <span class="frame-hint">{{ formatTime(skillForm.startFrame) }}</span>
      </el-form-item>

      <el-form-item label="结束时间" prop="endFrame">
        <el-input-number
          v-model="skillForm.endFrame"
          :min="skillForm.startFrame + 10"
          :max="maxDuration"
          :step="1"
        />
        <span class="frame-hint">{{ formatTime(skillForm.endFrame) }}</span>
      </el-form-item>

      <el-form-item label="持续时间" prop="duration">
        <el-input-number
          v-model="skillForm.duration"
          :min="10"
          :max="maxDuration"
          :step="1"
          disabled
        />
        <span class="frame-hint">{{ formatTime(skillForm.duration) }}</span>
      </el-form-item>

      <el-form-item label="自定义备注" prop="note">
        <el-input
          v-model="skillForm.note"
          type="textarea"
          :rows="3"
          placeholder="请输入备注信息"
        />
      </el-form-item>

      <el-form-item label="技能倍率修正" prop="damageMultiplier">
        <el-slider
          v-model="skillForm.damageMultiplier"
          :min="0.1"
          :max="2"
          :step="0.1"
        />
        <span class="slider-value"
          >{{ skillForm.damageMultiplier.toFixed(1) }}x</span
        >
      </el-form-item>

      <el-form-item label="能量获取修正" prop="energyGain">
        <el-slider
          v-model="skillForm.energyGain"
          :min="0"
          :max="20"
          :step="1"
        />
        <span class="slider-value">{{ skillForm.energyGain }} 点</span>
      </el-form-item>

      <el-form-item label="技能等级" prop="level">
        <el-input-number
          v-model="skillForm.level"
          :min="1"
          :max="skillForm.maxLevel || 10"
          :step="1"
        />
      </el-form-item>

      <el-form-item label="充能次数" prop="chargeCount">
        <el-input-number
          v-model="skillForm.chargeCount"
          :min="1"
          :max="5"
          :step="1"
        />
      </el-form-item>

      <el-form-item label="伤害属性" prop="hitType">
        <el-select v-model="skillForm.hitType" placeholder="选择伤害属性">
          <el-option label="物理" value="physical" />
          <el-option label="元素" value="elemental" />
        </el-select>
      </el-form-item>
    </el-form>

    <div v-if="originalSkill" class="skill-params">
      <h4>技能原始参数</h4>
      <div class="params-grid">
        <div class="param-item">
          <span class="param-label">技能类型:</span>
          <span class="param-value">{{
            getSkillTypeName(originalSkill.type)
          }}</span>
        </div>
        <div class="param-item">
          <span class="param-label">元素类型:</span>
          <span class="param-value">{{
            getElementName(originalSkill.element)
          }}</span>
        </div>
        <div class="param-item">
          <span class="param-label">CD:</span>
          <span class="param-value">{{ originalSkill.cooldown }} 秒</span>
        </div>
        <div class="param-item">
          <span class="param-label">能量消耗:</span>
          <span class="param-value">{{ originalSkill.energyCost }} 点</span>
        </div>
        <div class="param-item">
          <span class="param-label">原始能量获取:</span>
          <span class="param-value">{{ originalSkill.energyGain }} 点</span>
        </div>
        <div class="param-item">
          <span class="param-label">原始伤害倍率:</span>
          <span class="param-value">{{
            Array.isArray(originalSkill.damageMultiplier)
              ? originalSkill.damageMultiplier.join(' / ')
              : originalSkill.damageMultiplier
          }}</span>
        </div>
        <div class="param-item">
          <span class="param-label">技能等级:</span>
          <span class="param-value">{{ originalSkill.level || 1 }} / {{ originalSkill.maxLevel || 10 }}</span>
        </div>
        <div class="param-item">
          <span class="param-label">充能次数:</span>
          <span class="param-value">{{ originalSkill.chargeCount || 1 }}</span>
        </div>
        <div class="param-item">
          <span class="param-label">伤害属性:</span>
          <span class="param-value">{{ originalSkill.hitType === 'physical' ? '物理' : '元素' }}</span>
        </div>
      </div>
    </div>
    <div v-else class="skill-params">
      <h4>技能原始参数</h4>
      <div class="params-grid">
        <div class="param-item">
          <span class="param-label">技能类型:</span>
          <span class="param-value">-</span>
        </div>
        <div class="param-item">
          <span class="param-label">元素类型:</span>
          <span class="param-value">-</span>
        </div>
        <div class="param-item">
          <span class="param-label">CD:</span>
          <span class="param-value">-</span>
        </div>
        <div class="param-item">
          <span class="param-label">能量消耗:</span>
          <span class="param-value">-</span>
        </div>
        <div class="param-item">
          <span class="param-label">原始能量获取:</span>
          <span class="param-value">-</span>
        </div>
        <div class="param-item">
          <span class="param-label">原始伤害倍率:</span>
          <span class="param-value">-</span>
        </div>
        <div class="param-item">
          <span class="param-label">技能等级:</span>
          <span class="param-value">-</span>
        </div>
        <div class="param-item">
          <span class="param-label">充能次数:</span>
          <span class="param-value">-</span>
        </div>
        <div class="param-item">
          <span class="param-label">伤害属性:</span>
          <span class="param-value">-</span>
        </div>
      </div>
    </div>

    <div v-if="originalSkill && character" class="damage-preview">
      <h4>伤害预览</h4>
      <div class="preview-item">
        <span class="preview-label">预计伤害:</span>
        <span class="preview-value">{{ calculatePreviewDamage() }}</span>
      </div>
    </div>
    <div v-else class="damage-preview">
      <h4>伤害预览</h4>
      <div class="preview-item">
        <span class="preview-label">预计伤害:</span>
        <span class="preview-value">0</span>
      </div>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveChanges">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  skillBlock: {
    type: Object,
    default: null,
  },
  originalSkill: {
    type: Object,
    default: null,
  },
  character: {
    type: Object,
    default: null,
  },
  maxDuration: {
    type: Number,
    default: 1200,
  },
  elements: {
    type: Array,
    default: () => [],
  },
});

// Emits
const emit = defineEmits(['update:visible', 'save']);

// 响应式数据
const dialogVisible = ref(false);
const skillFormRef = ref(null);
const skillForm = ref({
  skillName: '',
  characterName: '',
  startFrame: 0,
  endFrame: 0,
  duration: 0,
  note: '',
  damageMultiplier: 1,
  energyGain: 0,
  level: 1,
  maxLevel: 10,
  chargeCount: 1,
  hitType: 'physical',
});

const skillRules = ref({
  startFrame: [{ required: true, message: '请输入释放时间', trigger: 'blur' }],
  endFrame: [{ required: true, message: '请输入结束时间', trigger: 'blur' }],
});

// 监听 visible prop
watch(
  () => props.visible,
  newValue => {
    dialogVisible.value = newValue;
    if (newValue && props.skillBlock) {
      initForm();
    }
  }
);

// 监听 dialogVisible
watch(dialogVisible, newValue => {
  emit('update:visible', newValue);
});

// 监听 startFrame 和 endFrame，自动计算 duration
watch(
  [() => skillForm.value.startFrame, () => skillForm.value.endFrame],
  () => {
    skillForm.value.duration =
      skillForm.value.endFrame - skillForm.value.startFrame;
  }
);

// 方法
const initForm = () => {
  if (props.skillBlock) {
    skillForm.value = {
      skillName: props.skillBlock.skillName || '',
      characterName: props.character?.name || '',
      startFrame: props.skillBlock.startFrame || 0,
      endFrame: props.skillBlock.endFrame || 0,
      duration:
        (props.skillBlock.endFrame || 0) - (props.skillBlock.startFrame || 0),
      note: props.skillBlock.note || '',
      damageMultiplier: props.skillBlock.damageMultiplier || 1,
      energyGain:
        props.skillBlock.energyGain || props.originalSkill?.energyGain || 0,
      level: props.originalSkill?.level || 1,
      maxLevel: props.originalSkill?.maxLevel || 10,
      chargeCount: props.originalSkill?.chargeCount || 1,
      hitType: props.originalSkill?.hitType || 'physical',
    };
  }
};

const saveChanges = () => {
  skillFormRef.value.validate(valid => {
    if (valid) {
      emit('save', {
        ...props.skillBlock,
        startFrame: skillForm.value.startFrame,
        endFrame: skillForm.value.endFrame,
        note: skillForm.value.note,
        damageMultiplier: skillForm.value.damageMultiplier,
        energyGain: skillForm.value.energyGain,
        level: skillForm.value.level,
        chargeCount: skillForm.value.chargeCount,
        hitType: skillForm.value.hitType,
      });
      dialogVisible.value = false;
    }
  });
};

const getElementName = element => {
  const elementData = props.elements.find(e => e.id === `element_${element}`);
  return elementData ? elementData.name : element;
};

const getSkillTypeName = type => {
  const typeMap = {
    normal: '普攻',
    charge: '重击',
    skill: '星鸣技',
    ultimate: '星决技',
    combo: '星携技',
  };
  return typeMap[type] || type;
};

const formatTime = frames => {
  const seconds = Math.floor(frames / 60);
  const remainingFrames = frames % 60;
  return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
};

const calculatePreviewDamage = () => {
  if (!props.character || !props.originalSkill) return '0';

  // 简单的伤害计算预览
  const baseAttack = props.character.stats.attack || 1000;
  const multiplier = Array.isArray(props.originalSkill.damageMultiplier)
    ? props.originalSkill.damageMultiplier.reduce((sum, val) => sum + val, 0) /
      props.originalSkill.damageMultiplier.length
    : props.originalSkill.damageMultiplier || 1;
  const finalMultiplier = multiplier * skillForm.value.damageMultiplier;
  const damage = Math.round(baseAttack * finalMultiplier);

  return damage.toString();
};

// 组件挂载时初始化
onMounted(() => {
  if (props.visible && props.skillBlock) {
    initForm();
  }
});
</script>

<style scoped>
.frame-hint {
  margin-left: 10px;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.slider-value {
  margin-left: 10px;
  font-size: 12px;
  color: var(--text-color-secondary);
  min-width: 40px;
  display: inline-block;
}

.skill-params {
  margin: 20px 0;
  padding: 16px;
  background-color: var(--bg-color-lighter);
  border-radius: 6px;
}

.skill-params h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.param-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.param-label {
  color: var(--text-color-secondary);
}

.param-value {
  color: var(--text-color);
  font-weight: 500;
}

.damage-preview {
  margin: 20px 0;
  padding: 16px;
  background-color: var(--primary-color-light);
  border-radius: 6px;
  border-left: 4px solid var(--primary-color);
}

.damage-preview h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.preview-label {
  color: var(--text-color-secondary);
}

.preview-value {
  color: var(--primary-color);
  font-weight: 600;
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .params-grid {
    grid-template-columns: 1fr;
  }

  .frame-hint,
  .slider-value {
    font-size: 11px;
  }
}
</style>
