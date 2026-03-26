<template>
  <div class="skill-edit-panel">
    <div class="collapsible-sections">
      <!-- 基本参数 -->
      <el-collapse v-model="activeCollapseItems">
        <el-collapse-item title="基本参数" name="basic">
          <el-form :model="skillForm" :rules="skillRules" ref="skillFormRef">
            <el-form-item label="技能名称" prop="skillName">
              <el-input v-model="skillForm.skillName" disabled />
            </el-form-item>

            <el-form-item label="角色" prop="characterName">
              <el-input v-model="skillForm.characterName" disabled />
            </el-form-item>

            <el-form-item label="释放时间" prop="startTime">
                <el-input-number
                  v-model="skillForm.startTime"
                  :min="0"
                  :max="maxDuration"
                  :step="1"
                />
                <span class="frame-hint">{{ formatTime(skillForm.startTime) }}</span>
              </el-form-item>

              <el-form-item label="持续时间" prop="duration">
                <el-input-number
                  v-model="skillForm.duration"
                  :min="10"
                  :max="maxDuration"
                  :step="1"
                />
                <span class="frame-hint">{{ formatTime(skillForm.duration) }}</span>
              </el-form-item>

              <el-form-item label="结束时间" prop="endTime">
                <el-input-number
                  v-model="skillForm.endTime"
                  :min="skillForm.startTime + 10"
                  :max="maxDuration"
                  :step="1"
                  disabled
                />
                <span class="frame-hint">{{ formatTime(skillForm.endTime) }}</span>
              </el-form-item>

            <el-form-item label="自定义备注" prop="note">
              <el-input
                v-model="skillForm.note"
                type="textarea"
                :rows="3"
                placeholder="请输入备注信息"
              />
            </el-form-item>

            <el-form-item label="技能颜色" prop="customColor">
              <el-color-picker v-model="skillForm.customColor" />
            </el-form-item>

            <el-form-item label="状态" prop="status">
              <el-checkbox v-model="skillForm.isLocked">锁定位置</el-checkbox>
              <el-checkbox v-model="skillForm.isDisabled">禁用</el-checkbox>
            </el-form-item>
          </el-form>
        </el-collapse-item>

        <!-- 技能效果 -->
        <el-collapse-item title="技能效果" name="effects">
          <el-form :model="skillForm">
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

            <el-form-item label="能量消耗" prop="energyCost">
              <el-input-number
                v-model="skillForm.energyCost"
                :min="0"
                :max="100"
                :step="1"
              />
              <span class="frame-hint">点</span>
            </el-form-item>

            <el-form-item label="冷却时间" prop="cooldown">
              <el-input-number
                v-model="skillForm.cooldown"
                :min="0"
                :max="300"
                :step="1"
              />
              <span class="frame-hint">秒</span>
            </el-form-item>

            <el-form-item label="技能效果预览" prop="effects">
              <div class="effects-preview">
                <div v-for="(effect, index) in skillEffects" :key="index" class="effect-item">
                  <div class="effect-icon">
                    <img :src="effect.icon" :alt="effect.name" />
                  </div>
                  <div class="effect-info">
                    <div class="effect-name">{{ effect.name }}</div>
                    <div class="effect-description">{{ effect.description }}</div>
                  </div>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-collapse-item>

        <!-- 判定系统 -->
        <el-collapse-item title="判定系统" name="judgment">
          <div class="judgment-system">
            <h4>伤害判定点</h4>
            <div class="damage-ticks-list">
              <div
                v-for="(tick, index) in skillForm.damageTicks"
                :key="index"
                class="damage-tick-item"
              >
                <el-form-item label="时间点" :prop="`damageTicks.${index}.offset`">
                  <el-input-number
                    v-model="tick.offset"
                    :min="0"
                    :max="skillForm.duration"
                    :step="1"
                  />
                  <span class="frame-hint">{{ formatTime(tick.offset) }}</span>
                </el-form-item>
                <el-form-item label="伤害倍率" :prop="`damageTicks.${index}.multiplier`">
                  <el-input-number
                    v-model="tick.multiplier"
                    :min="0.1"
                    :max="10"
                    :step="0.1"
                  />
                  <span class="frame-hint">x</span>
                </el-form-item>
                <el-form-item label="元素类型" :prop="`damageTicks.${index}.element`">
                  <el-select v-model="tick.element" placeholder="选择元素">
                    <el-option label="物理" value="physical" />
                    <el-option label="火" value="blaze" />
                    <el-option label="冰" value="cold" />
                    <el-option label="电" value="emag" />
                    <el-option label="自然" value="nature" />
                  </el-select>
                </el-form-item>
                <el-button type="danger" size="small" @click="removeDamageTick(index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
            <el-button @click="addDamageTick">
              <el-icon><Plus /></el-icon>
              添加伤害判定点
            </el-button>

            <h4 style="margin-top: 20px;">触发窗口</h4>
            <el-form-item label="触发窗口时间">
              <el-input-number
                v-model="skillForm.triggerWindow"
                :min="0"
                :max="skillForm.duration"
                :step="1"
              />
              <span class="frame-hint">{{ formatTime(skillForm.triggerWindow) }}</span>
            </el-form-item>
          </div>
        </el-collapse-item>

        <!-- 状态效果 -->
        <el-collapse-item title="状态效果" name="status">
          <div class="status-effects">
            <h4>Buff效果</h4>
            <div class="buffs-list">
              <div
                v-for="(buff, index) in skillForm.buffs"
                :key="index"
                class="buff-item"
              >
                <el-form-item label="效果类型" :prop="`buffs.${index}.type`">
                  <el-select v-model="buff.type" placeholder="选择效果类型">
                    <el-option label="攻击提升" value="attack_buff" />
                    <el-option label="防御提升" value="defense_buff" />
                    <el-option label="元素伤害提升" value="element_buff" />
                    <el-option label="减伤" value="damage_reduction" />
                  </el-select>
                </el-form-item>
                <el-form-item label="触发时间" :prop="`buffs.${index}.offset`">
                  <el-input-number
                    v-model="buff.offset"
                    :min="0"
                    :max="skillForm.duration"
                    :step="1"
                  />
                  <span class="frame-hint">{{ formatTime(buff.offset) }}</span>
                </el-form-item>
                <el-form-item label="持续时间" :prop="`buffs.${index}.duration`">
                  <el-input-number
                    v-model="buff.duration"
                    :min="1"
                    :max="300"
                    :step="1"
                  />
                  <span class="frame-hint">{{ formatTime(buff.duration) }}</span>
                </el-form-item>
                <el-form-item label="效果值" :prop="`buffs.${index}.value`">
                  <el-input-number
                    v-model="buff.value"
                    :min="0"
                    :max="100"
                    :step="1"
                  />
                  <span class="frame-hint">%</span>
                </el-form-item>
                <el-button type="danger" size="small" @click="removeBuff(index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
            <el-button @click="addBuff">
              <el-icon><Plus /></el-icon>
              添加Buff效果
            </el-button>

            <h4 style="margin-top: 20px;">Debuff效果</h4>
            <div class="debuffs-list">
              <div
                v-for="(debuff, index) in skillForm.debuffs"
                :key="index"
                class="debuff-item"
              >
                <el-form-item label="效果类型" :prop="`debuffs.${index}.type`">
                  <el-select v-model="debuff.type" placeholder="选择效果类型">
                    <el-option label="攻击降低" value="attack_debuff" />
                    <el-option label="防御降低" value="defense_debuff" />
                    <el-option label="元素抗性降低" value="element_resist_debuff" />
                    <el-option label="持续伤害" value="dot" />
                  </el-select>
                </el-form-item>
                <el-form-item label="触发时间" :prop="`debuffs.${index}.offset`">
                  <el-input-number
                    v-model="debuff.offset"
                    :min="0"
                    :max="skillForm.duration"
                    :step="1"
                  />
                  <span class="frame-hint">{{ formatTime(debuff.offset) }}</span>
                </el-form-item>
                <el-form-item label="持续时间" :prop="`debuffs.${index}.duration`">
                  <el-input-number
                    v-model="debuff.duration"
                    :min="1"
                    :max="300"
                    :step="1"
                  />
                  <span class="frame-hint">{{ formatTime(debuff.duration) }}</span>
                </el-form-item>
                <el-form-item label="效果值" :prop="`debuffs.${index}.value`">
                  <el-input-number
                    v-model="debuff.value"
                    :min="0"
                    :max="100"
                    :step="1"
                  />
                  <span class="frame-hint">%</span>
                </el-form-item>
                <el-button type="danger" size="small" @click="removeDebuff(index)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
            <el-button @click="addDebuff">
              <el-icon><Plus /></el-icon>
              添加Debuff效果
            </el-button>
          </div>
        </el-collapse-item>

        <!-- 时序系统 -->
        <el-collapse-item title="时序系统" name="timing">
          <div class="timing-system">
            <h4>技能序列</h4>
            <div class="sequence-items">
              <div
                v-for="(item, index) in skillSequence"
                :key="item.id"
                class="sequence-item"
              >
                <div class="sequence-item-content">
                  <div class="sequence-item-index">{{ index + 1 }}</div>
                  <div class="sequence-item-info">
                    <div class="sequence-item-name">{{ item.name }}</div>
                    <div class="sequence-item-time">{{ formatTime(item.startTime) }}</div>
                  </div>
                </div>
                <div class="sequence-item-actions">
                  <el-button
                    size="mini"
                    @click="moveSequenceItem(index, 'up')"
                    :disabled="index === 0"
                  >
                    <el-icon><ArrowUp /></el-icon>
                  </el-button>
                  <el-button
                    size="mini"
                    @click="moveSequenceItem(index, 'down')"
                    :disabled="index === skillSequence.length - 1"
                  >
                    <el-icon><ArrowDown /></el-icon>
                  </el-button>
                  <el-button
                    size="mini"
                    type="danger"
                    @click="removeSequenceItem(index)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
            <el-button @click="addSequenceItem">
              <el-icon><Plus /></el-icon>
              添加技能到序列
            </el-button>

            <h4 style="margin-top: 20px;">强化时间</h4>
            <el-form-item label="强化持续时间">
              <el-input-number
                v-model="skillForm.enhancementTime"
                :min="0"
                :max="300"
                :step="1"
              />
              <span class="frame-hint">{{ formatTime(skillForm.enhancementTime) }}</span>
            </el-form-item>
          </div>
        </el-collapse-item>

        <!-- 连续控制系统 -->
        <el-collapse-item title="连续控制" name="control">
          <div class="control-system">
            <h4>连续控制设置</h4>
            <el-form-item label="是否开启连续控制">
              <el-switch v-model="skillForm.isContinuous" />
            </el-form-item>
            <el-form-item label="连续控制间隔" v-if="skillForm.isContinuous">
              <el-input-number
                v-model="skillForm.continuousInterval"
                :min="10"
                :max="600"
                :step="10"
              />
              <span class="frame-hint">{{ formatTime(skillForm.continuousInterval) }}</span>
            </el-form-item>
            <el-form-item label="连续控制次数" v-if="skillForm.isContinuous">
              <el-input-number
                v-model="skillForm.continuousCount"
                :min="1"
                :max="10"
                :step="1"
              />
              <span class="frame-hint">次</span>
            </el-form-item>

            <h4 style="margin-top: 20px;">技能依赖</h4>
            <el-form-item label="前置技能">
              <el-select v-model="skillForm.previousSkillId" placeholder="选择前置技能">
                <el-option label="无" value="" />
                <!-- 这里可以根据实际情况动态生成前置技能选项 -->
              </el-select>
            </el-form-item>
            <el-form-item label="后置技能">
              <el-select v-model="skillForm.nextSkillId" placeholder="选择后置技能">
                <el-option label="无" value="" />
                <!-- 这里可以根据实际情况动态生成后置技能选项 -->
              </el-select>
            </el-form-item>
          </div>
        </el-collapse-item>

        <!-- 技能参数 -->
        <el-collapse-item title="原始参数" name="params">
          <div v-if="originalSkill" class="skill-params">
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
        </el-collapse-item>

        <!-- 伤害预览 -->
        <el-collapse-item title="伤害预览" name="preview">
          <div v-if="originalSkill && character" class="damage-preview">
            <div class="preview-item">
              <span class="preview-label">预计伤害:</span>
              <span class="preview-value">{{ calculatePreviewDamage() }}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">伤害类型:</span>
              <span class="preview-value">{{ skillForm.hitType === 'physical' ? '物理' : '元素' }}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">元素类型:</span>
              <span class="preview-value">{{ getElementName(originalSkill.element) }}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">能量获取:</span>
              <span class="preview-value">{{ skillForm.energyGain }} 点</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">能量消耗:</span>
              <span class="preview-value">{{ skillForm.energyCost }} 点</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">冷却时间:</span>
              <span class="preview-value">{{ skillForm.cooldown }} 秒</span>
            </div>
          </div>
          <div v-else class="damage-preview">
            <div class="preview-item">
              <span class="preview-label">预计伤害:</span>
              <span class="preview-value">0</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">伤害类型:</span>
              <span class="preview-value">-</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">元素类型:</span>
              <span class="preview-value">-</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">能量获取:</span>
              <span class="preview-value">-</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">能量消耗:</span>
              <span class="preview-value">-</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">冷却时间:</span>
              <span class="preview-value">-</span>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <div class="skill-edit-footer">
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="saveChanges">保存</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { ArrowUp, ArrowDown, Delete, Plus } from '@element-plus/icons-vue';

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
const emit = defineEmits(['save', 'close']);

