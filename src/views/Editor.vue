<template>
  <div class="editor">
    <!-- 顶部导航栏 -->
    <div class="editor-header">
      <div class="header-left">
        <el-button @click="navigateTo('/')">
          <el-icon><ArrowLeft /></el-icon>
          返回首页
        </el-button>
        <h1>{{ project?.name || '排轴编辑器' }}</h1>
      </div>
      <div class="header-center">
        <el-button @click="undo" :disabled="!historyStore.canUndo">
          <el-icon><RefreshLeft /></el-icon>
          撤销
        </el-button>
        <el-button @click="redo" :disabled="!historyStore.canRedo">
          <el-icon><RefreshRight /></el-icon>
          重做
        </el-button>
        <el-button @click="toggleLoop">
          <el-icon><RefreshRight /></el-icon>
          {{ loopSettings.enabled ? '关闭循环' : '开启循环' }}
        </el-button>
        <el-button @click="openShortcutsDialog">
          <el-icon><Setting /></el-icon>
          快捷键
        </el-button>
      </div>
      <div class="header-right">
        <el-button @click="saveProject">
          <el-icon><Download /></el-icon>
          保存
        </el-button>
        <el-dropdown @command="handleExportCommand">
          <el-button>
            <el-icon><Download /></el-icon>
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="promilia"
                >.promilia 项目文件</el-dropdown-item
              >
              <el-dropdown-item command="json">JSON 源文件</el-dropdown-item>
              <el-dropdown-item command="image">高清图片</el-dropdown-item>
              <el-dropdown-item command="markdown"
                >Markdown 报告</el-dropdown-item
              >
              <el-dropdown-item command="share">生成分享链接</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button @click="toggleTheme">
          <el-icon><Moon /></el-icon>
          {{ isDark ? '浅色模式' : '深色模式' }}
        </el-button>
        <el-button @click="startGuideTour">
          <el-icon><Help /></el-icon>
          新手引导
        </el-button>
      </div>
    </div>

    <!-- 主编辑区域 -->
    <div class="editor-content">
      <!-- 左侧功能模块 -->
      <div class="left-panel">
        <div class="panel-header">
          <h3>角色管理</h3>
        </div>
        <div class="character-tabs">
          <el-tabs v-model="activeLeftTab" class="demo-tabs" @tab-click="handleTabClick">
            <el-tab-pane label="角色" name="character">
              <div class="character-section">
                <div class="character-selector">
                  <el-select v-model="selectedCharacterId" placeholder="选择角色" size="small" style="width: 100%">
                    <el-option
                      v-for="character in teamCharacters"
                      :key="character.id"
                      :label="character.name"
                      :value="character.id"
                    />
                  </el-select>
                </div>
                <div v-if="selectedCharacter" class="character-details">
                  <div class="character-avatar">
                    <img :src="selectedCharacter.avatar" :alt="selectedCharacter.name" />
                  </div>
                  <div class="character-info">
                    <h4>{{ selectedCharacter.name }}</h4>
                    <div class="character-stats">
                      <div class="stat-item">
                        <span class="stat-label">元素:</span>
                        <span class="stat-value">{{ selectedCharacter.element }}</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-label">生命:</span>
                        <span class="stat-value">{{ selectedCharacter.maxHealth }}</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-label">攻击力:</span>
                        <span class="stat-value">{{ selectedCharacter.attack }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="selectedCharacter" class="skills-section">
                  <h4>技能列表</h4>
                  <div class="skills-grid">
                    <div
                      v-for="skill in selectedCharacter.skills"
                      :key="skill.id"
                      class="skill-item"
                      draggable="true"
                      @dragstart="onSkillDragStart($event, skill, selectedCharacter.id)"
                      @click="selectSkill(skill)"
                    >
                      <div class="skill-icon">
                        <img :src="skill.icon" :alt="skill.name" />
                      </div>
                      <div class="skill-info">
                        <div class="skill-name">{{ skill.name }}</div>
                        <div class="skill-description">{{ skill.description }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane label="奇波" name="chip">
              <div class="chip-section">
                <div v-if="selectedCharacter" class="chip-list">
                  <!-- 当前已选择的奇波 -->
                  <div v-if="getCharacterChip(selectedCharacter.id)" class="selected-chip-info">
                    <h4>当前奇波</h4>
                    <div class="chip-item selected">
                      <div class="chip-icon">
                        <img :src="getCharacterChip(selectedCharacter.id).icon" :alt="getCharacterChip(selectedCharacter.id).name" />
                      </div>
                      <div class="chip-info">
                        <div class="chip-name">{{ getCharacterChip(selectedCharacter.id).name }}</div>
                        <div class="chip-effect">{{ getCharacterChip(selectedCharacter.id).effect }}</div>
                      </div>
                    </div>
                  </div>
                  <h4>奇波列表</h4>
                  <div class="chips-grid">
                    <div
                      v-for="chip in characterChips"
                      :key="chip.id"
                      class="chip-item"
                      :class="{ 'is-selected': getCharacterChip(selectedCharacter.id)?.id === chip.id }"
                      @click="selectChipForCharacter(chip)"
                    >
                      <div class="chip-icon">
                        <img :src="chip.icon" :alt="chip.name" />
                      </div>
                      <div class="chip-info">
                        <div class="chip-name">{{ chip.name }}</div>
                        <div class="chip-effect">{{ chip.effect }}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="no-character">
                  请先选择角色
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane label="装备" name="equipment">
              <EquipmentLibrary
                :characters="teamCharacters"
                :equipment-categories="gamedataStore.equipmentCategories"
                :selected-character="selectedCharacter"
                :project="project"
                @equipment-select="onEquipmentSelect"
              />
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <!-- 中间时间轴 -->
      <div class="main-panel">
        <!-- 播放控制条 -->
        <div class="timeline-controls">
          <div class="control-buttons">
            <el-button @click="goToStart">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-button @click="stepBackward">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-button @click="togglePlay">
              <el-icon>
                <component :is="isPlaying ? VideoPause : VideoCamera" />
              </el-icon>
              {{ isPlaying ? '暂停' : '播放' }}
            </el-button>
            <el-button @click="stepForward">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
            <el-button @click="goToEnd">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
            <el-select
              v-model="playbackSpeed"
              size="small"
              style="width: 80px; margin-left: 10px"
            >
              <el-option label="0.5x" value="0.5" />
              <el-option label="1x" value="1" />
              <el-option label="1.5x" value="1.5" />
              <el-option label="2x" value="2" />
            </el-select>
          </div>
          <div class="time-info">
            <span
              >{{ formatTime(currentFrame) }} /
              {{ formatTime(project?.duration || 1200) }}</span
            >
            <el-slider
              v-model="currentFrame"
              :min="0"
              :max="project?.duration || 1200"
              :step="1"
              style="width: 300px; margin: 0 20px"
            />
            <div class="time-unit-control">
              <span>{{ currentFrame }} 帧</span>
              <el-button
                size="small"
                @click="toggleTimeUnit"
                style="margin-left: 10px"
              >
                {{ timeUnit === 'frame' ? '切换到秒' : '切换到帧' }}
              </el-button>
            </div>
          </div>
        </div>

        <!-- 时间轴编辑区 -->
        <div class="timeline-container" ref="timelineContainer" @wheel="handleTimelineScroll">
          <!-- 时间轴网格布局 -->
          <div class="timeline-grid-layout">
            <!-- 左侧角色信息栏 -->
            <div class="tracks-sidebar">
              <div class="sidebar-header">
                <span class="header-text">角色</span>
              </div>
              <div class="sidebar-tracks">
                <div
                  v-for="(character, index) in teamCharacters"
                  :key="character.id"
                  class="sidebar-track"
                  :class="{ 'is-selected': selectedCharacterId === character.id }"
                  @click="selectTrack(character.id)"
                >
                  <div class="track-info" draggable="true" @dragstart="onTrackDragStart($event, index)" @dragover="onTrackDragOver($event, index)" @drop="onTrackDrop($event, index)" @dragend="onTrackDragEnd">
                    <div class="character-avatar" @click.stop="openCharacterSelector(index)">
                      <img :src="character.avatar" :alt="character.name" />
                    </div>
                    <span class="character-name">{{ character.name }}</span>
                    <div class="track-order-controls">
                      <el-button size="small" @click.stop="moveTrackUp(index)" :disabled="index === 0">
                        <el-icon><ArrowUp /></el-icon>
                      </el-button>
                      <el-button size="small" @click.stop="moveTrackDown(index)" :disabled="index === teamCharacters.length - 1">
                        <el-icon><ArrowDown /></el-icon>
                      </el-button>
                    </div>
                  </div>
                  <div class="track-controls">
                    <div class="equipment-slots">
                      <div class="slot chip-slot" @click.stop="openChipSelector(index)">
                        <template v-if="getCharacterChip(character.id)">
                          <img :src="getCharacterChip(character.id).icon" :alt="getCharacterChip(character.id).name" class="slot-image" />
                        </template>
                        <template v-else>
                          <span class="slot-label">奇波</span>
                        </template>
                      </div>
                      <div class="slot equipment-slot" @click.stop="openEquipmentSelector(index, 'armor')">
                        <template v-if="getCharacterEquipment(character.id, 'armor')">
                          <img :src="getCharacterEquipment(character.id, 'armor').icon" :alt="getCharacterEquipment(character.id, 'armor').name" class="slot-image" />
                        </template>
                        <template v-else>
                          <span class="slot-label">装备</span>
                        </template>
                      </div>
                    </div>
                    <el-button
                      size="small"
                      @click.stop="toggleTrackVisibility(character.id)"
                    >
                      {{ visibleTracks.includes(character.id) ? '隐藏' : '显示' }}
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右侧时间轴内容 -->
            <div class="timeline-content" @contextmenu="onTimelineContextMenu" @click="onTimelineClick">
              <!-- 时间刻度 -->
              <div
                class="timeline-header"
                :style="{ width: `${totalWidth}px` }"
                @click="addKeyframeAtPosition"
              >
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
                <!-- 关键时间点 -->
                <div class="keyframes">
                  <Keyframe
                    v-for="keyframe in project?.keyframes"
                    :key="keyframe.id"
                    :keyframe="keyframe"
                    :scale="scale"
                    @select="selectKeyframe"
                  />
                </div>
                
                <!-- 循环分界线 -->
                <div class="loop-dividers">
                  <div
                    v-for="divider in loopDividers"
                    :key="divider.id"
                    class="loop-divider"
                    :style="{
                      left: `${divider.frame * scale}px`,
                      borderLeftColor: divider.color
                    }"
                    :title="`${divider.label}: ${formatTime(divider.frame)}`"
                  >
                    <div class="loop-divider-label">{{ divider.label }}</div>
                  </div>
                </div>
              </div>

              <!-- 轨道区域 -->
              <div class="timeline-tracks" :style="{ width: `${totalWidth}px` }">
                <!-- 技能依赖连接线 -->
                <LinkLine
                  v-for="dependency in getSkillDependencies()"
                  :key="dependency.id"
                  :source-block="getSkillBlockById(dependency.sourceBlockId)"
                  :target-block="getSkillBlockById(dependency.targetBlockId)"
                  :source-track-index="
                    getTrackIndexByCharacterId(
                      getSkillBlockById(dependency.sourceBlockId)?.characterId
                    )
                  "
                  :target-track-index="
                    getTrackIndexByCharacterId(
                      getSkillBlockById(dependency.targetBlockId)?.characterId
                    )
                  "
                  :scale="scale"
                  :is-satisfied="
                    isSkillDependencySatisfied(
                      getSkillBlockById(dependency.sourceBlockId),
                      getSkillBlockById(dependency.targetBlockId)
                    )
                  "
                  @select="handleLinkLineClick"
                />

                <div
                  v-for="(character, index) in teamCharacters"
                  :key="character.id"
                  class="track"
                >
                  <!-- 子轨道容器 -->
                  <div
                    class="sub-tracks"
                    :class="{ hidden: !visibleTracks.includes(character.id) }"
                  >
                    <!-- 技能释放轨道 -->
                    <div
                      class="sub-track skill-track"
                      @dragover="onSkillDragOver"
                      @drop="onSkillDrop($event, character.id)"
                    >
                      <div class="sub-track-header">技能释放</div>
                      <div class="sub-track-content">
                        <!-- 技能块 -->
                        <SkillBlock
                          v-for="skillBlock in getCharacterSkillBlocks(
                            character.id
                          )"
                          :key="skillBlock.id"
                          :skill-block="skillBlock"
                          :scale="scale"
                          :is-selected="selectedSkillBlock?.id === skillBlock.id"
                          :element-color="getElementColor(character.element)"
                          @select="selectSkillBlock"
                          @edit="openSkillEditPanel"
                          @drag-start="onSkillBlockDragStart"
                          @drag-move="onSkillBlockDragMove"
                          @drag-end="onSkillBlockDragEnd"
                          @resize-start="onSkillBlockResizeStart"
                          @resize-move="onSkillBlockResizeMove"
                          @resize-end="onSkillBlockResizeEnd"
                          @context-menu="onSkillBlockContextMenu"
                        />
                      </div>
                    </div>

                    <!-- 奇波技能轨道 -->
                    <div class="sub-track chip-track">
                      <div class="sub-track-header">奇波技能</div>
                      <div class="sub-track-content">
                        <!-- 奇波技能块 -->
                        <SkillBlock
                          v-for="skillBlock in getCharacterChipSkillBlocks(
                            character.id
                          )"
                          :key="skillBlock.id"
                          :skill-block="skillBlock"
                          :scale="scale"
                          :is-selected="selectedSkillBlock?.id === skillBlock.id"
                          :element-color="getElementColor('physical')"
                          @select="selectSkillBlock"
                          @edit="openSkillEditPanel"
                          @drag-start="onSkillBlockDragStart"
                          @drag-move="onSkillBlockDragMove"
                          @drag-end="onSkillBlockDragEnd"
                          @resize-start="onSkillBlockResizeStart"
                          @resize-move="onSkillBlockResizeMove"
                          @resize-end="onSkillBlockResizeEnd"
                          @context-menu="onSkillBlockContextMenu"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 资源曲线 -->
        <ResourceCurve
          :project="project"
          :characters="teamCharacters"
          :scale="scale"
          @jump-to-frame="jumpToFrame"
        />

        <!-- 缩放控制 -->
        <div class="timeline-footer">
          <div class="zoom-controls">
            <el-button @click="zoomOut" icon="el-icon-zoom-out"></el-button>
            <el-slider
              v-model="scale"
              :min="0.5"
              :max="5"
              :step="0.1"
              style="width: 200px; margin: 0 10px"
            />
            <el-button @click="zoomIn" icon="el-icon-zoom-in"></el-button>
            <span style="margin-left: 10px"
              >{{ Math.round(scale * 100) }}%</span
            >
          </div>
          <div class="snap-control">
            <el-checkbox v-model="snapToGrid">吸附到网格</el-checkbox>
          </div>
        </div>

        <!-- 底部boss时间轴 -->
        <div class="boss-timeline">
          <BossTimeline
            :boss-events="project?.bossEvents || []"
            :scale="scale"
            :total-width="totalWidth"
            @event-select="selectBossEvent"
            @event-add="addBossEvent"
            @event-update="updateBossEvent"
            @event-delete="deleteBossEvent"
          />
        </div>

        <!-- 资源监控面板 -->
        <div class="resource-monitor">
          <ResourceMonitor
            :project="project"
            :characters="teamCharacters"
            :current-frame="currentFrame"
          />
        </div>
      </div>

      <!-- 右侧详细技能编辑面板 -->
      <div class="right-panel">
        <!-- 技能编辑面板（覆盖模式） -->
        <div v-if="skillEditPanelVisible" class="skill-edit-overlay">
          <div class="skill-edit-header">
            <h3>技能编辑</h3>
            <el-button type="text" @click="skillEditPanelVisible = false">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
          <div class="skill-edit-content">
            <SkillEditPanel
              :skill-block="selectedSkillBlock"
              :original-skill="getOriginalSkill(selectedSkillBlock?.skillId)"
              :character="getCharacter(selectedSkillBlock?.characterId)"
              :max-duration="project?.duration || 1200"
              :elements="gamedataStore.elements"
              @save="saveSkillBlockChanges"
              @close="() => { skillEditPanelVisible = false; calculateDamageStats(); }"
            />
          </div>
        </div>
        
        <!-- 普通右侧面板内容 -->
        <div v-else class="right-panel-content">
          <!-- 装备详情面板 -->
          <div v-if="selectedEquipment" class="panel-section">
            <h3>装备详情</h3>
            <div class="equipment-details">
              <div class="detail-item">
                <span class="detail-label">装备名称:</span>
                <span class="detail-value">{{ selectedEquipment.name }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">装备类型:</span>
                <span class="detail-value">{{ selectedEquipment.category }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">装备等级:</span>
                <span class="detail-value">{{ selectedEquipment.level }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">装备效果:</span>
                <span class="detail-value">{{ selectedEquipment.effect }}</span>
              </div>
            </div>
          </div>

          <!-- 项目信息 -->
          <div class="panel-section">
            <h3>项目信息</h3>
            <div class="project-info">
              <div class="info-item">
                <span class="info-label">项目名称:</span>
                <span class="info-value">{{ project?.name || '未命名' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">上场角色:</span>
                <span class="info-value">{{ teamCharacters.length }} 名</span>
              </div>
              <div class="info-item">
                <span class="info-label">目标敌人:</span>
                <span class="info-value">{{ enemy?.name || '未选择' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">总时长:</span>
                <span class="info-value">{{
                  formatTime(project?.duration || 1200)
                }}</span>
              </div>
            </div>
          </div>

          <!-- 伤害统计 -->
          <div class="panel-section">
            <h3>伤害统计</h3>
            <div class="damage-stats">
              <div class="stat-item">
                <span class="stat-label">总伤害:</span>
                <span class="stat-value">{{
                  damageStats.totalDamage.toLocaleString()
                }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">平均DPS:</span>
                <span class="stat-value">{{
                  damageStats.dps.toLocaleString()
                }}</span>
              </div>
            </div>
          </div>

          <!-- 角色伤害占比 -->
          <div class="panel-section">
            <h3>角色伤害占比</h3>
            <div class="chart-container" style="height: 200px">
              <div
                ref="characterChartRef"
                style="width: 100%; height: 100%"
              ></div>
            </div>
          </div>

          <!-- 技能类型占比 -->
          <div class="panel-section">
            <h3>技能类型占比</h3>
            <div class="chart-container" style="height: 200px">
              <div
                ref="skillTypeChartRef"
                style="width: 100%; height: 100%"
              ></div>
            </div>
          </div>

          <!-- 循环校验面板 -->
          <div class="panel-section validate-panel-container">
            <ValidatePanel
              :project="project"
              :gamedata="{ characters: gamedataStore.characters }"
              @jump-to-frame="jumpToFrame"
              @select-skill-block="selectSkillBlock"
            />
          </div>
        </div>
      </div>
    </div>



    <!-- 关键帧编辑对话框 -->
    <ElDialog
      v-model="keyframeEditPanelVisible"
      title="编辑关键帧"
      width="400px"
    >
      <ElForm :model="keyframeEditForm" label-width="80px">
        <ElFormItem label="名称">
          <ElInput v-model="keyframeEditForm.name" />
        </ElFormItem>
        <ElFormItem label="时间点">
          <ElInput v-model.number="keyframeEditForm.frame" type="number" />
        </ElFormItem>
        <ElFormItem label="颜色">
          <ElColorPicker v-model="keyframeEditForm.color" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElTextarea v-model="keyframeEditForm.description" rows="3" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="keyframeEditPanelVisible = false">取消</ElButton>
          <ElButton type="primary" @click="saveKeyframeChanges">保存</ElButton>
        </span>
      </template>
    </ElDialog>

    <!-- 循环播放设置对话框 -->
    <ElDialog v-model="loopSettings.enabled" title="循环播放设置" width="400px">
      <ElForm :model="loopSettings" label-width="100px">
        <ElFormItem label="循环区间">
          <div style="display: flex; gap: 10px">
            <ElInput
              v-model.number="loopSettings.startFrame"
              type="number"
              style="width: 120px"
            />
            <span>至</span>
            <ElInput
              v-model.number="loopSettings.endFrame"
              type="number"
              style="width: 120px"
            />
          </div>
        </ElFormItem>
        <ElFormItem label="循环次数">
          <ElInput v-model.number="loopSettings.loopCount" type="number" />
          <div style="font-size: 12px; color: #999; margin-top: 5px">
            -1 表示无限循环
          </div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="loopSettings.enabled = false">关闭</ElButton>
          <ElButton type="primary" @click="applyLoopSettings">应用</ElButton>
        </span>
      </template>
    </ElDialog>

    <!-- 快捷键设置对话框 -->
    <ElDialog v-model="shortcutsDialogVisible" title="快捷键设置" width="500px">
      <ElForm :model="shortcutSettings" label-width="120px">
        <ElFormItem label="撤销">
          <ElInput v-model="shortcutSettings.undo" />
        </ElFormItem>
        <ElFormItem label="重做">
          <ElInput v-model="shortcutSettings.redo" />
        </ElFormItem>
        <ElFormItem label="播放/暂停">
          <ElInput v-model="shortcutSettings.playPause" />
        </ElFormItem>
        <ElFormItem label="保存">
          <ElInput v-model="shortcutSettings.save" />
        </ElFormItem>
        <ElFormItem label="复制">
          <ElInput v-model="shortcutSettings.copy" />
        </ElFormItem>
        <ElFormItem label="粘贴">
          <ElInput v-model="shortcutSettings.paste" />
        </ElFormItem>
        <ElFormItem label="删除">
          <ElInput v-model="shortcutSettings.delete" />
        </ElFormItem>
        <ElFormItem label="全选">
          <ElInput v-model="shortcutSettings.selectAll" />
        </ElFormItem>
        <ElFormItem label="放大">
          <ElInput v-model="shortcutSettings.zoomIn" />
        </ElFormItem>
        <ElFormItem label="缩小">
          <ElInput v-model="shortcutSettings.zoomOut" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="shortcutsDialogVisible = false">取消</ElButton>
          <ElButton type="primary" @click="saveShortcutSettings">保存</ElButton>
        </span>
      </template>
    </ElDialog>

    <!-- 新手引导 -->
    <GuideTour ref="guideTour" />

    <!-- 角色选择对话框 -->
    <ElDialog v-model="isCharacterSelectorVisible" title="选择角色" width="600px" align-center>
      <div class="character-selector-dialog">
        <div class="search-box">
          <el-input v-model="characterSearchQuery" placeholder="搜索角色" prefix-icon="el-icon-search" />
        </div>
        <div class="character-list">
          <div
            v-for="character in filteredCharacters"
            :key="character.id"
            class="character-item"
            @click="confirmCharacterSelection(character.id)"
          >
            <div class="character-avatar">
              <img :src="character.avatar" :alt="character.name" />
            </div>
            <div class="character-info">
              <div class="character-name">{{ character.name }}</div>
              <div class="character-element">{{ character.element }}</div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="isCharacterSelectorVisible = false">取消</ElButton>
        </span>
      </template>
    </ElDialog>

    <!-- 奇波选择对话框 -->
    <ElDialog v-model="isChipSelectorVisible" title="选择奇波" width="600px" align-center>
      <div class="chip-selector-dialog">
        <div class="chip-list">
          <div
            v-for="chip in characterChips"
            :key="chip.id"
            class="chip-item"
            @click="confirmChipSelection(chip.id)"
          >
            <div class="chip-icon">
              <img :src="chip.icon" :alt="chip.name" />
            </div>
            <div class="chip-info">
              <div class="chip-name">{{ chip.name }}</div>
              <div class="chip-effect">{{ chip.effect }}</div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="isChipSelectorVisible = false">取消</ElButton>
        </span>
      </template>
    </ElDialog>

    <!-- 装备选择对话框 -->
    <ElDialog v-model="isEquipmentSelectorVisible" title="选择装备" width="600px" align-center>
      <div class="equipment-selector-dialog">
        <div class="equipment-list">
          <div
            v-for="equipment in filteredEquipment"
            :key="equipment.id"
            class="equipment-item"
            @click="confirmEquipmentSelection(equipment.id)"
          >
            <div class="equipment-icon">
              <img :src="equipment.icon" :alt="equipment.name" />
            </div>
            <div class="equipment-info">
              <div class="equipment-name">{{ equipment.name }}</div>
              <div class="equipment-category">{{ equipment.category }}</div>
              <div class="equipment-effect">{{ equipment.effect }}</div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <ElButton @click="isEquipmentSelectorVisible = false">取消</ElButton>
        </span>
      </template>
    </ElDialog>

    <!-- 右键菜单 -->
    <ContextMenu
      :visible="contextMenuVisible"
      :position="contextMenuPosition"
      :menu-items="contextMenuItems"
      @select="handleContextMenuSelect"
      @close="contextMenuVisible = false"
    />

    <!-- 角色切换菜单 -->
    <div 
      v-if="showCharacterSwitchMenu" 
      class="character-switch-menu"
      :style="{
        left: `${characterSwitchMenuPosition.x}px`,
        top: `${characterSwitchMenuPosition.y}px`
      }"
      @click.stop
    >
      <div class="menu-header">选择角色</div>
      <div 
        v-for="character in gamedataStore.characters" 
        :key="character.id"
        class="character-switch-item"
        @click="handleCharacterSwitch(character.id)"
      >
        <div class="character-avatar small">
          <img :src="character.avatar" :alt="character.name" />
        </div>
        <span class="character-name">{{ character.name }}</span>
      </div>
    </div>

    <!-- 颜色选择菜单 -->
    <div 
      v-if="showColorSelectMenu" 
      class="color-select-menu"
      :style="{
        left: `${colorSelectMenuPosition.x}px`,
        top: `${colorSelectMenuPosition.y}px`
      }"
      @click.stop
    >
      <div class="menu-header">选择颜色</div>
      <div class="color-grid">
        <div 
          v-for="color in availableColors" 
          :key="color"
          class="color-item"
          :style="{ backgroundColor: color }"
          :title="color"
          @click="handleColorSelect(color)"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useThrottleFn } from '@vueuse/core';
import { useRouter, useRoute } from 'vue-router';
import { useProjectStore } from '../store/project';
import { useGamedataStore } from '../store/gamedata';
import { useSettingStore } from '../store/setting';
import { useHistoryStore } from '../store/history';
import {
  ElMessage,
  ElIcon,
  ElLoading,
  ElDialog,
  ElInput,
  ElColorPicker,
  ElSelect,
  ElOption,
  ElButton,
  ElCheckbox,
  ElForm,
  ElFormItem,
  ElSlider,
} from 'element-plus';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Moon,
  VideoCamera,
  VideoPause,
  ArrowDown,
  RefreshLeft,
  RefreshRight,
  Plus,
  Minus,
  CopyDocument,
  Link,
  Setting,
  Help,
  Close,
} from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import SkillLibrary from '../components/editor/SkillLibrary.vue';
import EquipmentLibrary from '../components/editor/EquipmentLibrary.vue';
import ContextMenu from '../components/editor/ContextMenu.vue';
import SkillBlock from '../components/timeline/SkillBlock.vue';
import BuffBlock from '../components/timeline/BuffBlock.vue';
import ResourceBlock from '../components/timeline/ResourceBlock.vue';
import Keyframe from '../components/timeline/Keyframe.vue';
import LinkLine from '../components/timeline/LinkLine.vue';
import ResourceCurve from '../components/timeline/ResourceCurve.vue';
import ResourceMonitor from '../components/timeline/ResourceMonitor.vue';
import BossTimeline from '../components/timeline/BossTimeline.vue';
import SkillEditPanel from '../components/editor/SkillEditPanel.vue';
import ValidatePanel from '../components/editor/ValidatePanel.vue';
import GuideTour from '../components/editor/GuideTour.vue';
import {
  calculateTimelineDamage,
  calculateSkillDamage,
} from '../utils/damageCalc';

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();
const gamedataStore = useGamedataStore();
const settingStore = useSettingStore();
const historyStore = useHistoryStore();

// 响应式数据
const project = ref(null);
const currentFrame = ref(0);
const isPlaying = ref(false);
const playbackSpeed = ref('1');
const scale = ref(2);
const snapToGrid = ref(true);
const expandedCharacters = ref([]);
const visibleTracks = ref([]);
const selectedSkillBlock = ref(null);
const selectedSkillBlocks = ref([]);
const selectedBuffBlock = ref(null);
const selectedResourceBlock = ref(null);
const selectedKeyframe = ref(null);
const selectedEquipment = ref(null);
const selectedBossEvent = ref(null);
const selectedCharacterId = ref('');
const selectedSkill = ref(null);
const selectedChip = ref(null);
const activeLeftTab = ref('character');
const skillEditPanelVisible = ref(false);
const keyframeEditPanelVisible = ref(false);
const keyframeEditForm = ref({
  name: '',
  frame: 0,
  color: '#E6A23C',
  description: '',
});
const loopSettings = ref({
  enabled: false,
  startFrame: 0,
  endFrame: 600,
  loopCount: -1, // -1 表示无限循环
});

// 循环分界线数据
const loopDividers = ref([]);
const shortcutSettings = ref({
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y',
  playPause: 'Space',
  save: 'Ctrl+S',
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
  delete: 'Delete',
  selectAll: 'Ctrl+A',
  zoomIn: 'Ctrl++',
  zoomOut: 'Ctrl+-',
});
const shortcutsDialogVisible = ref(false);
const timelineContainer = ref(null);
const timeUnit = ref('frame'); // 'frame' 或 'second'
const damageStats = ref({
  totalDamage: 0,
  dps: 0,
  damageByCharacter: {},
  damageBySkillType: {},
});

// 计算属性
const selectedCharacter = computed(() => {
  if (!selectedCharacterId.value) return null;
  return gamedataStore.characters.find(c => c.id === selectedCharacterId.value);
});

const characterChips = computed(() => {
  // 模拟奇波数据
  return [
    {
      id: 'chip1',
      name: '攻击奇波',
      icon: '/icons/chip/attack.png',
      effect: '物理伤害+10%'
    },
    {
      id: 'chip2',
      name: '防御奇波',
      icon: '/icons/chip/defense.png',
      effect: '物理防御+15%'
    },
    {
      id: 'chip3',
      name: '元素奇波',
      icon: '/icons/chip/element.png',
      effect: '元素伤害+12%'
    },
    {
      id: 'chip4',
      name: '生命奇波',
      icon: '/icons/chip/health.png',
      effect: '最大生命值+10%'
    }
  ];
});

// 计算属性：过滤后的角色列表
const filteredCharacters = computed(() => {
  let characters = gamedataStore.characters;
  if (characterSearchQuery.value) {
    const query = characterSearchQuery.value.toLowerCase();
    characters = characters.filter(char => 
      char.name.toLowerCase().includes(query) || 
      char.element.toLowerCase().includes(query)
    );
  }
  return characters;
});

// 计算属性：过滤后的装备列表
const filteredEquipment = computed(() => {
  // 模拟装备数据
  return [
    {
      id: 'equipment1',
      name: '铁制护甲',
      icon: '/icons/equipment/armor.png',
      category: '护甲',
      effect: '物理防御+20'
    },
    {
      id: 'equipment2',
      name: '皮质手套',
      icon: '/icons/equipment/gloves.png',
      category: '手套',
      effect: '攻击力+15'
    },
    {
      id: 'equipment3',
      name: '魔法项链',
      icon: '/icons/equipment/accessory.png',
      category: '饰品',
      effect: '元素伤害+10%'
    },
    {
      id: 'equipment4',
      name: '钢盔',
      icon: '/icons/equipment/helmet.png',
      category: '头部',
      effect: '生命值+50'
    }
  ];
});
const characterChartRef = ref(null);
const skillTypeChartRef = ref(null);
const characterChart = ref(null);
const skillTypeChart = ref(null);
const loopIntervalId = ref(null);
const guideTour = ref(null);
const draggingSkillBlock = ref(null); // 正在拖拽的技能块
const resizingSkillBlock = ref(null); // 正在调整大小的技能块

// 右键菜单相关
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const contextMenuItems = ref([]);
const contextMenuTarget = ref(null); // 右键菜单的目标（技能块或时间轴空白区域）

// 计算属性
const isDark = computed(() => settingStore.theme === 'dark');
const teamCharacters = computed(() => {
  if (!project.value) return [];
  return project.value.characters
    .map(charId => {
      return gamedataStore.characters.find(c => c.id === charId);
    })
    .filter(Boolean);
});
const enemy = computed(() => {
  if (!project.value) return null;
  return gamedataStore.enemies.find(e => e.id === project.value.enemy);
});
const totalWidth = computed(() => {
  return (project?.value?.duration || 1200) * scale.value;
});
const timeTicks = computed(() => {
  const ticks = [];
  const duration = project?.value?.duration || 1200;
  const step = Math.max(1, Math.floor(duration / 20));

  for (let i = 0; i <= duration; i += step) {
    ticks.push({
      frame: i,
      position: i * scale.value,
      label: formatTime(i),
    });
  }
  return ticks;
});

// 方法
const navigateTo = path => {
  router.push(path);
};

const toggleTheme = () => {
  settingStore.toggleTheme();
};

// 保存项目
const saveProject = () => {
  if (project.value) {
    projectStore.saveProject(project.value.id);
    ElMessage.success('项目保存成功');
  }
};

// 复制技能块
const copySkillBlock = () => {
  if (selectedSkillBlock.value) {
    localStorage.setItem(
      'promilia_copied_skill_block',
      JSON.stringify(selectedSkillBlock.value)
    );
    ElMessage.success('技能块已复制');
  }
};

// 粘贴技能动作
const pasteSkillBlock = () => {
  if (!project.value) return;

  const copiedBlock = localStorage.getItem('promilia_copied_skill_block');
  if (copiedBlock) {
    try {
      const blockData = JSON.parse(copiedBlock);
      // 创建新技能动作，调整位置
      const newBlock = {
        ...blockData,
        startTime: blockData.startTime + 60, // 偏移60帧
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      };
      projectStore.addAction(project.value.id, newBlock);
      calculateDamageStats();
      ElMessage.success('技能动作已粘贴');
    } catch (error) {
      console.error('Failed to paste skill block:', error);
      ElMessage.error('粘贴失败');
    }
  }
};

// 删除技能动作
const deleteSkillBlock = () => {
  if (selectedSkillBlock.value && project.value) {
    historyStore.recordSkillBlockAction(
      'delete',
      selectedSkillBlock.value,
      selectedSkillBlock.value
    );
    projectStore.removeAction(
      project.value.id,
      selectedSkillBlock.value.id
    );
    selectedSkillBlock.value = null;
    calculateDamageStats();
    ElMessage.success('技能动作已删除');
  }
};

// 键盘事件处理
const handleKeydown = event => {
  // 避免在输入框中触发
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }

  // 复制: Ctrl+C
  if (event.ctrlKey && event.key === 'c') {
    event.preventDefault();
    copySkillBlock();
  }

  // 粘贴: Ctrl+V
  if (event.ctrlKey && event.key === 'v') {
    event.preventDefault();
    pasteSkillBlock();
  }

  // 删除: Delete
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    deleteSkillBlock();
  }

  // 保存: Ctrl+S
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault();
    saveProject();
  }

  // 播放/暂停: Space
  if (
    event.key === ' ' &&
    !event.target.classList.contains('el-input__inner')
  ) {
    event.preventDefault();
    togglePlay();
  }

  // 撤销: Ctrl+Z
  if (event.ctrlKey && event.key === 'z') {
    event.preventDefault();
    undo();
  }

  // 重做: Ctrl+Y
  if (event.ctrlKey && event.key === 'y') {
    event.preventDefault();
    redo();
  }

  // 全选: Ctrl+A
  if (event.ctrlKey && event.key === 'a') {
    event.preventDefault();
    selectAllSkillBlocks();
  }

  // 放大: Ctrl++
  if (event.ctrlKey && event.key === '+') {
    event.preventDefault();
    zoomIn();
  }

  // 缩小: Ctrl+-
  if (event.ctrlKey && event.key === '-') {
    event.preventDefault();
    zoomOut();
  }
};

const selectAllSkillBlocks = () => {
  if (!project.value) return;
  selectedSkillBlocks.value = [...project.value.actions];
};

const toggleCharacterGroup = characterId => {
  const index = expandedCharacters.value.indexOf(characterId);
  if (index === -1) {
    expandedCharacters.value.push(characterId);
  } else {
    expandedCharacters.value.splice(index, 1);
  }
};

const toggleTrackVisibility = characterId => {
  const index = visibleTracks.value.indexOf(characterId);
  if (index === -1) {
    visibleTracks.value.push(characterId);
  } else {
    visibleTracks.value.splice(index, 1);
  }
};

const handleTabClick = (tab) => {
  activeLeftTab.value = tab.props.name;
};



const selectSkill = (skill) => {
  selectedSkill.value = skill;
};

const selectTrack = (characterId) => {
  selectedCharacterId.value = characterId;
};

const selectChip = (chip) => {
  selectedChip.value = chip;
};

// 为当前选中角色选择奇波
const selectChipForCharacter = (chip) => {
  if (selectedCharacter.value && project.value) {
    projectStore.updateCharacterChip(project.value.id, selectedCharacter.value.id, chip.id);
    selectedChip.value = chip;
    ElMessage.success(`已为 ${selectedCharacter.value.name} 选择奇波: ${chip.name}`);
  }
};

// 角色选择弹窗
const isCharacterSelectorVisible = ref(false);
const targetTrackIndex = ref(null);
const characterSearchQuery = ref('');

// 奇波选择弹窗
const isChipSelectorVisible = ref(false);
const chipTargetIndex = ref(null);

// 装备选择弹窗
const isEquipmentSelectorVisible = ref(false);
const equipmentTargetIndex = ref(null);
const equipmentSlotKey = ref('armor');

// 轨道拖拽状态
const draggingTrackIndex = ref(null);
const dropTargetIndex = ref(null);

// 打开角色选择器
const openCharacterSelector = (index) => {
  targetTrackIndex.value = index;
  characterSearchQuery.value = '';
  isCharacterSelectorVisible.value = true;
};

// 确认角色选择
const confirmCharacterSelection = (charId) => {
  if (targetTrackIndex.value !== null && project.value) {
    // 实现角色更换逻辑
    const characters = [...project.value.characters];
    characters[targetTrackIndex.value] = charId;
    projectStore.updateProjectCharacters(project.value.id, characters);
    selectedCharacterId.value = charId;
    ElMessage.success('角色已更换');
  }
  isCharacterSelectorVisible.value = false;
};

// 打开奇波选择器
const openChipSelector = (index) => {
  chipTargetIndex.value = index;
  isChipSelectorVisible.value = true;
};

// 确认奇波选择
const confirmChipSelection = (chipId) => {
  if (chipTargetIndex.value !== null && project.value) {
    const character = teamCharacters.value[chipTargetIndex.value];
    if (character) {
      projectStore.updateCharacterChip(project.value.id, character.id, chipId);
      ElMessage.success('奇波已选择');
    }
  }
  isChipSelectorVisible.value = false;
};

// 打开装备选择器
const openEquipmentSelector = (index, slotKey) => {
  equipmentTargetIndex.value = index;
  equipmentSlotKey.value = slotKey;
  isEquipmentSelectorVisible.value = true;
};

// 确认装备选择
const confirmEquipmentSelection = (equipmentId) => {
  if (equipmentTargetIndex.value !== null && project.value) {
    const character = teamCharacters.value[equipmentTargetIndex.value];
    if (character) {
      projectStore.updateCharacterEquipment(project.value.id, character.id, equipmentSlotKey.value, equipmentId);
      ElMessage.success('装备已选择');
    }
  }
  isEquipmentSelectorVisible.value = false;
};

// 获取角色的奇波数据
const getCharacterChip = (characterId) => {
  if (!project.value) return null;
  const characterData = projectStore.getCharacterData(project.value.id, characterId);
  if (characterData && characterData.chipId) {
    return characterChips.value.find(chip => chip.id === characterData.chipId);
  }
  return null;
};

// 获取角色的装备数据
const getCharacterEquipment = (characterId, slotKey) => {
  if (!project.value) return null;
  const characterData = projectStore.getCharacterData(project.value.id, characterId);
  if (characterData && characterData.equipment && characterData.equipment[slotKey]) {
    return filteredEquipment.value.find(eq => eq.id === characterData.equipment[slotKey]);
  }
  return null;
};

// 轨道拖拽开始
const onTrackDragStart = (event, index) => {
  draggingTrackIndex.value = index;
  event.dataTransfer.effectAllowed = 'move';
  const trackInfoEl = event.target.closest('.track-info');
  if (trackInfoEl) {
    const rect = trackInfoEl.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    event.dataTransfer.setDragImage(trackInfoEl, offsetX, offsetY);
  }
};

// 轨道拖拽经过
const onTrackDragOver = (event, index) => {
  if (draggingTrackIndex.value === null) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  dropTargetIndex.value = index;
};

// 轨道拖拽结束
const onTrackDrop = (event, targetIndex) => {
  event.preventDefault();
  if (draggingTrackIndex.value !== null && draggingTrackIndex.value !== targetIndex && project.value) {
    // 实现轨道顺序调整逻辑
    const characters = [...project.value.characters];
    const [movedCharacter] = characters.splice(draggingTrackIndex.value, 1);
    characters.splice(targetIndex, 0, movedCharacter);
    projectStore.updateProjectCharacters(project.value.id, characters);
    ElMessage.success('角色顺序已调整');
  }
  resetDragState();
};

// 轨道拖拽结束
const onTrackDragEnd = () => {
  resetDragState();
};

// 重置拖拽状态
const resetDragState = () => {
  draggingTrackIndex.value = null;
  dropTargetIndex.value = null;
};

// 向上移动轨道
const moveTrackUp = (index) => {
  if (index > 0 && project.value) {
    // 实现轨道上移逻辑
    const characters = [...project.value.characters];
    const [movedCharacter] = characters.splice(index, 1);
    characters.splice(index - 1, 0, movedCharacter);
    projectStore.updateProjectCharacters(project.value.id, characters);
    ElMessage.success('角色顺序已调整');
  }
};

// 向下移动轨道
const moveTrackDown = (index) => {
  if (index < teamCharacters.value.length - 1 && project.value) {
    // 实现轨道下移逻辑
    const characters = [...project.value.characters];
    const [movedCharacter] = characters.splice(index, 1);
    characters.splice(index + 1, 0, movedCharacter);
    projectStore.updateProjectCharacters(project.value.id, characters);
    ElMessage.success('角色顺序已调整');
  }
};

const onSkillDragStart = (event, skill, characterId) => {
  event.dataTransfer.setData('application/json', JSON.stringify({
    skill,
    characterId
  }));
  event.dataTransfer.effectAllowed = 'copy';
};

const onSkillDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
};

