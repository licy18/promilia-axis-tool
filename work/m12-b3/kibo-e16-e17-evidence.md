# Kibo E16 剩余被动语义 + E17 动作闭合可行性（2026-08-05）

## E16 剩余资格被动（3 条）精确语义（元素资产已确认）

### 520007 雷躯（500082）
- 触发：AfterReceiveDamage（事件 4），ICD 15000ms，effect targetType 1（Target=受击对象）。
- 效果叶 520007002：`describe=雷伤害`，`baseIntParams [1,4]`，`functionParams [7500,...,10000]`，无 attributeID → **派生伤害元素**（函数 4：`source.ATK*A/10000`，A=7500 → 75% ATK 雷属性反击伤害）。
- 建模方向：`after-kibo-receive-damage-retaliation-damage-effect`；运行时受击通道（E16 已建）下发派生伤害命令；需确认 Target 指向攻击者。

### 520059 火力中心/华丽姿态（500185）
- 触发：SwitchEnter（事件 34，切入），ICD 25000ms，effect targets [0,20]。
- Self 分支：效果封装 520059002（5s）注入 520059003 DEF+27% / 520059004 MDEF+27%。
- AllEnemy 分支：520059005 `describe=嘲讽5s`（`functionParams [5000,...]`，`baseIntParams [1,5]`）→ 5s 嘲讽。
- 520059000/520059006（华丽姿态 ATK-20%）为辅助元素，不在触发可达图内。
- 建模方向：`equipped-kibo-switch-enter-self-property-and-taunt-effect`；运行时需新增 switch-enter 场景起始事件 + taunt 状态；taunt 当前运行时未建模。

### 520092 生命虹吸（500360）
- 触发：AfterDamage（事件 2），effect targets [1→触发链,0→自身]，无 ICD，`triggerCounter` 默认。
- 链：520092001(AfterDamage) → 520092002/520092004(BeforeDamage type0) → 叶 520092003 / 520092005。
- 520092003 `describe=敌人受到伤害`，damageType 7（Dot），`functionParams [2000,...]`，函数 4 → **20% ATK Dot 伤害**。
- 520092005 `describe=自身受到治疗`，damageType 5（Heal），`functionParams [200,...]`，函数 4 → **2% ATK 自疗**。
- 建模方向：`on-kibo-damage-derived-dot-and-self-heal-effect`，可复用 520041 派生伤害公式（base 4，`source.ATK*A/10000`）+ 受击/治疗命令。

## E17 动作闭合可行性（重要更新）

此前误判 SkillList 为 stub：实际上**控制目录只有部分 MonoBehaviour 是 stub**，真实数据大量存在：
- `skill_control_504004.asset`（500001 主动技）：289 个文件，145 个非 stub。
- `skill_control_50000102.asset`：50 文件，26 非 stub；`skill_control_502015.asset`：49 文件，25 非 stub。
- 真实 MonoBehaviour 含 `startFrame / frameCount / effectStartFrame / frameIndex / timelineGroupIndex / aniStartFrame / aniEndFrame` 等触发帧字段。

因此 `trigger-frame-missing`（43 条主因）可尝试在 `generate-kibo-headless-census.mjs` 增加**动作触发帧证据层**：对 scenario-assumed 公开动作读取对应 skill_control 真实文件，把 `effectStartFrame/startFrame` 解析为触发帧并置 `closureClass=evidence-closed`（带 provenance），不必重跑 drift 敏感的 `sync-verified-combat-mechanics.mjs`。

`projectile-impact-frame-runtime-dependent` 仍依赖弹道/距离参数（Element/bullet 资产），第二批处理。

`battle-element-assets.jsonl` 未在 `il2cpp-tc-catch-20260709/outputs` 找到，需定位实际路径后再决定是否复用（灵魂 E 系列使用过该文件）。

## 下一步建议
- E16-续：先做 520092（复用派生伤害公式，收益 1 条资格缺口），再 520007（受击反击，需要事件目标语义确认），最后 520059（需新增 taunt 状态）。
- E17：先做触发帧证据层关闭 53 条 scenario-assumed 中可闭合部分，再处理 181 unresolved。