// 响应式数据
const skillFormRef = ref(null);
const activeCollapseItems = ref(['basic']);
const skillForm = ref({
  skillName: '',
  characterName: '',
  startTime: 0,
  duration: 0,
  endTime: 0,
  note: '',
  damageMultiplier: 1,
  energyGain: 0,
  level: 1,
  maxLevel: 10,
  chargeCount: 1,
  hitType: 'physical',
  energyCost: 0,
  cooldown: 0,
  customColor: '',
  isLocked: false,
  isDisabled: false,
  damageTicks: [],
  buffs: [],
  debuffs: [],
  triggerWindow: 0,
  enhancementTime: 0,
  isContinuous: false,
  continuousInterval: 60,
  continuousCount: 1,
  previousSkillId: '',
  nextSkillId: '',
});

const skillRules = ref({
  startTime: [{ required: true, message: '请输入释放时间', trigger: 'blur' }],
  duration: [{ required: true, message: '请输入持续时间', trigger: 'blur' }],
});

// 技能序列数据
const skillSequence = ref([]);
// 技能效果数据
const skillEffects = ref([]);

// 方法
const initForm = () => {
  if (props.skillBlock) {
    skillForm.value = {
      skillName: props.skillBlock.name || props.skillBlock.skillName || '',
      characterName: props.character?.name || '',
      startTime: props.skillBlock.startTime || 0,
      duration: props.skillBlock.duration || 0,
      endTime: (props.skillBlock.startTime || 0) + (props.skillBlock.duration || 0),
      note: props.skillBlock.note || '',
      damageMultiplier: props.skillBlock.damageMultiplier || 1,
      energyGain:
        props.skillBlock.energyGain || props.skillBlock.spGain || props.originalSkill?.energyGain || 0,
      level: props.originalSkill?.level || 1,
      maxLevel: props.originalSkill?.maxLevel || 10,
      chargeCount: props.originalSkill?.chargeCount || 1,
      hitType: props.originalSkill?.hitType || 'physical',
      energyCost: props.skillBlock.energyCost || props.originalSkill?.energyCost || 0,
      cooldown: props.skillBlock.cooldown || props.originalSkill?.cooldown || 0,
      customColor: props.skillBlock.customColor || '',
      isLocked: props.skillBlock.isLocked || false,
      isDisabled: props.skillBlock.isDisabled || false,
      damageTicks: props.skillBlock.damageTicks || [],
      buffs: props.skillBlock.buffs || [],
      debuffs: props.skillBlock.debuffs || [],
      triggerWindow: props.skillBlock.triggerWindow || 0,
      enhancementTime: props.skillBlock.enhancementTime || 0,
      isContinuous: props.skillBlock.isContinuous || false,
      continuousInterval: props.skillBlock.continuousInterval || 60,
      continuousCount: props.skillBlock.continuousCount || 1,
      previousSkillId: props.skillBlock.previousSkillId || '',
      nextSkillId: props.skillBlock.nextSkillId || '',
    };
    
    // 初始化技能序列
    if (props.skillBlock.sequence) {
      skillSequence.value = [...props.skillBlock.sequence];
    } else {
      skillSequence.value = [];
    }
    
    // 初始化技能效果
    skillEffects.value = [];
  }
};

