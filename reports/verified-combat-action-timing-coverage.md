# M9-A 全动作时长与输入占轴审计

- 包：`azpr-tc-2026-07-18`
- 公开动作：645（来源占轴已确认 634，尚未确认 11；公开动作均按独立 schedulable 合同判断）
- 公开变体：675（来源占轴已确认 633，尚未确认 42）
- 普攻输入段：95（输入占轴已确认 78，尚未确认 17）
- SkillControl/player 变体：1434
- 一帧占轴：0
- 异常长占轴（>600f）：5
- 精确选中变体占轴：707
- 来源动画规划长度：27
- 通用规划长度：1
- control 身份未解析：1
- 变体条件发现：partially-resolved 6 / resolved 2 / static-evidence-gap 4 / variant-condition-not-yet-modeled 204

## Owner / 动作类型 / 来源状态

| Owner | 动作类型 | 占轴来源 | 状态 | 数量 |
| --- | --- | --- | --- | ---: |
| actor | charged-attack | skill-control-player-action-range | applied | 16 |
| actor | charged-attack | verified-specific-input-window | applied | 2 |
| actor | charged-attack | verified-unconditional-attack-reopen-window | applied | 2 |
| actor | dodge-attack | skill-control-player-action-range | applied | 16 |
| actor | dodge-attack | unresolved-action-occupancy | unresolved | 1 |
| actor | dodge-attack | verified-specific-input-window | applied | 1 |
| actor | dodge-attack | verified-unconditional-attack-reopen-window | applied | 2 |
| actor | limit-counter | skill-control-player-action-range | applied | 16 |
| actor | limit-counter | verified-unconditional-attack-reopen-window | applied | 4 |
| actor | normal-attack | normal-attack-input-segment-chain | applied | 12 |
| actor | normal-attack | normal-attack-input-segment-chain | unresolved | 8 |
| actor | perfect-parry | declared-verified-input-reopen-occupancy | applied | 3 |
| actor | perfect-parry | skill-control-player-action-range | applied | 16 |
| actor | perfect-parry | verified-unconditional-attack-reopen-window | applied | 1 |
| actor | plunging-attack | skill-control-player-action-range | applied | 16 |
| actor | plunging-attack | verified-unconditional-attack-reopen-window | applied | 4 |
| actor | star-carry | declared-verified-input-reopen-occupancy | applied | 1 |
| actor | star-carry | skill-control-player-action-range | applied | 13 |
| actor | star-carry | unresolved-action-occupancy | unresolved | 1 |
| actor | star-carry | verified-unconditional-attack-reopen-window | applied | 2 |
| actor | star-combo | skill-control-player-action-range | applied | 16 |
| actor | star-combo | verified-unconditional-attack-reopen-window | applied | 4 |
| actor | star-skill | declared-verified-input-reopen-occupancy | applied | 1 |
| actor | star-skill | skill-control-player-action-range | applied | 16 |
| actor | star-skill | unresolved-action-occupancy | unresolved | 1 |
| actor | star-skill | verified-unconditional-attack-reopen-window | applied | 2 |
| actor | ultimate | skill-control-player-action-range | applied | 16 |
| actor | ultimate | verified-specific-input-window | applied | 1 |
| actor | ultimate | verified-unconditional-attack-reopen-window | applied | 3 |
| kibo | active | skill-control-player-action-range | applied | 82 |
| kibo | break | skill-control-player-action-range | applied | 122 |
| kibo | normal-attack | skill-control-player-action-range | applied | 122 |
| kibo | signature | skill-control-player-action-range | applied | 122 |

## 多变体条件发现

| Owner | 动作类型 | Control | 状态 | 已审计来源 |
| --- | --- | ---: | --- | --- |
| 涂山小玉 | charged-attack | 10101010 | partially-resolved | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 莉莉 | charged-attack | 10200110 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 莉莉 | perfect-parry | 10200127 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 红宝石 | charged-attack | 10300210 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 米砂 | star-skill | 10700212 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 米砂 | dodge-attack | 10700215 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 米砂 | limit-counter | 10700225 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 米砂 | star-combo | 10700226 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 阿比 | star-carry | 10700321 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 忒拉拉 | charged-attack | 10800110 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 璐璐卡 | charged-attack | 10800210 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 米蒂 | charged-attack | 10800310 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 卡塔露 | charged-attack | 10800510 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 法兰塔 | charged-attack | 11100110 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 法兰塔 | ultimate | 11100113 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 姬瑟贝露 | charged-attack | 11200110 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 姬瑟贝露 | limit-counter | 11200125 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 艾妮丝 | charged-attack | 11200210 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 女主角 | charged-attack | 19900110 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 男主角 | charged-attack | 19900210 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 诺诺 | star-carry | 19900321 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 诺诺 | perfect-parry | 19900327 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |
| 库库 | break | 50030404 | variant-condition-not-yet-modeled | skillsub-logic / public-skill-slots-and-labels / battle-switch-relations / resource-state-judgment / input-hold-chain |

