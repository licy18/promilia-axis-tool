<template>
  <div class="data-editor">
    <div class="data-editor-header">
      <h1>{{ $t('dataEditor.title') }}</h1>
      <div class="header-actions">
        <el-button type="primary" @click="saveChanges">{{
          $t('dataEditor.saveChanges')
        }}</el-button>
        <el-button @click="discardChanges">{{
          $t('dataEditor.discardChanges')
        }}</el-button>
        <el-button @click="importFromFile">{{
          $t('dataEditor.importFromFile')
        }}</el-button>
        <el-button type="success" @click="exportToFile">{{
          $t('dataEditor.exportToFile')
        }}</el-button>
        <el-button @click="validateData">{{
          $t('dataEditor.validateData')
        }}</el-button>
      </div>
    </div>

    <div class="data-editor-version">
      <el-form :inline="true" class="version-form">
        <el-form-item label="数据版本">
          <el-input v-model="gameData.version" placeholder="版本号" />
        </el-form-item>
        <el-form-item label="游戏版本">
          <el-input v-model="gameData.gameVersion" placeholder="游戏版本" />
        </el-form-item>
        <el-form-item label="更新时间">
          <el-date-picker
            v-model="updateTime"
            type="date"
            placeholder="选择日期"
          />
        </el-form-item>
      </el-form>
    </div>

    <div class="data-editor-tabs">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="角色管理" name="characters">
          <div class="data-edit-area">
            <div class="edit-header">
              <h3>角色列表</h3>
              <el-button type="primary" @click="addCharacter"
                >添加角色</el-button
              >
            </div>
            <el-table :data="gameData.characters" style="width: 100%">
              <el-table-column prop="id" label="ID" width="180" />
              <el-table-column prop="name" label="名称" width="120" />
              <el-table-column prop="element" label="元素" width="100" />
              <el-table-column prop="weapon" label="武器" width="100" />
              <el-table-column prop="rarity" label="稀有度" width="80" />
              <el-table-column prop="position" label="定位" width="100" />
              <el-table-column label="操作" width="200">
                <template #default="{ row }">
                  <el-button size="small" @click="editCharacter(row)"
                    >编辑</el-button
                  >
                  <el-button
                    size="small"
                    type="danger"
                    @click="deleteCharacter(row.id)"
                    >删除</el-button
                  >
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="技能管理" name="skills">
          <div class="data-edit-area">
            <div class="edit-header">
              <h3>技能列表</h3>
              <el-select v-model="selectedCharacterId" placeholder="选择角色">
                <el-option
                  v-for="char in gameData.characters"
                  :key="char.id"
                  :label="char.name"
                  :value="char.id"
                />
              </el-select>
            </div>
            <el-table
              v-if="selectedCharacterId"
              :data="getCharacterSkills(selectedCharacterId)"
              style="width: 100%"
            >
              <el-table-column prop="id" label="ID" width="180" />
              <el-table-column prop="name" label="名称" width="150" />
              <el-table-column prop="type" label="类型" width="100" />
              <el-table-column prop="element" label="元素" width="100" />
              <el-table-column prop="cooldown" label="CD" width="80" />
              <el-table-column prop="energyCost" label="能量消耗" width="100" />
              <el-table-column label="操作" width="200">
                <template #default="{ row }">
                  <el-button
                    size="small"
                    @click="editSkill(selectedCharacterId, row)"
                    >编辑</el-button
                  >
                  <el-button
                    size="small"
                    type="danger"
                    @click="deleteSkill(selectedCharacterId, row.id)"
                    >删除</el-button
                  >
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="请选择一个角色" />
          </div>
        </el-tab-pane>
        <el-tab-pane label="奇波管理" name="chippo">
          <div class="data-edit-area">
            <div class="edit-header">
              <h3>奇波列表</h3>
              <el-button type="primary" @click="addChippo">添加奇波</el-button>
            </div>
            <el-table :data="gameData.chippo" style="width: 100%">
              <el-table-column prop="id" label="ID" width="150" />
              <el-table-column prop="name" label="名称" width="120" />
              <el-table-column prop="rarity" label="稀有度" width="80" />
              <el-table-column prop="type" label="类型" width="100" />
              <el-table-column label="操作" width="200">
                <template #default="{ row }">
                  <el-button size="small" @click="editChippo(row)"
                    >编辑</el-button
                  >
                  <el-button
                    size="small"
                    type="danger"
                    @click="deleteChippo(row.id)"
                    >删除</el-button
                  >
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="敌人管理" name="enemies">
          <div class="data-edit-area">
            <div class="edit-header">
              <h3>敌人列表</h3>
              <el-button type="primary" @click="addEnemy">添加敌人</el-button>
            </div>
            <el-table :data="gameData.enemies" style="width: 100%">
              <el-table-column prop="id" label="ID" width="180" />
              <el-table-column prop="name" label="名称" width="150" />
              <el-table-column prop="type" label="类型" width="100" />
              <el-table-column prop="level" label="等级" width="80" />
              <el-table-column label="操作" width="200">
                <template #default="{ row }">
                  <el-button size="small" @click="editEnemy(row)"
                    >编辑</el-button
                  >
                  <el-button
                    size="small"
                    type="danger"
                    @click="deleteEnemy(row.id)"
                    >删除</el-button
                  >
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="Buff管理" name="buffs">
          <div class="data-edit-area">
            <div class="edit-header">
              <h3>Buff列表</h3>
              <el-button type="primary" @click="addBuff">添加Buff</el-button>
            </div>
            <el-table :data="gameData.buffs" style="width: 100%">
              <el-table-column prop="id" label="ID" width="150" />
              <el-table-column prop="name" label="名称" width="150" />
              <el-table-column prop="type" label="类型" width="120" />
              <el-table-column prop="value" label="数值" width="100" />
              <el-table-column prop="duration" label="持续时间" width="100" />
              <el-table-column label="操作" width="200">
                <template #default="{ row }">
                  <el-button size="small" @click="editBuff(row)"
                    >编辑</el-button
                  >
                  <el-button
                    size="small"
                    type="danger"
                    @click="deleteBuff(row.id)"
                    >删除</el-button
                  >
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 角色编辑对话框 -->
    <el-dialog v-model="characterDialogVisible" title="编辑角色" width="800px">
      <el-form :model="currentCharacter" label-width="100px">
        <el-form-item label="ID">
          <el-input v-model="currentCharacter.id" placeholder="角色ID" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="currentCharacter.name" placeholder="角色名称" />
        </el-form-item>
        <el-form-item label="元素">
          <el-select v-model="currentCharacter.element" placeholder="选择元素">
            <el-option
              v-for="elem in gameData.elements"
              :key="elem.id"
              :label="elem.name"
              :value="elem.id.replace('element_', '')"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="武器">
          <el-input v-model="currentCharacter.weapon" placeholder="武器类型" />
        </el-form-item>
        <el-form-item label="稀有度">
          <el-select v-model="currentCharacter.rarity" placeholder="选择稀有度">
            <el-option :label="1" :value="1" />
            <el-option :label="2" :value="2" />
            <el-option :label="3" :value="3" />
            <el-option :label="4" :value="4" />
            <el-option :label="5" :value="5" />
          </el-select>
        </el-form-item>
        <el-form-item label="定位">
          <el-input
            v-model="currentCharacter.position"
            placeholder="角色定位"
          />
        </el-form-item>
        <el-form-item label="攻击力">
          <el-input-number v-model="currentCharacter.stats.attack" :min="0" />
        </el-form-item>
        <el-form-item label="防御力">
          <el-input-number v-model="currentCharacter.stats.defense" :min="0" />
        </el-form-item>
        <el-form-item label="生命值">
          <el-input-number v-model="currentCharacter.stats.hp" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="characterDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveCharacter">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 技能编辑对话框 -->
    <el-dialog v-model="skillDialogVisible" title="编辑技能" width="800px">
      <el-form :model="currentSkill" label-width="100px">
        <el-form-item label="ID">
          <el-input v-model="currentSkill.id" placeholder="技能ID" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="currentSkill.name" placeholder="技能名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="currentSkill.type" placeholder="选择类型">
            <el-option label="普通攻击" value="normal" />
            <el-option label="重击" value="charge" />
            <el-option label="星鸣技" value="skill" />
            <el-option label="星决技" value="ultimate" />
            <el-option label="星携技" value="combo" />
          </el-select>
        </el-form-item>
        <el-form-item label="元素">
          <el-select v-model="currentSkill.element" placeholder="选择元素">
            <el-option
              v-for="elem in gameData.elements"
              :key="elem.id"
              :label="elem.name"
              :value="elem.id.replace('element_', '')"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="伤害倍率">
          <el-input
            v-model="currentSkill.damageMultiplier"
            placeholder="伤害倍率"
          />
        </el-form-item>
        <el-form-item label="冷却时间">
          <el-input-number v-model="currentSkill.cooldown" :min="0" />
        </el-form-item>
        <el-form-item label="能量消耗">
          <el-input-number v-model="currentSkill.energyCost" :min="0" />
        </el-form-item>
        <el-form-item label="动画时间">
          <el-input-number
            v-model="currentSkill.animationTime"
            :min="0"
            :step="0.1"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="skillDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveSkill">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 奇波编辑对话框 -->
    <el-dialog v-model="chippoDialogVisible" title="编辑奇波" width="600px">
      <el-form :model="currentChippo" label-width="100px">
        <el-form-item label="ID">
          <el-input v-model="currentChippo.id" placeholder="奇波ID" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="currentChippo.name" placeholder="奇波名称" />
        </el-form-item>
        <el-form-item label="稀有度">
          <el-select v-model="currentChippo.rarity" placeholder="选择稀有度">
            <el-option :label="1" :value="1" />
            <el-option :label="2" :value="2" />
            <el-option :label="3" :value="3" />
            <el-option :label="4" :value="4" />
            <el-option :label="5" :value="5" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="currentChippo.type" placeholder="奇波类型" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="chippoDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveChippo">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 敌人编辑对话框 -->
    <el-dialog v-model="enemyDialogVisible" title="编辑敌人" width="800px">
      <el-form :model="currentEnemy" label-width="100px">
        <el-form-item label="ID">
          <el-input v-model="currentEnemy.id" placeholder="敌人ID" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="currentEnemy.name" placeholder="敌人名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="currentEnemy.type" placeholder="敌人类型" />
        </el-form-item>
        <el-form-item label="等级">
          <el-input-number v-model="currentEnemy.level" :min="1" />
        </el-form-item>
        <el-form-item label="生命值">
          <el-input-number v-model="currentEnemy.stats.hp" :min="0" />
        </el-form-item>
        <el-form-item label="攻击力">
          <el-input-number v-model="currentEnemy.stats.attack" :min="0" />
        </el-form-item>
        <el-form-item label="防御力">
          <el-input-number v-model="currentEnemy.stats.defense" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="enemyDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveEnemy">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Buff编辑对话框 -->
    <el-dialog v-model="buffDialogVisible" title="编辑Buff" width="600px">
      <el-form :model="currentBuff" label-width="100px">
        <el-form-item label="ID">
          <el-input v-model="currentBuff.id" placeholder="Buff ID" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="currentBuff.name" placeholder="Buff名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-input v-model="currentBuff.type" placeholder="Buff类型" />
        </el-form-item>
        <el-form-item label="数值">
          <el-input-number v-model="currentBuff.value" :min="0" :step="0.01" />
        </el-form-item>
        <el-form-item label="持续时间">
          <el-input-number v-model="currentBuff.duration" :min="0" />
        </el-form-item>
        <el-form-item label="最大叠加">
          <el-input-number v-model="currentBuff.stacks" :min="1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="buffDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveBuff">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