// 监听 skillBlock prop，当技能块变化时初始化表单
watch(
  () => props.skillBlock,
  newValue => {
    if (newValue) {
      initForm();
    }
  },
  { immediate: true }
);

// 监听 startTime 和 duration，自动计算 endTime
watch(
  [() => skillForm.value.startTime, () => skillForm.value.duration],
  () => {
    skillForm.value.endTime =
      skillForm.value.startTime + skillForm.value.duration;
  }
);

const saveChanges = () => {
  skillFormRef.value.validate(valid => {
    if (valid) {
      emit('save', {
        ...props.skillBlock,
        startTime: skillForm.value.startTime,
        duration: skillForm.value.duration,
        note: skillForm.value.note,
        damageMultiplier: skillForm.value.damageMultiplier,
        spGain: skillForm.value.energyGain,
        level: skillForm.value.level,
        chargeCount: skillForm.value.chargeCount,
        hitType: skillForm.value.hitType,
        energyCost: skillForm.value.energyCost,
        cooldown: skillForm.value.cooldown,
        customColor: skillForm.value.customColor,
        isLocked: skillForm.value.isLocked,
        isDisabled: skillForm.value.isDisabled,
        damageTicks: skillForm.value.damageTicks,
        buffs: skillForm.value.buffs,
        debuffs: skillForm.value.debuffs,
        triggerWindow: skillForm.value.triggerWindow,
        enhancementTime: skillForm.value.enhancementTime,
        isContinuous: skillForm.value.isContinuous,
        continuousInterval: skillForm.value.continuousInterval,
        continuousCount: skillForm.value.continuousCount,
        previousSkillId: skillForm.value.previousSkillId,
        nextSkillId: skillForm.value.nextSkillId,
        sequence: skillSequence.value,
      });
      emit('close');
    }
  });
};

