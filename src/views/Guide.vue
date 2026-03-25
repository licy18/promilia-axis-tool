<template>
  <div class="guide">
    <div class="guide-header">
      <h1>{{ $t('guide.title') }}</h1>
    </div>

    <div class="guide-content">
      <div class="guide-sidebar">
        <el-menu
          :default-active="activeSection"
          class="guide-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="basic">
            <span>{{ $t('guide.basicGuide') }}</span>
          </el-menu-item>
          <el-menu-item index="advanced">
            <span>{{ $t('guide.advancedGuide') }}</span>
          </el-menu-item>
          <el-menu-item index="faq">
            <span>{{ $t('guide.faq') }}</span>
          </el-menu-item>
          <el-menu-item index="tips">
            <span>{{ $t('guide.tips') }}</span>
          </el-menu-item>
          <el-menu-item index="keyboard">
            <span>{{ $t('guide.keyboardShortcuts') }}</span>
          </el-menu-item>
        </el-menu>
      </div>

      <div class="guide-main">
        <div v-if="activeSection === 'basic'">
          <h2>{{ $t('guide.basicGuide') }}</h2>
          <div class="guide-section">
            <h3>1. {{ $t('guide.interfaceOverview') }}</h3>
            <p>{{ $t('guide.interfaceOverviewDesc') }}</p>
            <ul>
              <li>
                {{ $t('guide.skillLibrary') }} -
                {{ $t('guide.skillLibraryDesc') }}
              </li>
              <li>
                {{ $t('guide.timeline') }} - {{ $t('guide.timelineDesc') }}
              </li>
              <li>
                {{ $t('guide.controlPanel') }} -
                {{ $t('guide.controlPanelDesc') }}
              </li>
            </ul>
          </div>

          <div class="guide-section">
            <h3>2. {{ $t('guide.addSkill') }}</h3>
            <p>{{ $t('guide.addSkillDesc') }}</p>
            <ol>
              <li>{{ $t('guide.addSkillStep1') }}</li>
              <li>{{ $t('guide.addSkillStep2') }}</li>
              <li>{{ $t('guide.addSkillStep3') }}</li>
            </ol>
          </div>

          <div class="guide-section">
            <h3>3. {{ $t('guide.adjustSkill') }}</h3>
            <p>{{ $t('guide.adjustSkillDesc') }}</p>
            <ul>
              <li>{{ $t('guide.dragSkill') }}</li>
              <li>{{ $t('guide.resizeSkill') }}</li>
              <li>{{ $t('guide.editSkill') }}</li>
            </ul>
          </div>

          <div class="guide-section">
            <h3>4. {{ $t('guide.playback') }}</h3>
            <p>{{ $t('guide.playbackDesc') }}</p>
          </div>
        </div>

        <div v-else-if="activeSection === 'advanced'">
          <h2>{{ $t('guide.advancedGuide') }}</h2>
          <div class="guide-section">
            <h3>1. {{ $t('guide.skillLinking') }}</h3>
            <p>{{ $t('guide.skillLinkingDesc') }}</p>
          </div>

          <div class="guide-section">
            <h3>2. {{ $t('guide.optimization') }}</h3>
            <p>{{ $t('guide.optimizationDesc') }}</p>
            <ul>
              <li>{{ $t('guide.optimizationTip1') }}</li>
              <li>{{ $t('guide.optimizationTip2') }}</li>
              <li>{{ $t('guide.optimizationTip3') }}</li>
            </ul>
          </div>

          <div class="guide-section">
            <h3>3. {{ $t('guide.advancedFeatures') }}</h3>
            <p>{{ $t('guide.advancedFeaturesDesc') }}</p>
          </div>
        </div>

        <div v-else-if="activeSection === 'faq'">
          <h2>{{ $t('guide.faq') }}</h2>
          <el-collapse>
            <el-collapse-item :title="$t('guide.faqQ1')">
              <div>{{ $t('guide.faqA1') }}</div>
            </el-collapse-item>
            <el-collapse-item :title="$t('guide.faqQ2')">
              <div>{{ $t('guide.faqA2') }}</div>
            </el-collapse-item>
            <el-collapse-item :title="$t('guide.faqQ3')">
              <div>{{ $t('guide.faqA3') }}</div>
            </el-collapse-item>
            <el-collapse-item :title="$t('guide.faqQ4')">
              <div>{{ $t('guide.faqA4') }}</div>
            </el-collapse-item>
            <el-collapse-item :title="$t('guide.faqQ5')">
              <div>{{ $t('guide.faqA5') }}</div>
            </el-collapse-item>
          </el-collapse>
        </div>

        <div v-else-if="activeSection === 'tips'">
          <h2>{{ $t('guide.tips') }}</h2>
          <div class="guide-section">
            <h3>{{ $t('guide.efficientOperation') }}</h3>
            <ul>
              <li>{{ $t('guide.tip1') }}</li>
              <li>{{ $t('guide.tip2') }}</li>
              <li>{{ $t('guide.tip3') }}</li>
              <li>{{ $t('guide.tip4') }}</li>
            </ul>
          </div>

          <div class="guide-section">
            <h3>{{ $t('guide.bestPractices') }}</h3>
            <ul>
              <li>{{ $t('guide.practice1') }}</li>
              <li>{{ $t('guide.practice2') }}</li>
              <li>{{ $t('guide.practice3') }}</li>
            </ul>
          </div>
        </div>

        <div v-else-if="activeSection === 'keyboard'">
          <h2>{{ $t('guide.keyboardShortcuts') }}</h2>
          <el-table :data="shortcuts" style="width: 100%">
            <el-table-column prop="action" :label="$t('guide.action')" />
            <el-table-column prop="key" :label="$t('guide.shortcut')" />
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const activeSection = ref('basic');