// 状态管理
const activeTab = ref('characters');
const selectedCharacterId = ref('');
const gameData = reactive({});
const updateTime = ref(new Date());

// 对话框状态
const characterDialogVisible = ref(false);
const skillDialogVisible = ref(false);
const chippoDialogVisible = ref(false);
const enemyDialogVisible = ref(false);
const buffDialogVisible = ref(false);

// 当前编辑对象
const currentCharacter = reactive({});
const currentSkill = reactive({});
const currentChippo = reactive({});
const currentEnemy = reactive({});
const currentBuff = reactive({});

// 加载游戏数据
const loadGameData = async () => {
  try {
    const response = await fetch('/gamedata/gamedata.json');
    const data = await response.json();
    Object.assign(gameData, data);
    updateTime.value = new Date(gameData.updateTime);
  } catch (error) {
    console.error('加载游戏数据失败:', error);
    // 初始化默认数据结构
    Object.assign(gameData, {
      version: '1.0.0',
      gameVersion: '最新适配游戏版本',
      updateTime: new Date().toISOString().split('T')[0],
      characters: [],
      chippo: [],
      enemies: [],
      buffs: [],
      elements: [
        { id: 'element_fire', name: '火', color: '#ff4500' },
        { id: 'element_water', name: '水', color: '#1e90ff' },
        { id: 'element_wind', name: '风', color: '#00ff80' },
        { id: 'element_earth', name: '地', color: '#8b4513' },
        { id: 'element_lightning', name: '雷', color: '#9400d3' },
        { id: 'element_physical', name: '物理', color: '#c0c0c0' },
      ],
    });
  }
};