const handleClose = () => {
  emit('close');
};

// 技能序列方法
const addSequenceItem = () => {
  const newItem = {
    id: Date.now().toString(),
    name: skillForm.value.skillName,
    startTime: skillForm.value.startTime,
    duration: skillForm.value.duration,
  };
  skillSequence.value.push(newItem);
};

const moveSequenceItem = (index, direction) => {
  if (direction === 'up' && index > 0) {
    [skillSequence.value[index], skillSequence.value[index - 1]] = [skillSequence.value[index - 1], skillSequence.value[index]];
  } else if (direction === 'down' && index < skillSequence.value.length - 1) {
    [skillSequence.value[index], skillSequence.value[index + 1]] = [skillSequence.value[index + 1], skillSequence.value[index]];
  }
};

const removeSequenceItem = (index) => {
  skillSequence.value.splice(index, 1);
};

// 伤害判定点方法
const addDamageTick = () => {
  skillForm.value.damageTicks.push({
    offset: 0,
    multiplier: 1,
    element: 'physical'
  });
};

const removeDamageTick = (index) => {
  skillForm.value.damageTicks.splice(index, 1);
};

// Buff方法
const addBuff = () => {
  skillForm.value.buffs.push({
    type: 'attack_buff',
    offset: 0,
    duration: 60,
    value: 10
  });
};