const onSkillDrop = (event, characterId) => {
  const data = JSON.parse(event.dataTransfer.getData('application/json'));
  if (data.characterId === characterId) {
    // 计算技能动作的起始位置（基于鼠标位置和时间轴缩放）
    const timelineRect = timelineContainer.value.getBoundingClientRect();
    const dropX = event.clientX - timelineRect.left;
    let startTime = Math.round(dropX / scale.value);

    // 吸附到网格
    if (snapToGrid.value) {
      startTime = Math.round(startTime / 10) * 10;
    }

    // 计算技能动作的结束位置
    const duration = data.skill.frames?.end || 60; // 默认60帧
    const endTime = startTime + duration;

    // 创建技能动作，包含伤害判定点、CD等信息
    const newAction = projectStore.addAction(project.value.id, {
      characterId,
      skillId: data.skill.id,
      name: data.skill.name,
      startTime,
      duration,
      type: data.skill.type || 'skill',
      spCost: data.skill.energyCost || 0,
      element: data.skill.element || 'physical',
      cooldown: data.skill.cooldown || 0,
      damageTicks: data.skill.damageTicks || [],
      physicalAnomaly: data.skill.physicalAnomaly || [],
      triggerWindow: data.skill.triggerWindow || 0,
      enhancementTime: data.skill.enhancementTime || 0,
    });
    if (newAction) {
      historyStore.recordSkillBlockAction('add', newAction);
      // 重新计算伤害统计
      calculateDamageStats();
    }
  }
};

