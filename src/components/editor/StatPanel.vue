<template>
  <div class="stat-panel">
    <div class="panel-header">
      <h3>数据统计与分析</h3>
      <div class="header-actions">
        <el-button size="small" @click="exportReport">导出报告</el-button>
        <el-button size="small" @click="exportImages">导出图片</el-button>
      </div>
    </div>

    <!-- 核心汇总指标 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">排轴总时长</div>
        <div class="stat-value">{{ formatTime(project.duration) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总伤害</div>
        <div class="stat-value">{{ totalDamage.toLocaleString() }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">平均DPS</div>
        <div class="stat-value">{{ dps.toLocaleString() }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">爆发峰值DPS</div>
        <div class="stat-value">{{ peakDps.toLocaleString() }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">爆发窗口时长</div>
        <div class="stat-value">{{ formatTime(burstWindowDuration) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总削韧值</div>
        <div class="stat-value">
          {{ totalToughnessDamage.toLocaleString() }}
        </div>
      </div>
    </div>

    <!-- 循环质量指标 -->
    <div class="quality-section">
      <h4>循环质量指标</h4>
      <div class="quality-grid">
        <div
          class="quality-item"
          v-for="(value, key) in qualityMetrics"
          :key="key"
        >
          <div class="quality-label">{{ getQualityLabel(key) }}</div>
          <div class="quality-value">{{ formatQualityValue(key, value) }}</div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-section">
      <!-- 伤害占比饼图 -->
      <div class="chart-container">
        <h4>伤害占比</h4>
        <div ref="damagePieRef" class="chart"></div>
      </div>

      <!-- DPS时间曲线 -->
      <div class="chart-container">
        <h4>DPS时间曲线</h4>
        <div ref="dpsCurveRef" class="chart"></div>
      </div>

      <!-- 资源变化趋势图 -->
      <div class="chart-container">
        <h4>资源变化趋势</h4>
        <div ref="resourceCurveRef" class="chart"></div>
      </div>

      <!-- 伤害构成柱状图 -->
      <div class="chart-container">
        <h4>伤害构成</h4>
        <div ref="damageBarRef" class="chart"></div>
      </div>
    </div>

    <!-- 伤害明细表格 -->
    <div class="detail-section">
      <h4>伤害明细</h4>
      <el-table :data="damageDetails" style="width: 100%">
        <el-table-column prop="character" label="角色" width="120" />
        <el-table-column prop="skill" label="技能" width="150" />
        <el-table-column prop="damage" label="伤害" width="120" align="right">
          <template #default="scope">
            {{ scope.row.damage.toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column
          prop="percentage"
          label="占比"
          width="100"
          align="right"
        >
          <template #default="scope">
            {{ (scope.row.percentage * 100).toFixed(2) }}%
          </template>
        </el-table-column>
        <el-table-column
          prop="hits"
          label="命中段数"
          width="100"
          align="right"
        />
        <el-table-column
          prop="critRate"
          label="暴击率"
          width="100"
          align="right"
        >
          <template #default="scope">
            {{ (scope.row.critRate * 100).toFixed(2) }}%
          </template>
        </el-table-column>
        <el-table-column prop="avgDamage" label="平均每段伤害" align="right">
          <template #default="scope">
            {{ scope.row.avgDamage.toLocaleString() }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import { ElMessage } from 'element-plus';
import {
  calculateFrameByFrameDamage,
  calculateTimelineDamage,
  calculateSkillDamage,
} from '../../utils/damageCalc.js';

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
  gamedata: {
    type: Object,
    required: true,
  },
});

// 响应式数据
const damagePieRef = ref(null);
const dpsCurveRef = ref(null);
const resourceCurveRef = ref(null);
const damageBarRef = ref(null);

// 图表实例
let damagePieChart = null;
let dpsCurveChart = null;
let resourceCurveChart = null;
let damageBarChart = null;

// 计算属性
const totalDamage = computed(() => {
  const stats = calculateTimelineDamage(props.project, props.gamedata);
  return stats.totalDamage;
});

const dps = computed(() => {
  const stats = calculateTimelineDamage(props.project, props.gamedata);
  return stats.dps;
});

const frameByFrameData = computed(() => {
  return calculateFrameByFrameDamage(props.project, props.gamedata);
});

const peakDps = computed(() => {
  const data = frameByFrameData.value;
  if (data.damageByFrame.length === 0) return 0;

  // 计算每秒DPS
  const dpsData = [];
  for (let i = 0; i < data.damageByFrame.length; i += 60) {
    // 60帧 = 1秒
    const secondDamage = data.damageByFrame
      .slice(i, i + 60)
      .reduce((sum, item) => sum + item.damage, 0);
    dpsData.push(secondDamage);
  }

  return Math.max(...dpsData, 0);
});

const burstWindowDuration = computed(() => {
  // 简单实现：假设爆发窗口为DPS超过平均DPS 1.5倍的时间段
  const avgDps = dps.value;
  const data = frameByFrameData.value;
  let burstFrames = 0;

  data.damageByFrame.forEach(item => {
    const frameDps = item.damage * 60; // 转换为每秒DPS
    if (frameDps > avgDps * 1.5) {
      burstFrames++;
    }
  });

  return burstFrames;
});

const totalToughnessDamage = computed(() => {
  // 计算总削韧值
  let total = 0;
  props.project.skillBlocks.forEach(block => {
    const skill = findSkillById(props.gamedata, block.skillId);
    if (skill && skill.toughnessDamage) {
      total += skill.toughnessDamage;
    }
  });
  return total;
});

const qualityMetrics = computed(() => {
  // 计算循环质量指标
  return {
    buffCoverage: 0.75, // 模拟数据
    cdUtilization: 0.85, // 模拟数据
    resourceOverflow: 0.1, // 模拟数据
    stabilityScore: 0.9, // 模拟数据
  };
});

const damageDetails = computed(() => {
  // 生成伤害明细数据
  const details = [];
  const stats = calculateTimelineDamage(props.project, props.gamedata);

  props.project.skillBlocks.forEach(block => {
    const character = props.gamedata.characters.find(
      c => c.id === block.characterId
    );
    const skill = findSkillById(props.gamedata, block.skillId);

    if (character && skill) {
      // 计算该技能块的伤害
      const skillDamage = calculateSkillDamage(
        character,
        skill,
        props.gamedata.enemies[0]
      );
      const damage = skillDamage.totalDamage;

      details.push({
        character: character.name,
        skill: skill.name,
        damage,
        percentage: damage / stats.totalDamage,
        hits: skill.damageMultiplier
          ? Array.isArray(skill.damageMultiplier)
            ? skill.damageMultiplier.length
            : 1
          : 1,
        critRate: character.stats.criticalRate || 0.05,
        avgDamage:
          damage /
          (skill.damageMultiplier
            ? Array.isArray(skill.damageMultiplier)
              ? skill.damageMultiplier.length
              : 1
            : 1),
      });
    }
  });

  return details;
});

// 方法
const formatTime = frames => {
  const seconds = Math.floor(frames / 60);
  const remainingFrames = frames % 60;
  return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
};

const getQualityLabel = key => {
  const labels = {
    buffCoverage: 'Buff平均覆盖率',
    cdUtilization: '技能CD利用率',
    resourceOverflow: '资源溢出率',
    stabilityScore: '循环稳定性评分',
  };
  return labels[key] || key;
};

const formatQualityValue = (key, value) => {
  return (value * 100).toFixed(2) + '%';
};

const findSkillById = (gamedata, skillId) => {
  for (const character of gamedata.characters) {
    const skill = character.skills.find(s => s.id === skillId);
    if (skill) return skill;
  }
  return null;
};

const initCharts = () => {
  // 初始化伤害占比饼图
  if (damagePieRef.value) {
    damagePieChart = echarts.init(damagePieRef.value);
    updateDamagePieChart();
  }

  // 初始化DPS时间曲线
  if (dpsCurveRef.value) {
    dpsCurveChart = echarts.init(dpsCurveRef.value);
    updateDpsCurveChart();
  }

  // 初始化资源变化趋势图
  if (resourceCurveRef.value) {
    resourceCurveChart = echarts.init(resourceCurveRef.value);
    updateResourceCurveChart();
  }

  // 初始化伤害构成柱状图
  if (damageBarRef.value) {
    damageBarChart = echarts.init(damageBarRef.value);
    updateDamageBarChart();
  }
};

const updateDamagePieChart = () => {
  if (!damagePieChart) return;

  const stats = calculateTimelineDamage(props.project, props.gamedata);
  const data = Object.entries(stats.damageByCharacter).map(
    ([name, damage]) => ({
      name,
      value: damage,
    })
  );

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '伤害占比',
        type: 'pie',
        radius: '50%',
        data,
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

  damagePieChart.setOption(option);
};

const updateDpsCurveChart = () => {
  if (!dpsCurveChart) return;

  const data = frameByFrameData.value;
  const dpsData = [];

  // 计算每秒DPS
  for (let i = 0; i < data.damageByFrame.length; i += 60) {
    const secondDamage = data.damageByFrame
      .slice(i, i + 60)
      .reduce((sum, item) => sum + item.damage, 0);
    const time = i / 60;
    dpsData.push([time, secondDamage]);
  }

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: '时间: {c[0]}s<br/>DPS: {c[1]}',
    },
    xAxis: {
      type: 'value',
      name: '时间 (s)',
    },
    yAxis: {
      type: 'value',
      name: 'DPS',
    },
    series: [
      {
        data: dpsData,
        type: 'line',
        smooth: true,
        lineStyle: {
          width: 2,
        },
        areaStyle: {
          opacity: 0.1,
        },
      },
    ],
  };

  dpsCurveChart.setOption(option);
};

const updateResourceCurveChart = () => {
  if (!resourceCurveChart) return;

  // 模拟资源变化数据
  const duration = props.project.duration;
  const energyData = [];
  const imprintData = [];

  for (let frame = 0; frame <= duration; frame += 60) {
    const time = frame / 60;
    energyData.push([time, Math.sin(time * 0.5) * 30 + 50]);
    imprintData.push([time, Math.floor((Math.sin(time * 0.8) + 1) * 2.5)]);
  }

  const option = {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['星决能量', '核心印记'],
    },
    xAxis: {
      type: 'value',
      name: '时间 (s)',
    },
    yAxis: {
      type: 'value',
      name: '数值',
    },
    series: [
      {
        name: '星决能量',
        data: energyData,
        type: 'line',
        smooth: true,
        lineStyle: {
          color: '#409EFF',
        },
      },
      {
        name: '核心印记',
        data: imprintData,
        type: 'line',
        smooth: true,
        lineStyle: {
          color: '#67C23A',
        },
      },
    ],
  };

  resourceCurveChart.setOption(option);
};

const updateDamageBarChart = () => {
  if (!damageBarChart) return;

  const stats = calculateTimelineDamage(props.project, props.gamedata);
  const characters = Object.keys(stats.damageByCharacter);
  const data = characters.map(name => stats.damageByCharacter[name]);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    xAxis: {
      type: 'category',
      data: characters,
    },
    yAxis: {
      type: 'value',
      name: '伤害',
    },
    series: [
      {
        data,
        type: 'bar',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#83bff6' },
            { offset: 0.5, color: '#188df0' },
            { offset: 1, color: '#188df0' },
          ]),
        },
      },
    ],
  };

  damageBarChart.setOption(option);
};

const exportReport = () => {
  // 生成Markdown报告
  const stats = calculateTimelineDamage(props.project, props.gamedata);
  const report = `# 排轴统计报告

## 核心指标
- 排轴总时长: ${formatTime(props.project.duration)}
- 总伤害: ${stats.totalDamage.toLocaleString()}
- 平均DPS: ${stats.dps.toLocaleString()}
- 爆发峰值DPS: ${peakDps.value.toLocaleString()}
- 爆发窗口时长: ${formatTime(burstWindowDuration.value)}
- 总削韧值: ${totalToughnessDamage.value.toLocaleString()}

## 伤害占比
${Object.entries(stats.damageByCharacter)
  .map(
    ([name, damage]) =>
      `- ${name}: ${damage.toLocaleString()} (${((damage / stats.totalDamage) * 100).toFixed(2)}%)`
  )
  .join('\n')}

## 循环质量
- Buff平均覆盖率: ${(qualityMetrics.value.buffCoverage * 100).toFixed(2)}%
- 技能CD利用率: ${(qualityMetrics.value.cdUtilization * 100).toFixed(2)}%
- 资源溢出率: ${(qualityMetrics.value.resourceOverflow * 100).toFixed(2)}%
- 循环稳定性评分: ${(qualityMetrics.value.stabilityScore * 100).toFixed(2)}%

## 伤害明细
| 角色 | 技能 | 伤害 | 占比 | 命中段数 | 暴击率 | 平均每段伤害 |
|------|------|------|------|----------|--------|--------------|
${damageDetails.value.map(item => `| ${item.character} | ${item.skill} | ${item.damage.toLocaleString()} | ${(item.percentage * 100).toFixed(2)}% | ${item.hits} | ${(item.critRate * 100).toFixed(2)}% | ${item.avgDamage.toLocaleString()} |`).join('\n')}
`;

  // 复制到剪贴板
  navigator.clipboard.writeText(report).then(() => {
    ElMessage.success('报告已复制到剪贴板');
  });
};

const exportImages = () => {
  // 导出图表为图片
  if (damagePieChart) {
    const image = damagePieChart.getDataURL({ type: 'png', pixelRatio: 2 });
    downloadImage(image, '伤害占比.png');
  }

  if (dpsCurveChart) {
    const image = dpsCurveChart.getDataURL({ type: 'png', pixelRatio: 2 });
    downloadImage(image, 'DPS时间曲线.png');
  }

  if (resourceCurveChart) {
    const image = resourceCurveChart.getDataURL({ type: 'png', pixelRatio: 2 });
    downloadImage(image, '资源变化趋势.png');
  }

  if (damageBarChart) {
    const image = damageBarChart.getDataURL({ type: 'png', pixelRatio: 2 });
    downloadImage(image, '伤害构成.png');
  }
};

const downloadImage = (dataUrl, filename) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
};