const removeBuff = (index) => {
  skillForm.value.buffs.splice(index, 1);
};

// Debuff方法
const addDebuff = () => {
  skillForm.value.debuffs.push({
    type: 'attack_debuff',
    offset: 0,
    duration: 60,
    value: 10
  });
};

const removeDebuff = (index) => {
  skillForm.value.debuffs.splice(index, 1);
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
.skill-edit-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

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

/* 技能序列样式 */
.sequence-editor {
  margin: 20px 0;
}

.sequence-editor h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.sequence-items {
  margin-bottom: 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.sequence-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-color-lighter);
}

.sequence-item:last-child {
  border-bottom: none;
}

.sequence-item-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sequence-item-index {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
}

.sequence-item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sequence-item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
}

.sequence-item-time {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.sequence-item-actions {
  display: flex;
  gap: 8px;
}

/* 伤害判定点样式 */
.damage-ticks-list {
  margin-bottom: 16px;
}

.damage-tick-item {
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 12px;
  background-color: var(--bg-color-lighter);
}

/* Buff和Debuff样式 */
.buffs-list,
.debuffs-list {
  margin-bottom: 16px;
}

.buff-item,
.debuff-item {
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 12px;
  background-color: var(--bg-color-lighter);
}

/* 技能编辑面板底部 */
.skill-edit-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
  margin-top: auto;
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

  .sequence-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .sequence-item-actions {
    align-self: flex-end;
  }

  .damage-tick-item,
  .buff-item,
  .debuff-item {
    padding: 8px;
  }
}
</style>