const handleMenuSelect = key => {
  activeSection.value = key;
};

const shortcuts = ref([
  { action: '撤销', key: 'Ctrl+Z' },
  { action: '重做', key: 'Ctrl+Y' },
  { action: '复制', key: 'Ctrl+C' },
  { action: '粘贴', key: 'Ctrl+V' },
  { action: '删除', key: 'Delete' },
  { action: '播放/暂停', key: 'Space' },
  { action: '停止', key: 'Esc' },
  { action: '保存', key: 'Ctrl+S' },
]);
</script>

<style scoped>
.guide {
  min-height: 100vh;
  padding: 20px;
}

.guide-header {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.guide-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color);
}

.guide-content {
  display: flex;
  gap: 30px;
}

.guide-sidebar {
  flex: 0 0 250px;
}

.guide-menu {
  background-color: var(--bg-color-light);
  border-radius: 8px;
  box-shadow: var(--box-shadow);
}

.guide-main {
  flex: 1;
  background-color: var(--bg-color-light);
  border-radius: 8px;
  padding: 30px;
  box-shadow: var(--box-shadow);
}

.guide-main h2 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-color);
}

.guide-section {
  margin-bottom: 30px;
  padding: 20px;
  background-color: var(--bg-color);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.guide-section h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 15px;
  color: var(--text-color);
}

.guide-section p {
  margin-bottom: 15px;
  line-height: 1.6;
  color: var(--text-color-secondary);
}

.guide-section ul,
.guide-section ol {
  margin-left: 20px;
  margin-bottom: 15px;
}

.guide-section li {
  margin-bottom: 8px;
  color: var(--text-color-secondary);
}

.guide-section ol li {
  list-style-type: decimal;
}

.guide-section ul li {
  list-style-type: disc;
}

@media (max-width: 768px) {
  .guide-content {
    flex-direction: column;
  }

  .guide-sidebar {
    flex: 1;
  }

  .guide-menu {
    display: flex;
    overflow-x: auto;
    white-space: nowrap;
  }

  .guide-menu .el-menu-item {
    flex: 0 0 auto;
  }
}
</style>