// 保存更改
const saveChanges = async () => {
  gameData.updateTime = updateTime.value.toISOString().split('T')[0];
  try {
    // 这里可以添加保存到服务器的逻辑
    console.log('保存数据:', gameData);
    ElMessage.success('保存成功');
  } catch (error) {
    console.error('保存失败:', error);
    ElMessage.error('保存失败');
  }
};

// 放弃更改
const discardChanges = () => {
  loadGameData();
  ElMessage.info('已放弃更改');
};

// 导入文件
const importFromFile = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const data = JSON.parse(event.target.result);
          Object.assign(gameData, data);
          updateTime.value = new Date(gameData.updateTime);
          ElMessage.success('导入成功');
        } catch (error) {
          ElMessage.error('导入失败：文件格式错误');
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
};

// 导出文件
const exportToFile = () => {
  gameData.updateTime = updateTime.value.toISOString().split('T')[0];
  const dataStr = JSON.stringify(gameData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gamedata.json';
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success('导出成功');
};

// 验证数据
const validateData = () => {
  // 简单的数据验证逻辑
  let errors = [];

  // 验证角色数据
  if (!gameData.characters || gameData.characters.length === 0) {
    errors.push('角色数据为空');
  }

  // 验证敌人数据
  if (!gameData.enemies || gameData.enemies.length === 0) {
    errors.push('敌人数据为空');
  }

  if (errors.length > 0) {
    ElMessage.error(`数据验证失败：${errors.join(', ')}`);
  } else {
    ElMessage.success('数据验证通过');
  }
};

// 角色相关操作
const addCharacter = () => {
  Object.assign(currentCharacter, {
    id: `character_${Date.now()}`,
    name: '新角色',
    element: 'physical',
    weapon: 'sword',
    rarity: 3,
    position: '未知',
    stats: {
      attack: 1000,
      defense: 500,
      hp: 10000,
      speed: 100,
      criticalRate: 0.05,
      criticalDamage: 0.5,
      elementalMastery: 100,
      elementalBonuses: {},
    },
    skills: [],
    passives: [],
    exclusiveResource: {
      name: '能量',
      max: 100,
      initial: 0,
    },
    avatar: '/avatars/default.webp',
    icon: '/icons/default_icon.webp',
  });
  characterDialogVisible.value = true;
};

const editCharacter = character => {
  Object.assign(currentCharacter, JSON.parse(JSON.stringify(character)));
  characterDialogVisible.value = true;
};

const saveCharacter = () => {
  const index = gameData.characters.findIndex(
    c => c.id === currentCharacter.id
  );
  if (index >= 0) {
    Object.assign(gameData.characters[index], currentCharacter);
  } else {
    gameData.characters.push(JSON.parse(JSON.stringify(currentCharacter)));
  }
  characterDialogVisible.value = false;
  ElMessage.success('角色保存成功');
};

const deleteCharacter = id => {
  ElMessageBox.confirm('确定要删除这个角色吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      const index = gameData.characters.findIndex(c => c.id === id);
      if (index >= 0) {
        gameData.characters.splice(index, 1);
        ElMessage.success('删除成功');
      }
    })
    .catch(() => {});
};