const getCharacterSkillBlocks = characterId => {
  if (!project.value) return [];
  return project.value.actions.filter(
    action => action.characterId === characterId && !action.isChipSkill
  );
};

const getCharacterChipSkillBlocks = characterId => {
  if (!project.value) return [];
  return project.value.actions.filter(
    action => action.characterId === characterId && action.isChipSkill
  );
};

const getCharacterBuffBlocks = characterId => {
  // 模拟数据，实际应该从项目数据中获取
  return [];
};

const getCharacterResourceBlocks = characterId => {
  // 模拟数据，实际应该从项目数据中获取
  return [];
};

const selectSkillBlock = skillBlockId => {
  selectedSkillBlock.value = project.value.actions.find(
    action => action.id === skillBlockId
  );
  selectedSkillBlocks.value = [selectedSkillBlock.value];
  selectedBuffBlock.value = null;
  selectedResourceBlock.value = null;
  selectedKeyframe.value = null;
  skillEditPanelVisible.value = true;
};

const selectSkillBlocks = blocks => {
  selectedSkillBlocks.value = blocks;
  selectedSkillBlock.value = blocks.length === 1 ? blocks[0] : null;
  selectedBuffBlock.value = null;
  selectedResourceBlock.value = null;
  selectedKeyframe.value = null;
};

