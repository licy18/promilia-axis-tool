# 10095 甜点时光 — 19003206 星级数值源缺口（证据固化）

> 结论：`19003206`（调谐强度叶）在全部可用源中无星级数值；10095 保持
> `source-indexed-runtime-unapplied`（evidence-insufficient），不静默补值。

## 结构

- 触发器 `19003202`（AfterGetElement，CheckElementId=750 风调谐印记，triggerInv=100）
  效果列表两项：`19003203`（全队攻击力 attr1，16s）与 `19003206`（调谐强度 attr2，16s）。
- 上游 `19003201`（BeforeGetElement，CheckElementId=199001234）→ 19003202。

## 证据

1. `NewTable/skillsub_ele_value.json`：skillId=1900320 仅有 4 行（level 1-4，
   elementId=19003203，valueParam `1#300|7#10000` / `400` / `500` / `600`）；
   **无任何 elementId=19003206 行**。
2. 全 `NewTable/*.json` 检索 `19003206`：零命中（`rg` exit 1）。
3. `work/combat-formulas/battle-element-assets.jsonl`：19003206 仅作为元素自身出现
   （path_id=7036297722921961000），无数值字段。
4. `NewTable/skill_level.json` skillId=1900320 四行 value 字符串 ID 经
   `ResourcesLang/chs/Table/lang_skill_level.json` 解析为
   **3% / 4% / 5% / 6%**——只对应 19003203 全队攻击力，不含调谐强度。
5. 灵魂文案（`generated/soulessences.json` id=10095）：仅描述
   “提升全队3%攻击力，持续16秒”，未提及调谐强度。
6. 客户端版本核对（2026-08-06 复核）：本机客户端资源包
   `StreamingAssets/.res/default_package/fwtvymrpqatpf4ytyfvwqg` 与
   `GameAssembly.dll` 时间戳为 **2026-06-10**，而
   `C:\PC2\Codex\AzPr\Assets\ResourcesAssets\Config\NewTable\skillsub_ele_value.json`
   快照为 **2026-04-26**——客户端可能晚于现有提取快照。
   若客户端有内容更新，重新提取 NewTable 可能补出 19003206 数值行
   （会改变 FROZEN 源哈希，需按“不静默重定基线”规则由用户决策后执行）。

## 判定

- 19003203 已完整索引（star 1-4 = 300/400/500/600），可编译。
- 19003206 因缺 `skillsub_ele_value` 行而 `effect-star-values-incomplete`；
  双叶路径同时触发 `effect-property-leaf-not-unique`。
- 依据硬边界“不静默补值/不静默扩谱”，不推断 19003206 数值，也不擅自将
  19003206 判为死分支丢弃。

## 收口条件（二选一，需外部输入）

- 新源数据：`skillsub_ele_value`（或等效表）补上 19003206 的 level 1-4 数值；
- 客户端重提取：先确认本机客户端 6/10 资源是否含新表，再决定是否重提取
  （涉及 FROZEN 源哈希重基线，需用户批准）；
- 产品/源确认：19003206 为死分支（如游戏实际不执行该效果），则按单叶 19003203
  编译并记录决策来源。