// 技能相关操作
const getCharacterSkills = characterId => {
  const character = gameData.characters.find(c => c.id === characterId);
  return character ? character.skills : [];
};

const editSkill = (characterId, skill) => {
  selectedCharacterId.value = characterId;
  Object.assign(currentSkill, JSON.parse(JSON.stringify(skill)));
  skillDialogVisible.value = true;
};

const saveSkill = () => {
  const character = gameData.characters.find(
    c => c.id === selectedCharacterId.value
  );
  if (character) {
    const index = character.skills.findIndex(s => s.id === currentSkill.id);
    if (index >= 0) {
      Object.assign(character.skills[index], currentSkill);
    } else {
      character.skills.push(JSON.parse(JSON.stringify(currentSkill)));
    }
    skillDialogVisible.value = false;
    ElMessage.success('技能保存成功');
  }
};

const deleteSkill = (characterId, skillId) => {
  ElMessageBox.confirm('确定要删除这个技能吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      const character = gameData.characters.find(c => c.id === characterId);
      if (character) {
        const index = character.skills.findIndex(s => s.id === skillId);
        if (index >= 0) {
          character.skills.splice(index, 1);
          ElMessage.success('删除成功');
        }
      }
    })
    .catch(() => {});
};

// 奇波相关操作
const addChippo = () => {
  Object.assign(currentChippo, {
    id: `chippo_${Date.now()}`,
    name: '新奇波',
    rarity: 3,
    type: 'attack',
    effects: [],
    icon: '/icons/default_icon.webp',
  });
  chippoDialogVisible.value = true;
};