const selectBuffBlock = buffBlockId => {
  // 实际应该从项目数据中获取
  selectedBuffBlock.value = { id: buffBlockId };
  selectedSkillBlock.value = null;
  selectedSkillBlocks.value = [];
  selectedResourceBlock.value = null;
  selectedKeyframe.value = null;
};

// 右键菜单相关方法
const onSkillBlockContextMenu = (skillBlockId, position) => {
  const skillBlock = project.value.actions.find(action => action.id === skillBlockId);
  if (skillBlock) {
    selectSkillBlock(skillBlockId);
    contextMenuTarget.value = { type: 'skill', id: skillBlockId };
    contextMenuPosition.value = position;
    contextMenuItems.value = [
      {
        id: 'copy',
        label: '复制',
        shortcut: 'Ctrl+C',
        action: 'copySkillBlock'
      },
      {
        id: 'paste',
        label: '粘贴',
        shortcut: 'Ctrl+V',
        action: 'pasteSkillBlock'
      },
      {
        type: 'separator'
      },
      {
        id: 'delete',
        label: '删除',
        shortcut: 'Delete',
        action: 'deleteSkillBlock'
      },
      {
        type: 'separator'
      },
      {
        id: 'lock',
        label: skillBlock.isLocked ? '解锁位置' : '锁定位置',
        action: 'toggleSkillBlockLock',
        data: skillBlockId
      },
      {
        id: 'disable',
        label: skillBlock.isDisabled ? '启用' : '禁用',
        action: 'toggleSkillBlockDisable',
        data: skillBlockId
      },
      {
        type: 'separator'
      },
      {
        id: 'color',
        label: '调整颜色',
        action: 'adjustSkillBlockColor',
        data: skillBlockId
      }
    ];
    contextMenuVisible.value = true;
  }
};

