# M6 关闭证据：10900101 sub1（晶石普攻形态）为客户端未接线

日期：2026-08-08

## 结论

10900101 sub1（playerSkillId 109001011，动画 `Skill0_6`，230F）登记为「客户端未接线中间状态」，不建模为产品行为（与 M8/M10/M11/M15/M16/M23 同口径）。文本描述的「璀璨下普攻变体」为 A4 超限（M5）与 A5 印记（M4），均已接入。

## 结构

- `skill_control_10900101.asset#skillPlayers[1]`：skillId 109001011，frameCountDict 0:230，动画 Skill0_6。
- skillResourceMaps[1] 直连 4 个元素：109001251（极限反击hit1~3）、109001252（技能1冻结）、109001253（技能E追击_震屏）、109001270（晶石buff）。
- 行为轨：0F 注入 109001270 璀璨（behavior -2707435386338606155，frameCount=1，directInjectTargetType=0）；13/16/19F 各一次 109001251 命中；两条 元素 轨为滞空/移动行为（battlePropertyType=113），非元素注入。

## 无选择条件

- `skillsub_logic[10900101]`：无 subskill selector 字段，仅 1 行（普通攻击）。
- public skill slots / labels：仅「普攻」一个 label，无 distinct public input variant。
- battle-switch relations：0 边。
- resource-state judgment：0 边。
- input-hold-chain：sub0 有 3 条事件桥（target 80102/10900102），sub1 有 2 条事件桥但 targetControlSkillIds=[]（无输出，终态）。

## 无外部引用

- 全部 `skill_control_109001*` 资产按 `skillId=10900101(1)` / playerSkillId 检索：仅 10900101 自身引用 109001011。
- 无任何控制/行为以「10900101 + skillIndex=1」为桥接目标；极限反击 10900125、追击 10900143 的连击桥接均为 allowAttack=1 + skillId=0（回落默认攻击输入）。

## 文本与等级证据

- 10900101 文案只描述「璀璨下第四段命中可消耗1雷超限、第五段命中获得2雷印记」，未描述任何 A1 晶石变体。
- 109001251 的 `skillsub_ele_value` 主技能为 10900125（极限反击，12 级行），即 sub1 命中的数值随极限反击等级，而非普攻链。
- 晶石攻击元素族（109001122/123/124/318/325）在全部 109001 控制资源图（含 skillResourceMaps 与行为文件）中 0 引用。

## 管线现状

- profile 中 sub1 的 variantConditionDiscovery：`variant-condition-not-yet-modeled`，五个来源族全部 checked（无选择器）。
- m10 ledger 仅 1 条 sub1 相关记录（`effect:10900101|1|...|8949110464361487189|...` 璀璨注入，static-evidence-gap）。
- 该记录不进验收阻断账本；109001 保持 runtime-integrated（4/4），功能阻断与资格缺口不受影响。
