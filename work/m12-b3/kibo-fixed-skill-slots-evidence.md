# Kibo 固定技能槽位语义证据盘点（E15 起点）

2026-08-05，为关闭 25 条 `fixed-skill-slot-semantics-not-yet-evidence-closed` 做的首轮证据盘点。

## 现状

- `reports/kibo-headless/kibo-mechanics-census.json`：`fixedSkillClassification` = 147 evidence-closed / 25 unresolved（全部同一原因）。
- 已闭合槽位：205（PetUltraBlink，战斗支持）、401-403（跳位）、501/502/504/507/508（非战斗）。
- 未闭合槽位（按出现次数）：505 ×9、506 ×9、50206 ×4、602 ×1、603 ×2（按 unique skill 计数；按 occurrence 505/506/602 几乎是全量）。

## 数据侧发现（pet.json fixedSkillList）

- 505/506 几乎每只奇波成对出现：`505#7002xx` + `506#7003xx`（700201-700209 / 700301-700309）。
- 602 几乎全量：`602#500101`；603 只在部分奇波：`603#5102046/5102048`。
- 50206 仅 4 只：500007（50000716）、500024（50002414）、500025（50002516）、500043（50004301），疑似异常槽位或复合值。

## 二进制侧发现（dump.cs）

- `ESkillSlotType`（TypeDefIndex 6322，约 245009 行）：有 205 PetUltraBlink、401-403、501 PetPuzzleSkill、502 PetPuzzleBlink、504 PetCommunicate、601 PetJointStrikeSkill、701/702 KiBoVersusCommonSkill1/2；**没有 505/506/602/603/50206**。
- `EPetSkillSlotType`（TypeDefIndex 9943，405775 行）：0-5 是 UI 槽（signature/skill/fProperty/rProperty/break/fixed），不是数值槽。
- `SystemConst.systemEnum`：petDecoration=505、petRelease=506、moneyShopYellow=602、moneyShopGreen=603（疑似同值但不确定是否同一语义空间）。
- `ESkillType`：KiBoVersusCommonSkill1=701、KiBoVersusCommonSkill2=702（与 ESkillSlotType 一致，未覆盖 602/603）。

## 本地化侧发现

- skill.json 的 name 是哈希；`lang_skill.json` 中 7002xx/7003xx/500101/510204x/50000716 等 name 哈希对应 value 为空；`lang_skill_level` 同样缺失。CHS 快照不足以命名这些槽位技能。

## 下一步（E15 执行）

1. 反汇编 GameAssembly 中 fixedSkillList 的解析/消费方（`PetSkillSlot`、`GetFixedSkillList`、`EnterKiBoVersusCommonSkill` 附近调用链），确认 505/506/602/603 数值槽的枚举来源与语义。
2. 或换 JP/EN/KR 语言快照定位 7002xx/7003xx 技能名（可能补齐语义）。
3. 对 50206 做单条异常核对（pet.json 原文、是否 typo）。
4. 语义确定后在 `generate-kibo-headless-census.mjs` 的 `createFixedSkillRows` 登记槽位分类并补证据 sourceIdentity，25 条转 evidence-closed。