const onTimelineContextMenu = (event) => {
  event.preventDefault();
  event.stopPropagation();
  
  contextMenuTarget.value = { type: 'timeline', position: event.clientX };
  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  };
  contextMenuItems.value = [
    {
      id: 'paste',
      label: '粘贴技能',
      shortcut: 'Ctrl+V',
      action: 'pasteSkillBlockAtPosition',
      data: event.clientX
    },
    {
      id: 'addDivider',
      label: '添加循环分界线',
      action: 'addLoopDivider',
      data: event.clientX
    },
    {
      id: 'switchCharacter',
      label: '在此处切人',
      action: 'switchCharacterAtPosition',
      data: event.clientX
    }
  ];
  contextMenuVisible.value = true;
};

const handleContextMenuSelect = (action, data) => {
  switch (action) {
    case 'copySkillBlock':
      copySkillBlock();
      break;
    case 'pasteSkillBlock':
      pasteSkillBlock();
      break;
    case 'deleteSkillBlock':
      deleteSkillBlock();
      break;
    case 'toggleSkillBlockLock':
      toggleSkillBlockLock(data);
      break;
    case 'toggleSkillBlockDisable':
      toggleSkillBlockDisable(data);
      break;
    case 'adjustSkillBlockColor':
      adjustSkillBlockColor(data, event);
      break;
    case 'pasteSkillBlockAtPosition':
      pasteSkillBlockAtPosition(data);
      break;
    case 'addLoopDivider':
      addLoopDivider(data);
      break;
    case 'switchCharacterAtPosition':
      switchCharacterAtPosition(data, event);
      break;
  }
};

const toggleSkillBlockLock = (skillBlockId) => {
  if (!project.value) return;
  const skillBlock = project.value.actions.find(action => action.id === skillBlockId);
  if (skillBlock) {
    skillBlock.isLocked = !skillBlock.isLocked;
    projectStore.updateAction(project.value.id, skillBlock);
    ElMessage.success(skillBlock.isLocked ? '技能已锁定' : '技能已解锁');
  }
};

const toggleSkillBlockDisable = (skillBlockId) => {
  if (!project.value) return;
  const skillBlock = project.value.actions.find(action => action.id === skillBlockId);
  if (skillBlock) {
    skillBlock.isDisabled = !skillBlock.isDisabled;
    projectStore.updateAction(project.value.id, skillBlock);
    ElMessage.success(skillBlock.isDisabled ? '技能已禁用' : '技能已启用');
    // 重新计算伤害统计
    calculateDamageStats();
  }
};

const adjustSkillBlockColor = (skillBlockId, event) => {
  if (!project.value) return;
  const skillBlock = project.value.actions.find(action => action.id === skillBlockId);
  if (skillBlock) {
    // 显示颜色选择菜单
    colorSelectSkillBlockId.value = skillBlockId;
    colorSelectMenuPosition.value = {
      x: event.clientX,
      y: event.clientY
    };
    showColorSelectMenu.value = true;
  }
};

const handleColorSelect = (color) => {
  if (!project.value) return;
  const skillBlock = project.value.actions.find(action => action.id === colorSelectSkillBlockId.value);
  if (skillBlock) {
    skillBlock.customColor = color;
    projectStore.updateAction(project.value.id, skillBlock);
    ElMessage.success('技能颜色已调整');
  }
  showColorSelectMenu.value = false;
};

const pasteSkillBlockAtPosition = (clientX) => {
  if (!project.value || !timelineContainer.value) return;
  
  const copiedBlock = localStorage.getItem('promilia_copied_skill_block');
  if (copiedBlock) {
    try {
      const blockData = JSON.parse(copiedBlock);
      const timelineRect = timelineContainer.value.getBoundingClientRect();
      const dropX = clientX - timelineRect.left;
      let startTime = Math.round(dropX / scale.value);
      
      if (snapToGrid.value) {
        startTime = Math.round(startTime / 10) * 10;
      }
      
      const newBlock = {
        ...blockData,
        startTime,
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      };
      projectStore.addAction(project.value.id, newBlock);
      calculateDamageStats();
      ElMessage.success('技能动作已粘贴');
    } catch (error) {
      console.error('Failed to paste skill block:', error);
      ElMessage.error('粘贴失败');
    }
  }
};

const addLoopDivider = (clientX) => {
  if (!project.value || !timelineContainer.value) return;
  
  const timelineRect = timelineContainer.value.getBoundingClientRect();
  const dropX = clientX - timelineRect.left;
  let frame = Math.round(dropX / scale.value);
  
  if (snapToGrid.value) {
    frame = Math.round(frame / 10) * 10;
  }
  
  // 添加循环分界线
  const newDivider = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    frame: frame,
    color: '#E6A23C',
    label: `循环分界 ${loopDividers.value.length + 1}`
  };
  
  loopDividers.value.push(newDivider);
  ElMessage.success(`在 ${formatTime(frame)} 添加循环分界线`);
};

// 角色切换相关
const showCharacterSwitchMenu = ref(false);
const characterSwitchMenuPosition = ref({ x: 0, y: 0 });
const characterSwitchFrame = ref(0);

// 颜色选择相关
const showColorSelectMenu = ref(false);
const colorSelectMenuPosition = ref({ x: 0, y: 0 });
const colorSelectSkillBlockId = ref('');

// 可用颜色列表
const availableColors = [
  '#409EFF', // 蓝色
  '#67C23A', // 绿色
  '#E6A23C', // 橙色
  '#F56C6C', // 红色
  '#909399', // 灰色
  '#722ED1', // 紫色
  '#13C2C2', // 青色
  '#FAAD14', // 黄色
  '#EB2F96', // 粉色
  '#52C41A', // 深绿色
  '#1890FF', // 深蓝色
  '#FA541C'  // 橙红色
];

const switchCharacterAtPosition = (clientX, event) => {
  if (!project.value || !timelineContainer.value) return;
  
  const timelineRect = timelineContainer.value.getBoundingClientRect();
  const dropX = clientX - timelineRect.left;
  let frame = Math.round(dropX / scale.value);
  
  if (snapToGrid.value) {
    frame = Math.round(frame / 10) * 10;
  }
  
  // 显示角色选择菜单
  characterSwitchFrame.value = frame;
  characterSwitchMenuPosition.value = {
    x: clientX,
    y: event.clientY
  };
  showCharacterSwitchMenu.value = true;
};

const handleCharacterSwitch = (characterId) => {
  const character = gamedataStore.characters.find(c => c.id === characterId);
  if (character) {
    ElMessage.success(`在 ${formatTime(characterSwitchFrame.value)} 切换到角色: ${character.name}`);
  }
  showCharacterSwitchMenu.value = false;
};

const selectResourceBlock = resourceBlockId => {
  // 实际应该从项目数据中获取
  selectedResourceBlock.value = { id: resourceBlockId };
  selectedSkillBlock.value = null;
  selectedSkillBlocks.value = [];
  selectedBuffBlock.value = null;
  selectedKeyframe.value = null;
};

const selectKeyframe = keyframeId => {
  selectedKeyframe.value = project.value.keyframes.find(
    keyframe => keyframe.id === keyframeId
  );
  if (selectedKeyframe.value) {
    keyframeEditForm.value = {
      ...selectedKeyframe.value,
    };
    keyframeEditPanelVisible.value = true;
  }
  selectedSkillBlock.value = null;
  selectedSkillBlocks.value = [];
  selectedBuffBlock.value = null;
  selectedResourceBlock.value = null;
};

const saveKeyframeChanges = () => {
  if (selectedKeyframe.value) {
    projectStore.updateKeyframe(project.value.id, {
      ...selectedKeyframe.value,
      ...keyframeEditForm.value,
    });
    keyframeEditPanelVisible.value = false;
    ElMessage.success('关键帧已更新');
  }
};