const editChippo = chippo => {
  Object.assign(currentChippo, JSON.parse(JSON.stringify(chippo)));
  chippoDialogVisible.value = true;
};

const saveChippo = () => {
  const index = gameData.chippo.findIndex(c => c.id === currentChippo.id);
  if (index >= 0) {
    Object.assign(gameData.chippo[index], currentChippo);
  } else {
    gameData.chippo.push(JSON.parse(JSON.stringify(currentChippo)));
  }
  chippoDialogVisible.value = false;
  ElMessage.success('奇波保存成功');
};

const deleteChippo = id => {
  ElMessageBox.confirm('确定要删除这个奇波吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      const index = gameData.chippo.findIndex(c => c.id === id);
      if (index >= 0) {
        gameData.chippo.splice(index, 1);
        ElMessage.success('删除成功');
      }
    })
    .catch(() => {});
};

// 敌人相关操作
const addEnemy = () => {
  Object.assign(currentEnemy, {
    id: `enemy_${Date.now()}`,
    name: '新敌人',
    type: 'normal',
    level: 1,
    stats: {
      hp: 10000,
      attack: 1000,
      defense: 500,
      resistance: {},
      weaknesses: [],
      resistanceLevels: {},
      staminaThreshold: 1000,
      weakWindowDuration: 5,
    },
    abilities: [],
    icon: '/Icon_Enemy/default_enemy.webp',
  });
  enemyDialogVisible.value = true;
};

const editEnemy = enemy => {
  Object.assign(currentEnemy, JSON.parse(JSON.stringify(enemy)));
  enemyDialogVisible.value = true;
};

const saveEnemy = () => {
  const index = gameData.enemies.findIndex(e => e.id === currentEnemy.id);
  if (index >= 0) {
    Object.assign(gameData.enemies[index], currentEnemy);
  } else {
    gameData.enemies.push(JSON.parse(JSON.stringify(currentEnemy)));
  }
  enemyDialogVisible.value = false;
  ElMessage.success('敌人保存成功');
};

const deleteEnemy = id => {
  ElMessageBox.confirm('确定要删除这个敌人吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      const index = gameData.enemies.findIndex(e => e.id === id);
      if (index >= 0) {
        gameData.enemies.splice(index, 1);
        ElMessage.success('删除成功');
      }
    })
    .catch(() => {});
};

// Buff相关操作
const addBuff = () => {
  Object.assign(currentBuff, {
    id: `buff_${Date.now()}`,
    name: '新Buff',
    type: 'attack',
    value: 0.1,
    duration: 10,
    stacks: 1,
  });
  buffDialogVisible.value = true;
};

const editBuff = buff => {
  Object.assign(currentBuff, JSON.parse(JSON.stringify(buff)));
  buffDialogVisible.value = true;
};

const saveBuff = () => {
  const index = gameData.buffs.findIndex(b => b.id === currentBuff.id);
  if (index >= 0) {
    Object.assign(gameData.buffs[index], currentBuff);
  } else {
    gameData.buffs.push(JSON.parse(JSON.stringify(currentBuff)));
  }
  buffDialogVisible.value = false;
  ElMessage.success('Buff保存成功');
};

const deleteBuff = id => {
  ElMessageBox.confirm('确定要删除这个Buff吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      const index = gameData.buffs.findIndex(b => b.id === id);
      if (index >= 0) {
        gameData.buffs.splice(index, 1);
        ElMessage.success('删除成功');
      }
    })
    .catch(() => {});
};

// 初始化
onMounted(() => {
  loadGameData();
});
</script>

<style scoped>
.data-editor {
  min-height: 100vh;
  padding: 20px;
}

.data-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.data-editor-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color);
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.data-editor-version {
  margin-bottom: 20px;
  padding: 15px;
  background-color: var(--bg-color-light);
  border-radius: 8px;
}

.version-form {
  display: flex;
  align-items: center;
  gap: 15px;
}

.data-editor-tabs {
  background-color: var(--bg-color-light);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--box-shadow);
}

.data-edit-area {
  min-height: 400px;
  padding: 20px;
  background-color: var(--bg-color-lighter);
  border-radius: 4px;
  margin-top: 20px;
}

.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.edit-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 768px) {
  .data-editor-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .version-form {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .edit-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>