// 监听项目变化，更新图表
watch(
  () => props.project,
  () => {
    updateDamagePieChart();
    updateDpsCurveChart();
    updateResourceCurveChart();
    updateDamageBarChart();
  },
  { deep: true }
);

// 监听窗口大小变化，调整图表大小
const handleResize = () => {
  damagePieChart?.resize();
  dpsCurveChart?.resize();
  resourceCurveChart?.resize();
  damageBarChart?.resize();
};

onMounted(() => {
  initCharts();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  // 销毁图表实例
  damagePieChart?.dispose();
  dpsCurveChart?.dispose();
  resourceCurveChart?.dispose();
  damageBarChart?.dispose();

  // 移除事件监听器
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.stat-panel {
  padding: 16px;
  background-color: var(--bg-color-light);
  border-radius: 8px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background-color: white;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  text-align: center;
}

.stat-label {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.quality-section {
  margin-bottom: 24px;
}

.quality-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.quality-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.quality-item {
  background-color: white;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  text-align: center;
}

.quality-label {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.quality-value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.chart-container {
  background-color: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.chart-container h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.chart {
  height: 300px;
}

.detail-section {
  background-color: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.detail-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 768px) {
  .charts-section {
    grid-template-columns: 1fr;
  }

  .chart {
    height: 250px;
  }
}
</style>