const openSkillEditPanel = skillBlockId => {
  selectedSkillBlock.value = project.value.actions.find(
    action => action.id === skillBlockId
  );
  skillEditPanelVisible.value = true;
};

const saveSkillBlockChanges = updatedSkillBlock => {
  const oldBlock = project.value.actions.find(
    action => action.id === updatedSkillBlock.id
  );
  if (oldBlock) {
    historyStore.recordSkillBlockAction('update', updatedSkillBlock, oldBlock);
  }
  projectStore.updateAction(project.value.id, updatedSkillBlock);
  selectedSkillBlock.value = updatedSkillBlock;
  // 重新计算伤害统计
  calculateDamageStats();
};

const onSkillBlockDragStart = skillBlockId => {
  const skillBlock = project.value.actions.find(
    action => action.id === skillBlockId
  );
  if (skillBlock) {
    draggingSkillBlock.value = { ...skillBlock }; // 保存拖拽前的状态
  }
};

const onSkillBlockDragMove = (skillBlockId, newStartFrame) => {
  // 吸附到网格
  if (snapToGrid.value) {
    newStartFrame = Math.round(newStartFrame / 10) * 10;
  }

  // 更新技能动作位置
  const skillBlock = project.value.actions.find(
    action => action.id === skillBlockId
  );
  if (skillBlock) {
    const updatedBlock = {
      ...skillBlock,
      startTime: newStartFrame,
    };
    projectStore.updateAction(project.value.id, updatedBlock);
    // 重新计算伤害统计
    calculateDamageStats();
  }
};

const onSkillBlockDragEnd = skillBlockId => {
  const skillBlock = project.value.actions.find(
    action => action.id === skillBlockId
  );
  if (skillBlock && draggingSkillBlock.value) {
    historyStore.recordSkillBlockAction(
      'update',
      skillBlock,
      draggingSkillBlock.value
    );
    draggingSkillBlock.value = null;
  }
};

const onSkillBlockResizeStart = skillBlockId => {
  const skillBlock = project.value.actions.find(
    action => action.id === skillBlockId
  );
  if (skillBlock) {
    resizingSkillBlock.value = { ...skillBlock }; // 保存调整前的状态
  }
};

const onSkillBlockResizeMove = (skillBlockId, newEndFrame) => {
  // 吸附到网格
  if (snapToGrid.value) {
    newEndFrame = Math.round(newEndFrame / 10) * 10;
  }

  // 更新技能动作持续时间
  const skillBlock = project.value.actions.find(
    action => action.id === skillBlockId
  );
  if (skillBlock) {
    const duration = newEndFrame - skillBlock.startTime;
    const updatedBlock = {
      ...skillBlock,
      duration,
    };
    projectStore.updateAction(project.value.id, updatedBlock);
    // 重新计算伤害统计
    calculateDamageStats();
  }
};

const onSkillBlockResizeEnd = skillBlockId => {
  const skillBlock = project.value.actions.find(
    action => action.id === skillBlockId
  );
  if (skillBlock && resizingSkillBlock.value) {
    historyStore.recordSkillBlockAction(
      'update',
      skillBlock,
      resizingSkillBlock.value
    );
    resizingSkillBlock.value = null;
  }
};

const getElementColor = element => {
  const elementData = gamedataStore.elements.find(
    e => e.id === `element_${element}`
  );
  return elementData ? elementData.color : '#409EFF';
};

const getOriginalSkill = skillId => {
  if (!skillId) return null;
  for (const character of gamedataStore.characters) {
    const skill = character.skills.find(s => s.id === skillId);
    if (skill) return skill;
  }
  return null;
};

const getCharacter = characterId => {
  if (!characterId) return null;
  return gamedataStore.characters.find(c => c.id === characterId);
};

// 计算伤害统计
const calculateDamageStats = () => {
  if (project.value && gamedataStore.characters.length > 0) {
    const stats = calculateTimelineDamage(project.value, {
      characters: gamedataStore.characters,
      enemies: gamedataStore.enemies,
    });
    damageStats.value = stats;
    updateCharts();
  }
};

// 初始化图表
const initCharts = () => {
  if (characterChartRef.value) {
    characterChart.value = echarts.init(characterChartRef.value);
  }
  if (skillTypeChartRef.value) {
    skillTypeChart.value = echarts.init(skillTypeChartRef.value);
  }
  updateCharts();
};

// 更新图表
const updateCharts = () => {
  updateCharacterChart();
  updateSkillTypeChart();
};

