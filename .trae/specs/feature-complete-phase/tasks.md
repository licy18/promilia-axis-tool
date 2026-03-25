# 蓝色星原战斗排轴编辑器 - 第三阶段（功能完善期）实现计划

## [ ] 任务 1: 完整伤害计算引擎升级
- **优先级**: P0
- **Depends On**: None
- **Description**: 
  - 基于现有 `src/utils/damageCalc.js` 文件，补全游戏全乘区伤害公式
  - 实现印记体系、韧性破防、DOT持续伤害、技能快照、buff联动、元素共鸣等核心机制
  - 支持「伤害期望」「满暴击极限伤害」「不暴击最低伤害」三种计算模式
  - 实现单技能伤害明细计算和排轴全周期伤害的逐帧计算
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 伤害计算与实机误差≤2%
  - `programmatic` TR-1.2: 支持三种计算模式切换
  - `programmatic` TR-1.3: 单技能伤害明细计算准确
  - `programmatic` TR-1.4: 排轴全周期伤害逐帧计算准确
- **Notes**: 参考游戏官方伤害公式，确保计算顺序与游戏一致

## [ ] 任务 2: 循环合法性自动校验系统
- **优先级**: P0
- **Depends On**: 任务 1
- **Description**: 
  - 开发 `src/utils/validate.js` 中的循环合法性校验功能
  - 实现CD冲突、资源合法性、技能依赖、动作合法性的全维度校验
  - 创建 `src/components/editor/ValidatePanel.vue` 组件，实时展示校验结果
  - 支持点击问题项一键跳转到时间轴对应位置
  - 支持生成完整的校验报告
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: 校验准确率≥99%
  - `programmatic` TR-2.2: 实时校验响应时间≤100ms
  - `human-judgment` TR-2.3: 校验结果展示清晰，问题定位准确
- **Notes**: 校验规则支持通过gamedata.json配置，适配不同角色的专属机制

## [ ] 任务 3: 技能连携与依赖可视化
- **优先级**: P0
- **Depends On**: 任务 2
- **Description**: 
  - 创建 `src/components/timeline/LinkLine.vue` 组件
  - 基于SVG动态绘制贝塞尔曲线，展示技能连携依赖关系
  - 实现曲线颜色区分「正常满足」「不满足」两种状态
  - 支持鼠标悬浮显示依赖详情，点击曲线选中两端的技能块
  - 支持用户手动给两个技能块添加/删除依赖关系
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment` TR-3.1: 曲线绘制流畅，视觉效果清晰
  - `human-judgment` TR-3.2: 依赖关系展示准确
  - `programmatic` TR-3.3: 曲线状态实时更新
- **Notes**: 自动识别技能配置中的固有连携关系

## [ ] 任务 4: 轨道与时间轴可视化升级
- **优先级**: P0
- **Depends On**: 任务 3
- **Description**: 
  - 每条角色主轨道拆分为3条子轨道：技能释放轨道、buff生效轨道、资源变化轨道
  - 实现buff生效轨道，用不同颜色的色块直观展示每个buff/debuff的生效区间、叠加层数
  - 优化时间刻度，支持帧/秒双单位切换，缩放时自动适配刻度密度
  - 标记关键时间点（如破韧窗口、Boss机制触发点）
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment` TR-4.1: 轨道布局清晰，信息层次分明
  - `human-judgment` TR-4.2: buff生效区间展示直观
  - `human-judgment` TR-4.3: 时间刻度清晰易读
- **Notes**: 支持轨道折叠/展开功能

## [ ] 任务 5: 资源变化曲线可视化
- **优先级**: P0
- **Depends On**: 任务 4
- **Description**: 
  - 创建 `src/components/timeline/ResourceCurve.vue` 组件
  - 在时间轴底部绘制实时资源变化曲线，包含星决能量、核心印记层数两条主曲线
  - 支持切换显示角色专属资源曲线
  - 实现鼠标悬浮曲线时，显示对应时间点的资源数值、变化原因
  - 实现点击跳转到对应时间点
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `human-judgment` TR-5.1: 曲线绘制流畅，视觉效果清晰
  - `human-judgment` TR-5.2: 资源变化趋势展示准确
  - `programmatic` TR-5.3: 曲线数据与时间轴实时联动
- **Notes**: 曲线颜色与角色元素色对应，峰值/谷值自动标记