> `variant-condition-not-yet-modeled` 表示条件来源已进入发现审计、但尚未形成可执行选择边；它不是“证据证明无法解析”。只有完成来源链审计后，才会区分 `static-evidence-gap` 或 `runtime-dependent`。

## 尚未确认的输入占轴

- `actor|101003|10100322|0|10100322|star-carry`：verified-action-effective-occupancy-window-unresolved
- `actor|101007|10100701|0|10100703|normal-attack`：normal-attack-input-segment-duration-unresolved
- `actor|103002|10300201|0|10300203|normal-attack`：normal-attack-input-segment-duration-unresolved
- `actor|103002|10300201|2|10300215|dodge-attack`：verified-action-effective-occupancy-window-unresolved
- `actor|103002|10300212|0|10300212|star-skill`：verified-action-effective-occupancy-window-unresolved
- `actor|107001|10700101|0|10700103|normal-attack`：normal-attack-input-segment-duration-unresolved
- `actor|107002|10700201|0|10700203|normal-attack`：normal-attack-input-segment-duration-unresolved
- `actor|107003|10700301|0|10700303|normal-attack`：normal-attack-input-segment-duration-unresolved
- `actor|108002|10800201|0|10800203|normal-attack`：normal-attack-input-segment-duration-unresolved
- `actor|109002|10900201|0|10900203|normal-attack`：normal-attack-input-segment-duration-unresolved
- `actor|112002|11200201|0|11200203|normal-attack`：normal-attack-input-segment-duration-unresolved
- `actor|101007|10100701|0|10100701|normal-attack|attack-input-1`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|103002|10300201|0|10300203|normal-attack|attack-input-3`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|103002|10300201|0|10300204|normal-attack|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|107001|10700101|0|10700102|normal-attack|attack-input-2`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|107001|10700101|0|10700103|normal-attack|attack-input-3`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|107001|10700101|0|10700104|normal-attack|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|107001|10700101|0|10700105|normal-attack|attack-input-5`：selected-control-player-variant-duration-unresolved、attack-reopen-event-bridge-window-unavailable
- `actor|107002|10700201|0|10700204|normal-attack|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|107002|10700201|0|10700205|normal-attack|attack-input-5`：skill-control-player-variant-missing
- `actor|107003|10700301|0|10700304|normal-attack|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|108002|10800201|0|10800203|normal-attack|attack-input-3`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|108002|10800201|0|10800204|normal-attack|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|108002|10800201|0|10800205|normal-attack|attack-input-5`：selected-control-player-variant-duration-unresolved、attack-reopen-event-bridge-window-unavailable
- `actor|109002|10900201|0|10900202|normal-attack|attack-input-2`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|112002|11200201|0|11200203|normal-attack|attack-input-3`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|112002|11200201|0|11200204|normal-attack|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|112002|11200201|0|11200205|normal-attack|attack-input-5`：selected-control-player-variant-duration-unresolved、attack-reopen-event-bridge-window-unavailable

## 一帧与异常长占轴

- 异常长：`kibo|500306|50030601|0|50030601|signature`，640f（C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_50030601.asset/MonoBehaviour/skill_control_50030601__1513569702707447185.json#skillControlData.skillPlayers[0]|skillResourceMaps[0].frameCountDict[key=0]）
- 异常长：`kibo|500399|50039901|0|50039901|signature`，721f（C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_50039901.asset/MonoBehaviour/skill_control_50039901__6413601887178913939.json#skillControlData.skillPlayers[0]|skillResourceMaps[0].frameCountDict[key=0]）
- 异常长：`kibo|500306|50030601|0|50030601|signature|control-variant-0`，640f（C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_50030601.asset/MonoBehaviour/skill_control_50030601__1513569702707447185.json#skillControlData.skillPlayers[0]|skillResourceMaps[0].frameCountDict[key=0]）
- 异常长：`kibo|500360|50036003|0|50036003|break|control-variant-1`，639f（C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_50036003.asset/MonoBehaviour/skill_control_50036003__-5586573623708219583.json#skillControlData.skillPlayers[1]|skillResourceMaps[1].frameCountDict[key=0]）
- 异常长：`kibo|500399|50039901|0|50039901|signature|control-variant-0`，721f（C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_50039901.asset/MonoBehaviour/skill_control_50039901__6413601887178913939.json#skillControlData.skillPlayers[0]|skillResourceMaps[0].frameCountDict[key=0]）

> 动作占轴、动画、命中、输入/派生窗口和冷却分别记录；命中帧与冷却不得作为动作块时长兜底。