// 更新角色伤害占比图表
const updateCharacterChart = () => {
  if (!characterChart.value) return;

  const data = Object.entries(damageStats.value.damageByCharacter).map(
    ([name, damage]) => ({
      name,
      value: damage,
    })
  );

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: Object.keys(damageStats.value.damageByCharacter),
    },
    series: [
      {
        name: '伤害占比',
        type: 'pie',
        radius: '60%',
        data: data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  characterChart.value.setOption(option);
};

// 更新技能类型伤害占比图表
const updateSkillTypeChart = () => {
  if (!skillTypeChart.value) return;

  const data = Object.entries(damageStats.value.damageBySkillType).map(
    ([type, damage]) => ({
      name: type,
      value: damage,
    })
  );

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      data: Object.keys(damageStats.value.damageBySkillType),
    },
    series: [
      {
        name: '技能类型占比',
        type: 'pie',
        radius: '60%',
        data: data,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  skillTypeChart.value.setOption(option);
};

// 处理窗口大小变化
const handleResize = () => {
  characterChart.value?.resize();
  skillTypeChart.value?.resize();
};

const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
  if (isPlaying.value) {
    startPlayback();
  }
};

const startPlayback = () => {
  const interval = setInterval(() => {
    if (!isPlaying.value) {
      clearInterval(interval);
      return;
    }

    currentFrame.value += parseFloat(playbackSpeed.value);
    if (currentFrame.value >= (project?.value?.duration || 1200)) {
      currentFrame.value = 0;
    }
  }, 16.67); // 60fps
};

const stepForward = () => {
  currentFrame.value = Math.min(
    currentFrame.value + 1,
    project?.value?.duration || 1200
  );
};

const stepBackward = () => {
  currentFrame.value = Math.max(currentFrame.value - 1, 0);
};

const goToStart = () => {
  currentFrame.value = 0;
};

const goToEnd = () => {
  currentFrame.value = project?.value?.duration || 1200;
};

const jumpToFrame = frame => {
  currentFrame.value = frame;
};

// 优化后的缩放函数
const zoomIn = useThrottleFn(() => {
  scale.value = Math.min(scale.value + 0.5, 5);
}, 100);

const zoomOut = useThrottleFn(() => {
  scale.value = Math.max(scale.value - 0.5, 0.5);
}, 100);

// 优化时间轴滚动
const handleTimelineScroll = useThrottleFn((e) => {
  if (Math.abs(e.deltaX) > 0 || e.shiftKey) {
    e.preventDefault();
    let delta = e.deltaX;
    if (e.shiftKey && delta === 0) delta = e.deltaY;
    
    // 计算新的滚动位置
    const newLeft = store.timelineShift + delta;
    store.setTimelineShift(newLeft);
  }
}, 16);

const toggleTimeUnit = () => {
  timeUnit.value = timeUnit.value === 'frame' ? 'second' : 'frame';
};

const formatTime = frames => {
  if (timeUnit.value === 'second') {
    const seconds = Math.floor(frames / 60);
    const remainingFrames = frames % 60;
    return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
  } else {
    return `${frames}f`;
  }
};

// 解析分享链接
const parseShareLink = () => {
  const shareData = route.query.share;
  if (shareData) {
    try {
      // 解码 Base64
      const jsonString = decodeURIComponent(escape(atob(shareData)));
      const data = JSON.parse(jsonString);

      if (data.project) {
        // 导入项目
        const importedProject = projectStore.importProject(data);
        if (importedProject) {
          project.value = importedProject;
          // 初始化展开所有角色
          importedProject.characters.forEach(charId => {
            expandedCharacters.value.push(charId);
            visibleTracks.value.push(charId);
          });
          ElMessage.success('成功加载分享的项目');
          return true;
        }
      }
    } catch (error) {
      console.error('解析分享链接失败:', error);
      ElMessage.error('解析分享链接失败');
    }
  }
  return false;
};

// 撤销操作
const undo = () => {
  const action = historyStore.undo();
  if (action) {
    handleUndoAction(action, 'undo');
  }
};

// 重做操作
const redo = () => {
  const action = historyStore.redo();
  if (action) {
    handleUndoAction(action, 'redo');
  }
};

// 处理撤销/重做操作
const handleUndoAction = (action, mode) => {
  if (action.type.startsWith('skillBlock_')) {
    handleSkillBlockAction(action, mode);
  } else if (action.type.startsWith('keyframe_')) {
    handleKeyframeAction(action, mode);
  }
};

// 处理技能动作操作
const handleSkillBlockAction = (action, mode) => {
  const actionType = action.type.replace('skillBlock_', '');
  switch (actionType) {
    case 'add':
      if (mode === 'undo') {
        projectStore.removeAction(
          project.value.id,
          action.data.skillBlock.id
        );
      } else if (mode === 'redo') {
        projectStore.addAction(project.value.id, action.data.skillBlock);
      }
      break;
    case 'delete':
      if (mode === 'undo') {
        projectStore.addAction(project.value.id, action.data.skillBlock);
      } else if (mode === 'redo') {
        projectStore.removeAction(
          project.value.id,
          action.data.skillBlock.id
        );
      }
      break;
    case 'update':
      if (mode === 'undo') {
        projectStore.updateAction(project.value.id, action.data.oldData);
      } else if (mode === 'redo') {
        projectStore.updateAction(project.value.id, action.data.skillBlock);
      }
      break;
    default:
      break;
  }
  calculateDamageStats();
};

// 处理关键帧操作
const handleKeyframeAction = (action, mode) => {
  const actionType = action.type.replace('keyframe_', '');
  switch (actionType) {
    case 'add':
      if (mode === 'undo') {
        projectStore.removeKeyframe(project.value.id, action.data.keyframe.id);
      } else if (mode === 'redo') {
        projectStore.addKeyframe(project.value.id, action.data.keyframe);
      }
      break;
    case 'delete':
      if (mode === 'undo') {
        projectStore.addKeyframe(project.value.id, action.data.keyframe);
      } else if (mode === 'redo') {
        projectStore.removeKeyframe(project.value.id, action.data.keyframe.id);
      }
      break;
    case 'update':
      if (mode === 'undo') {
        projectStore.updateKeyframe(project.value.id, action.data.oldData);
      } else if (mode === 'redo') {
        projectStore.updateKeyframe(project.value.id, action.data.keyframe);
      }
      break;
    default:
      break;
  }
};

// 切换循环播放
const toggleLoop = () => {
  loopSettings.value.enabled = !loopSettings.value.enabled;
  if (loopSettings.value.enabled) {
    applyLoopSettings();
  } else {
    stopLoopPlayback();
  }
};

// 应用循环播放设置
const applyLoopSettings = () => {
  stopLoopPlayback();
  if (loopSettings.value.enabled) {
    startLoopPlayback();
  }
};

// 开始循环播放
const startLoopPlayback = () => {
  let loopCount = 0;
  const maxLoopCount = loopSettings.value.loopCount;

  loopIntervalId.value = setInterval(() => {
    if (!isPlaying.value) {
      clearInterval(loopIntervalId.value);
      loopIntervalId.value = null;
      return;
    }

    currentFrame.value += parseFloat(playbackSpeed.value);

    if (currentFrame.value >= loopSettings.value.endFrame) {
      loopCount++;
      if (maxLoopCount !== -1 && loopCount >= maxLoopCount) {
        clearInterval(loopIntervalId.value);
        loopIntervalId.value = null;
        isPlaying.value = false;
        currentFrame.value = loopSettings.value.startFrame;
        return;
      }
      currentFrame.value = loopSettings.value.startFrame;
    }
  }, 16.67); // 60fps
};

// 停止循环播放
const stopLoopPlayback = () => {
  if (loopIntervalId.value) {
    clearInterval(loopIntervalId.value);
    loopIntervalId.value = null;
  }
};

// 打开快捷键设置对话框
const openShortcutsDialog = () => {
  loadShortcutSettings();
  shortcutsDialogVisible.value = true;
};

// 加载快捷键设置
const loadShortcutSettings = () => {
  const savedSettings = localStorage.getItem('promilia_shortcuts');
  if (savedSettings) {
    try {
      shortcutSettings.value = JSON.parse(savedSettings);
    } catch (error) {
      console.error('加载快捷键设置失败:', error);
    }
  }
};

// 保存快捷键设置
const saveShortcutSettings = () => {
  localStorage.setItem(
    'promilia_shortcuts',
    JSON.stringify(shortcutSettings.value)
  );
  shortcutsDialogVisible.value = false;
  ElMessage.success('快捷键设置已保存');
};

// 处理导出命令
const handleExportCommand = command => {
  if (!project.value) return;

  switch (command) {
    case 'promilia':
      exportProject();
      break;
    case 'json':
      exportJson();
      break;
    case 'image':
      exportImage();
      break;
    case 'markdown':
      exportMarkdown();
      break;
    case 'share':
      generateShareLink();
      break;
    default:
      break;
  }
};

// 导出项目
const exportProject = () => {
  if (project.value) {
    const exportData = projectStore.exportProject(project.value.id);
    if (exportData) {
      // 创建下载链接
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.value.name}_${new Date().toISOString().slice(0, 10)}.promilia`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      ElMessage.success('项目导出成功');
    }
  }
};

// 导出JSON
const exportJson = () => {
  if (project.value) {
    const exportData = JSON.stringify(project.value, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.value.name}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    ElMessage.success('JSON导出成功');
  }
};

// 导出图片
const exportImage = () => {
  ElMessage.info('图片导出功能开发中');
};

// 导出Markdown
const exportMarkdown = () => {
  ElMessage.info('Markdown导出功能开发中');
};

// 生成分享链接
const generateShareLink = () => {
  if (project.value) {
    try {
      const shareData = {
        project: project.value,
      };
      const jsonString = JSON.stringify(shareData);
      const base64String = btoa(unescape(encodeURIComponent(jsonString)));
      const shareUrl = `${window.location.origin}${window.location.pathname}?share=${base64String}`;

      // 复制到剪贴板
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          ElMessage.success('分享链接已复制到剪贴板');
        })
        .catch(() => {
          ElMessage.error('复制失败，请手动复制链接');
          console.log('分享链接:', shareUrl);
        });
    } catch (error) {
      console.error('生成分享链接失败:', error);
      ElMessage.error('生成分享链接失败');
    }
  }
};

// 开始新手引导
const startGuideTour = () => {
  guideTour.value?.startTour();
};

// 装备选择处理
const onEquipmentSelect = (equipment) => {
  selectedEquipment.value = equipment;
};

// Boss事件处理
const selectBossEvent = (eventId) => {
  selectedBossEvent.value = project.value.bossEvents.find(event => event.id === eventId);
};

const addBossEvent = (event) => {
  if (project.value) {
    projectStore.addBossEvent(project.value.id, event);
  }
};

const updateBossEvent = (event) => {
  if (project.value) {
    projectStore.updateBossEvent(project.value.id, event);
  }
};

const deleteBossEvent = (eventId) => {
  if (project.value) {
    projectStore.removeBossEvent(project.value.id, eventId);
  }
};

// 添加关键时间点
const addKeyframeAtPosition = event => {
  if (!project.value) return;

  const timelineRect = timelineContainer.value.getBoundingClientRect();
  const clickX = event.clientX - timelineRect.left;
  let frame = Math.round(clickX / scale.value);

  // 吸附到网格
  if (snapToGrid.value) {
    const snapStep = scale.value < 1 ? 60 : scale.value < 2 ? 30 : 10;
    frame = Math.round(frame / snapStep) * snapStep;
  }

  // 创建关键时间点
  const keyframe = {
    frame,
    name: `关键时间点 ${project.value.keyframes?.length + 1 || 1}`,
    color: '#E6A23C',
  };
  const newKeyframe = projectStore.addKeyframe(project.value.id, keyframe);
  if (newKeyframe) {
    historyStore.recordKeyframeAction('add', newKeyframe);
  }
};

const getSkillDependencies = () => {
  if (!project.value) return [];
  return project.value.skillDependencies;
};

const getSkillBlockById = blockId => {
  if (!project.value) return null;
  return project.value.actions.find(action => action.id === blockId);
};

const getTrackIndexByCharacterId = characterId => {
  return teamCharacters.value.findIndex(char => char.id === characterId);
};

const isSkillDependencySatisfied = (sourceBlock, targetBlock) => {
  // 简单的满足条件：源技能结束时间 <= 目标技能开始时间
  return sourceBlock.startTime + sourceBlock.duration <= targetBlock.startTime;
};

const addSkillDependency = () => {
  if (selectedSkillBlocks.value.length === 2) {
    const [block1, block2] = selectedSkillBlocks.value;
    // 确保源技能在目标技能之前
    const sourceBlockEnd = block1.startTime + block1.duration;
    const targetBlockStart = block2.startTime;
    const sourceBlock = sourceBlockEnd < targetBlockStart ? block1 : block2;
    const targetBlock = sourceBlockEnd < targetBlockStart ? block2 : block1;

    projectStore.addSkillDependency(
      project.value.id,
      sourceBlock.id,
      targetBlock.id
    );
    ElMessage.success('技能依赖关系已添加');
  }
};

const removeSkillDependency = (sourceBlockId, targetBlockId) => {
  projectStore.removeSkillDependencyByBlocks(
    project.value.id,
    sourceBlockId,
    targetBlockId
  );
  ElMessage.success('技能依赖关系已删除');
};

const handleLinkLineClick = data => {
  const sourceBlock = getSkillBlockById(data.sourceBlockId);
  const targetBlock = getSkillBlockById(data.targetBlockId);
  if (sourceBlock && targetBlock) {
    selectSkillBlocks([sourceBlock, targetBlock]);
  }
};

// 点击时间轴空白处，取消技能选中并关闭编辑面板
const onTimelineClick = () => {
  selectedSkillBlock.value = null;
  selectedSkillBlocks.value = [];
  skillEditPanelVisible.value = false;
  calculateDamageStats();
};

// 生命周期
onMounted(() => {
  // 加载游戏数据
  if (gamedataStore.characters.length === 0) {
    gamedataStore.loadGameData();
  }

  // 加载快捷键设置
  loadShortcutSettings();

  // 尝试解析分享链接
  const isShareLink = parseShareLink();

  if (!isShareLink) {
    // 获取项目ID
    const projectId = route.query.id;
    if (projectId) {
      // 加载项目
      project.value = projectStore.getProjectById(projectId);
      if (project.value) {
        // 初始化展开所有角色
        project.value.characters.forEach(charId => {
          expandedCharacters.value.push(charId);
          visibleTracks.value.push(charId);
        });
      }
    } else {
      // 创建新项目
      project.value = projectStore.createProject({
        name: '未命名项目',
        characters: [],
        enemy: '',
        fps: 60,
        duration: 1200,
      });
    }
  }

  // 计算伤害统计
  calculateDamageStats();

  // 初始化图表
  initCharts();

  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize);

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  // 停止播放
  isPlaying.value = false;
  // 清理循环播放定时器
  if (loopIntervalId.value) {
    clearInterval(loopIntervalId.value);
    loopIntervalId.value = null;
  }
  // 保存项目
  if (project.value) {
    projectStore.saveProject(project.value.id);
  }

  // 清理事件监听器
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeydown);

  // 销毁图表
  characterChart.value?.dispose();
  skillTypeChart.value?.dispose();
});
</script>

<style scoped>
/* App Layout */
.editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: #2c2c2c;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* 顶部导航栏 */
.editor-header {
  height: 50px;
  flex-shrink: 0;
  border-bottom: 1px solid #444;
  background-color: #3a3a3a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  color: #f0f0f0;
  margin: 0;
}

.header-center {
  display: flex;
  gap: 8px;
  align-items: center;
}

.header-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 主编辑区域 */
.editor-content {
  display: grid;
  grid-template-columns: 260px 1fr 280px;
  flex: 1;
  overflow: hidden;
}

/* 左侧功能模块 */
.left-panel {
  background-color: #252525;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 10;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #333;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
}

.panel-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0;
  letter-spacing: 1px;
}

/* 标签栏样式 */
.character-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.demo-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

:deep(.el-tabs__header) {
  background-color: #1f1f1f;
  border-bottom: 1px solid #333;
  margin: 0;
  padding: 0 16px;
}

:deep(.el-tabs__nav) {
  height: 40px;
}

:deep(.el-tabs__item) {
  color: #bbb;
  font-size: 14px;
  height: 40px;
  line-height: 40px;
  margin-right: 20px;
}

:deep(.el-tabs__item:hover) {
  color: #fff;
}

:deep(.el-tabs__item.is-active) {
  color: #ffd700;
}

:deep(.el-tabs__active-bar) {
  background-color: #ffd700;
  height: 2px;
}

:deep(.el-tabs__content) {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

/* 角色选择器 */
.character-selector {
  margin-bottom: 16px;
}

:deep(.el-select) {
  width: 100%;
}

:deep(.el-select .el-input__wrapper) {
  background-color: #1a1a1a;
  border: 1px solid #333;
}

:deep(.el-select .el-input__inner) {
  color: #fff;
}

/* 角色详情 */
.character-details {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.character-avatar {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.character-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-info {
  flex: 1;
}

.character-info h4 {
  margin: 0 0 8px 0;
  color: #fff;
  font-size: 16px;
}

.character-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.stat-label {
  color: rgba(255, 255, 255, 0.6);
}

.stat-value {
  color: #ffd700;
  font-weight: 600;
}

/* 技能列表 */
.skills-section {
  margin-top: 16px;
}

.skills-section h4 {
  margin: 0 0 12px 0;
  color: #fff;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.7);
}

.skills-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skill-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.skill-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: #ffd700;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.1);
}

.skill-icon {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.skill-icon img {
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-description {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 奇波列表 */
.chip-section {
  height: 100%;
}

.chip-list h4 {
  margin: 0 0 12px 0;
  color: #fff;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.7);
}

.chips-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chip-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.chip-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: #00e5ff;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 229, 255, 0.1);
}

.chip-item.is-selected {
  background: rgba(0, 229, 255, 0.15);
  border-color: #00e5ff;
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.2);
}

.chip-item.selected {
  background: rgba(0, 229, 255, 0.1);
  border-color: #00e5ff;
  margin-bottom: 16px;
}

.selected-chip-info {
  margin-bottom: 16px;
}

.selected-chip-info h4 {
  margin: 0 0 8px 0;
  color: #00e5ff;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.chip-icon {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chip-icon img {
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.chip-info {
  flex: 1;
  min-width: 0;
}

.chip-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-effect {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-character {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  border: 1px dashed #333;
  border-radius: 4px;
}

/* 对话框样式 */
:deep(.el-dialog) {
  background-color: #2b2b2b;
  border: 1px solid #444;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

:deep(.el-dialog__header) {
  margin-right: 0;
  border-bottom: 1px solid #3a3a3a;
  padding: 15px 20px;
}

:deep(.el-dialog__title) {
  color: #f0f0f0;
  font-size: 16px;
  font-weight: 600;
}

:deep(.el-dialog__body) {
  color: #ccc;
  padding: 25px 25px 10px 25px;
  max-height: 400px;
  overflow-y: auto;
}

:deep(.el-dialog__footer) {
  padding: 15px 25px 20px;
  border-top: 1px solid #3a3a3a;
}

:deep(.el-input__wrapper) {
  background-color: #1f1f1f;
  box-shadow: 0 0 0 1px #444 inset;
  padding: 4px 11px;
}

:deep(.el-input__inner) {
  color: white;
  height: 36px;
  line-height: 36px;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #666 inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #ffd700 inset;
}

/* 角色选择对话框 */
.character-selector-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-box {
  margin-bottom: 8px;
}

.character-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

/* 循环分界线样式 */
.loop-dividers {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.loop-divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  border-left: 2px dashed var(--primary-color);
  z-index: 50;
  pointer-events: auto;
  cursor: pointer;
}

.loop-divider:hover {
  border-left-style: solid;
  border-left-width: 3px;
}

.loop-divider-label {
  position: absolute;
  top: -20px;
  left: 5px;
  background-color: var(--bg-color);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: var(--text-color);
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* 角色切换菜单样式 */
.character-switch-menu {
  position: fixed;
  z-index: 10000;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  min-width: 150px;
  max-height: 300px;
  overflow-y: auto;
}

.menu-header {
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  border-bottom: 1px solid var(--border-color);
}

.character-switch-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.character-switch-item:hover {
  background-color: var(--primary-color-light);
}

.character-avatar.small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 8px;
}

.character-avatar.small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 颜色选择菜单样式 */
.color-select-menu {
  position: fixed;
  z-index: 10000;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  min-width: 150px;
  padding: 8px;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 8px;
}

.color-item {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s;
  border: 1px solid var(--border-color);
}

.color-item:hover {
  transform: scale(1.1);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
}

/* 技能编辑覆盖层样式 */
.skill-edit-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #333;
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid #444;
}

.skill-edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #444;
  background-color: #3a3a3a;
}

.skill-edit-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #f0f0f0;
}

.skill-edit-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.right-panel {
  position: relative;
  width: 100%;
  background-color: #333;
  border-left: 1px solid #444;
  overflow-y: auto;
  height: 100%;
}

.right-panel-content {
  padding: 16px;
}

.character-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.character-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: #ffd700;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.1);
}

.character-item .character-avatar {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 8px;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.character-item .character-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-item .character-info {
  text-align: center;
}

.character-item .character-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.character-item .character-element {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

/* 奇波选择对话框 */
.chip-selector-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chip-selector-dialog .chip-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.chip-selector-dialog .chip-item {
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.chip-selector-dialog .chip-icon {
  margin-bottom: 8px;
}

/* 装备选择对话框 */
.equipment-selector-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.equipment-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.equipment-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.equipment-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: #52c41a;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(82, 196, 26, 0.1);
}

.equipment-icon {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
  background-color: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.equipment-icon img {
  width: 80%;
  height: 80%;
  object-fit: contain;
}

.equipment-info {
  text-align: center;
}

.equipment-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.equipment-category {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 4px;
}

.equipment-effect {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 对话框底部按钮 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
}

:deep(.el-button) {
  border-radius: 4px;
  font-size: 14px;
  padding: 6px 12px;
}

:deep(.el-button--primary) {
  background-color: #ffd700;
  border-color: #ffd700;
  color: #222;
}

:deep(.el-button--primary:hover) {
  background-color: #ffed4e;
  border-color: #ffed4e;
  color: #222;
}

:deep(.el-button--default) {
  background-color: transparent;
  border-color: #666;
  color: #ccc;
}

:deep(.el-button--default:hover) {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: #888;
  color: #fff;
}

/* 中间时间轴 */
.main-panel {
  background-color: #282828;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
  border-right: 1px solid #444;
}

/* 播放控制条 */
.timeline-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #3a3a3a;
  border-bottom: 1px solid #444;
}

.control-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.time-unit-control {
  display: flex;
  align-items: center;
}

/* 时间轴容器 */
.timeline-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 时间轴网格布局 */
.timeline-grid-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  grid-template-rows: auto 1fr;
  height: 100%;
}

/* 左侧角色信息栏 */
.tracks-sidebar {
  grid-column: 1 / 2;
  grid-row: 1 / 3;
  background: #3a3a3a;
  display: flex;
  flex-direction: column;
  z-index: 6;
  border-right: 1px solid #444;
  overflow-y: auto;
}

.sidebar-header {
  height: 31px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #444;
  background: #333;
}

.header-text {
  font-size: 14px;
  font-weight: 600;
  color: #f0f0f0;
}

.sidebar-tracks {
  flex: 1;
  overflow-y: auto;
}

.sidebar-track {
  border-bottom: 1px solid #444;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;
  height: 200px;
  box-sizing: border-box;
}

.sidebar-track:hover {
  background-color: #444;
}

.sidebar-track.is-selected {
  background-color: #4a4a4a;
  border-left: 3px solid #ffd700;
}

/* 右侧时间轴内容 */
.timeline-content {
  grid-column: 2 / 3;
  grid-row: 1 / 3;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

/* 时间刻度 */
.timeline-header {
  height: 40px;
  border-bottom: 1px solid #444;
  position: sticky;
  top: 0;
  background-color: #333;
  cursor: pointer;
  z-index: 5;
}

.time-scale {
  position: relative;
  height: 100%;
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
  background-color: #555;
}

.tick-label {
  font-size: 12px;
  color: #aaa;
  margin-top: 4px;
}

.keyframes {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

/* 轨道区域 */
.timeline-tracks {
  position: relative;
  flex: 1;
}

.track {
  border-bottom: 1px solid #444;
  transition: all 0.2s;
}

.track-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: grab;
  transition: all 0.2s;
}

.track-info:hover {
  opacity: 0.9;
}

.track-info:active {
  cursor: grabbing;
}

.character-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #282828;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.character-avatar:hover {
  border-color: #ffd700;
  transform: scale(1.05);
}

.character-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-name {
  font-size: 14px;
  font-weight: 500;
  color: #f0f0f0;
  flex-shrink: 0;
}

.track-order-controls {
  display: flex;
  gap: 4px;
  margin-left: 12px;
}

.track-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.equipment-slots {
  display: flex;
  gap: 8px;
}

.slot {
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #555;
  background-color: #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 40px;
  overflow: hidden;
}

.slot:hover {
  border-color: #ffd700;
  background-color: #3a3a3a;
}

.slot-label {
  font-size: 12px;
  color: #f0f0f0;
}

.slot-image {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 4px;
}

.chip-slot {
  border-color: #00e5ff;
}

.chip-slot:hover {
  border-color: #00e5ff;
  box-shadow: 0 0 8px rgba(0, 229, 255, 0.2);
}

.equipment-slot {
  border-color: #52c41a;
}

.equipment-slot:hover {
  border-color: #52c41a;
  box-shadow: 0 0 8px rgba(82, 196, 26, 0.2);
}

.sub-tracks {
  background-color: #282828;
}

.sub-tracks.hidden {
  display: none;
}

.sub-track {
  border-bottom: 1px solid #444;
}

.sub-track-header {
  padding: 20px 16px;
  font-size: 12px;
  color: #aaa;
  background-color: #333;
  border-bottom: 1px solid #444;
  height: 59px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
}

.sub-track-content {
  position: relative;
  height: 40px;
  padding: 4px 0;
  border-left: 1px solid #444;
}

/* 装备详情 */
.equipment-details {
  background-color: #333;
  border-radius: 4px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  margin-bottom: 16px;
  border: 1px solid #444;
}

.equipment-details .detail-item {
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.equipment-details .detail-label {
  font-weight: 500;
  color: #aaa;
}

.equipment-details .detail-value {
  color: #f0f0f0;
  font-weight: 400;
}

/* Boss时间轴 */
.boss-timeline {
  height: 100px;
  border-top: 1px solid #444;
  border-bottom: 1px solid #444;
  overflow: hidden;
  background-color: #333;
}

/* 资源监控面板 */
.resource-monitor {
  height: 150px;
  border-top: 1px solid #444;
  overflow: hidden;
  background-color: #333;
}

/* 右侧面板 */
.right-panel {
  background-color: #333;
  overflow: hidden;
  z-index: 10;
  padding: 16px;
  overflow-y: auto;
}

.panel-section {
  margin-bottom: 20px;
  padding: 16px;
  background-color: #282828;
  border-radius: 6px;
  border: 1px solid #444;
}

.panel-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #f0f0f0;
  margin: 0 0 12px 0;
}

.project-info, .damage-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item, .stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.info-label, .stat-label {
  color: #aaa;
}

.info-value, .stat-value {
  color: #f0f0f0;
  font-weight: 500;
}

.chart-container {
  margin-top: 12px;
}

/* 技能块 */
.skill-block {
  position: absolute;
  top: 4px;
  height: 32px;
  background-color: rgba(64, 158, 255, 0.2);
  border: 1px solid #409EFF;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.skill-block:hover {
  background-color: rgba(64, 158, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.4);
}

.skill-block.selected {
  border: 2px solid #409EFF;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.3);
}

.skill-block-content {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  height: 100%;
}

.skill-block-icon {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  background-color: #409EFF;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
}

/* 底部缩放控制 */
.timeline-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #333;
  border-top: 1px solid #444;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.snap-control {
  display: flex;
  align-items: center;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .editor-content {
    grid-template-columns: 180px 1fr 220px;
  }
}

@media (max-width: 992px) {
  .editor-content {
    grid-template-columns: 160px 1fr 200px;
  }
  
  .header-left h1 {
    font-size: 18px;
  }
}

@media (max-width: 768px) {
  .editor-content {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  
  .left-panel,
  .right-panel {
    height: 200px;
    border-right: none;
    border-bottom: 1px solid #444;
  }
  
  .header-left h1 {
    font-size: 16px;
  }
  
  .timeline-controls {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .control-buttons,
  .time-info {
    justify-content: center;
  }
}
</style>