## [ ] 任务 6: 数据统计与可视化分析
- **优先级**: P0
- **Depends On**: 任务 1
- **Description**: 
  - 完善 `src/components/editor/StatPanel.vue` 组件
  - 实现核心汇总指标、循环质量指标、伤害明细指标的计算
  - 基于ECharts实现伤害占比饼图、DPS时间曲线、资源变化趋势图、伤害构成柱状图
  - 支持图表的缩放、悬浮查看详情、一键导出高清图片
  - 支持一键生成统计报告，可复制为Markdown格式
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `human-judgment` TR-6.1: 图表展示清晰，信息丰富
  - `programmatic` TR-6.2: 统计数据计算准确
  - `programmatic` TR-6.3: 图表渲染时间≤500ms
- **Notes**: 图表数据与时间轴实时联动，修改技能块后自动重新计算更新

## [ ] 任务 7: 内置游戏数据编辑器
- **优先级**: P0
- **Depends On**: None
- **Description**: 
  - 完善 `src/views/DataEditor.vue` 页面
  - 提供可视化数据管理面板，分为角色、技能、奇波、敌人、buff五大管理模块
  - 支持新增/修改/删除角色、技能、敌人数据
  - 支持一键生成并下载gamedata.json文件
  - 支持数据合法性校验和数据版本管理
  - 支持导入外部的gamedata.json文件
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `human-judgment` TR-7.1: 编辑界面友好，操作流畅
  - `programmatic` TR-7.2: 数据合法性校验准确
  - `programmatic` TR-7.3: 生成的gamedata.json文件格式正确
- **Notes**: 编辑器页面通过固定路由`/editor`访问

## [ ] 任务 8: 项目导入导出与社区分享体系
- **优先级**: P0
- **Depends On**: 任务 6
- **Description**: 
  - 优化项目导出格式，统一为`.promilia`
  - 支持高清图片、Markdown报告、JSON源文件的多格式导出
  - 支持生成排轴项目的分享短链
  - 完善 `src/views/Preset.vue` 页面，分类展示热门配队排轴模板
  - 支持按角色、配队类型、Boss、难度筛选预设轴
  - 支持用户提交自己的排轴项目到预设轴库
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-8.1: 多格式导出功能正常
  - `programmatic` TR-8.2: 分享链接生成与访问正常
  - `human-judgment` TR-8.3: 预设轴库界面友好，筛选功能正常
- **Notes**: 分享链接需要后端支持，可先实现前端功能，预留后端接口

## [ ] 任务 9: 编辑器核心能力补全
- **优先级**: P0
- **Depends On**: 任务 3
- **Description**: 
  - 基于Pinia实现完整的操作历史记录，支持Ctrl+Z撤销、Ctrl+Y重做
  - 支持在时间轴上添加关键帧标记，自定义标记名称、颜色、备注
  - 支持技能块拆分、合并、镜像复制、批量对齐
  - 支持循环播放预览，设置循环区间、循环次数
  - 完善编辑器全操作快捷键体系，支持快捷键自定义
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `human-judgment` TR-9.1: 撤销/重做功能正常，响应及时
  - `human-judgment` TR-9.2: 关键帧标记功能易用
  - `human-judgment` TR-9.3: 技能块操作流畅
  - `human-judgment` TR-9.4: 循环播放预览功能正常
- **Notes**: 最大历史记录步数50步

## [x] 任务 10: 全局设置与体验优化
- **优先级**: P0
- **Depends On**: None
- **Description**: 
  - 完善 `src/views/Setting.vue` 页面，支持编辑器设置、显示设置、播放设置、快捷键设置、数据备份与恢复
  - 优化深色/浅色主题，所有组件适配主题切换
  - 实现新手分步引导，首次进入编辑器时引导用户完成核心操作
  - 完善 `src/views/Guide.vue` 页面，包含基础入门、进阶技巧、常见问题等内容
  - 实现全局异常捕获与错误提示
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `human-judgment` TR-10.1: 设置页面功能完整，操作友好
  - `human-judgment` TR-10.2: 主题切换效果良好
  - `human-judgment` TR-10.3: 新手引导流程清晰
  - `programmatic` TR-10.4: 全局异常捕获有效
- **Notes**: 主题配置持久化到本地

## [x] 任务 11: 游戏数据补全
- **优先级**: P0
- **Depends On**: 任务 7
- **Description**: 
  - 完成8个以上核心角色的完整数据录入，包括基础属性、技能参数、命座效果等
  - 完成4个以上高难Boss的完整机制与数值录入，包括抗性、韧性阈值、机制阶段等
  - 覆盖游戏主流配队体系，确保数据的完整性和准确性
- **Acceptance Criteria Addressed**: AC-9
- **Test Requirements**:
  - `programmatic` TR-11.1: 角色数据完整，覆盖8个以上核心角色
  - `programmatic` TR-11.2: Boss数据完整，覆盖4个以上高难Boss
  - `programmatic` TR-11.3: 数据格式正确，与游戏实机一致
- **Notes**: 参考游戏官方数据，确保数据的准确性