# M9-A 全动作时长与输入占轴审计

- 包：`azpr-tc-2026-07-18`
- 公开动作：562（已确认 527，未解析 35）
- 公开变体：592（已确认 527，未解析 65）
- 普攻输入段：95（已确认 64，未解析 31）
- SkillControl/player 变体：1039
- 一帧占轴：0
- 异常长占轴（>600f）：5

## Owner / 动作类型 / 来源状态

| Owner | 动作类型 | 占轴来源 | 状态 | 数量 |
| --- | --- | --- | --- | ---: |
| actor | charged-attack | invariant-across-control-player-variants | applied | 2 |
| actor | charged-attack | skill-control-player-action-range | applied | 6 |
| actor | charged-attack | unresolved-action-occupancy | unresolved | 11 |
| actor | dodge-attack | skill-control-player-action-range | applied | 19 |
| actor | dodge-attack | unresolved-action-occupancy | unresolved | 1 |
| actor | limit-counter | invariant-across-control-player-variants | applied | 1 |
| actor | limit-counter | skill-control-player-action-range | applied | 17 |
| actor | limit-counter | unresolved-action-occupancy | unresolved | 2 |
| actor | normal-attack | normal-attack-input-segment-chain | applied | 7 |
| actor | normal-attack | normal-attack-input-segment-chain | unresolved | 13 |
| actor | perfect-parry | skill-control-player-action-range | applied | 18 |
| actor | perfect-parry | unresolved-action-occupancy | unresolved | 2 |
| actor | plunging-attack | skill-control-player-action-range | applied | 20 |
| actor | star-carry | invariant-across-control-player-variants | applied | 1 |
| actor | star-carry | skill-control-player-action-range | applied | 14 |
| actor | star-carry | unresolved-action-occupancy | unresolved | 2 |
| actor | star-combo | invariant-across-control-player-variants | applied | 1 |
| actor | star-combo | skill-control-player-action-range | applied | 18 |
| actor | star-combo | unresolved-action-occupancy | unresolved | 1 |
| actor | star-skill | invariant-across-control-player-variants | applied | 2 |
| actor | star-skill | skill-control-player-action-range | applied | 17 |
| actor | star-skill | unresolved-action-occupancy | unresolved | 1 |
| actor | ultimate | invariant-across-control-player-variants | applied | 1 |
| actor | ultimate | skill-control-player-action-range | applied | 18 |
| actor | ultimate | unresolved-action-occupancy | unresolved | 1 |
| kibo | active | skill-control-player-action-range | applied | 122 |
| kibo | break | skill-control-player-action-range | applied | 121 |
| kibo | break | unresolved-action-occupancy | unresolved | 1 |
| kibo | signature | skill-control-player-action-range | applied | 122 |

## 未解析占轴

- `actor|101007|10100701|0|10100703`：normal-attack-input-segment-duration-unresolved
- `actor|101010|10101001|0|10101003`：normal-attack-input-segment-duration-unresolved
- `actor|101010|10101001|2|10101010`：control-player-variant-duration-not-invariant
- `actor|102001|10200101|1|10200110`：control-player-variant-duration-not-invariant
- `actor|102001|10200122|2|10200127`：control-player-variant-duration-not-invariant
- `actor|103002|10300201|0|10300203`：normal-attack-input-segment-duration-unresolved
- `actor|107001|10700101|0|10700103`：normal-attack-input-segment-duration-unresolved
- `actor|107002|10700201|0|10700203`：normal-attack-input-segment-duration-unresolved
- `actor|107002|10700201|2|10700215`：control-player-variant-duration-not-invariant
- `actor|107002|10700212|0|10700212`：control-player-variant-duration-not-invariant
- `actor|107002|10700212|1|10700226`：control-player-variant-duration-not-invariant
- `actor|107002|10700222|1|10700225`：control-player-variant-duration-not-invariant
- `actor|107003|10700301|0|10700303`：normal-attack-input-segment-duration-unresolved
- `actor|107003|10700321|0|10700321`：control-player-variant-duration-not-invariant
- `actor|108001|10800101|1|10800110`：control-player-variant-duration-not-invariant
- `actor|108002|10800201|0|10800203`：normal-attack-input-segment-duration-unresolved
- `actor|108002|10800201|1|10800210`：control-player-variant-duration-not-invariant
- `actor|108003|10800301|1|10800310`：control-player-variant-duration-not-invariant
- `actor|108005|10800501|1|10800510`：control-player-variant-duration-not-invariant
- `actor|109002|10900201|0|10900203`：normal-attack-input-segment-duration-unresolved
- `actor|111001|11100101|0|11100103`：normal-attack-input-segment-duration-unresolved
- `actor|111001|11100101|5|11100110`：control-player-variant-duration-not-invariant
- `actor|111001|11100113|0|11100113`：control-player-variant-duration-not-invariant
- `actor|112001|11200101|0|11200103`：normal-attack-input-segment-duration-unresolved
- `actor|112001|11200101|1|11200110`：control-player-variant-duration-not-invariant
- `actor|112001|11200121|1|11200125`：control-player-variant-duration-not-invariant
- `actor|112002|11200201|0|11200203`：normal-attack-input-segment-duration-unresolved
- `actor|112002|11200201|1|11200210`：control-player-variant-duration-not-invariant
- `actor|199001|19900101|0|19900103`：normal-attack-input-segment-duration-unresolved
- `actor|199001|19900101|1|19900110`：control-player-variant-duration-not-invariant
- `actor|199002|19900201|0|19900203`：normal-attack-input-segment-duration-unresolved
- `actor|199002|19900201|1|19900210`：control-player-variant-duration-not-invariant
- `actor|199003|19900321|0|19900321`：control-player-variant-duration-not-invariant
- `actor|199003|19900321|2|19900327`：control-player-variant-duration-not-invariant
- `kibo|500304|50030404|0|50030404`：control-player-variant-duration-not-invariant
- `actor|101007|10100701|0|10100701|attack-input-1`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|101007|10100701|0|10100704|attack-input-4`：control-player-variant-duration-not-invariant
- `actor|101010|10101001|0|10101001|attack-input-1`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|101010|10101001|0|10101002|attack-input-2`：control-player-variant-duration-not-invariant
- `actor|101010|10101001|0|10101004|attack-input-4`：control-player-variant-duration-not-invariant
- `actor|101010|10101001|0|10101005|attack-input-5`：control-player-variant-duration-not-invariant
- `actor|103002|10300201|0|10300201|attack-input-1`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|103002|10300201|0|10300202|attack-input-2`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|103002|10300201|0|10300203|attack-input-3`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|103002|10300201|0|10300204|attack-input-4`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|103002|10300201|0|10300205|attack-input-5`：control-player-variant-duration-not-invariant
- `actor|107001|10700101|0|10700102|attack-input-2`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|107001|10700101|0|10700103|attack-input-3`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|107001|10700101|0|10700104|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|107001|10700101|0|10700105|attack-input-5`：selected-control-player-variant-duration-unresolved、attack-reopen-event-bridge-window-unavailable
- `actor|107002|10700201|0|10700204|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|107002|10700201|0|10700205|attack-input-5`：skill-control-player-variant-missing
- `actor|107003|10700301|0|10700304|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|108002|10800201|0|10800203|attack-input-3`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|108002|10800201|0|10800204|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|108002|10800201|0|10800205|attack-input-5`：selected-control-player-variant-duration-unresolved、attack-reopen-event-bridge-window-unavailable
- `actor|109002|10900201|0|10900202|attack-input-2`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|111001|11100101|0|11100101|attack-input-1`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|111001|11100101|0|11100102|attack-input-2`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|111001|11100101|0|11100105|attack-input-5`：control-player-variant-duration-unresolved、input-window-ends-before-final-hit
- `actor|112001|11200101|0|11200101|attack-input-1`：control-player-variant-duration-not-invariant
- `actor|112002|11200201|0|11200203|attack-input-3`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|112002|11200201|0|11200204|attack-input-4`：selected-control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|112002|11200201|0|11200205|attack-input-5`：selected-control-player-variant-duration-unresolved、attack-reopen-event-bridge-window-unavailable
- `actor|199001|19900101|0|19900101|attack-input-1`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable
- `actor|199002|19900201|0|19900201|attack-input-1`：control-player-variant-duration-unresolved、next-control-event-bridge-window-unavailable

## 一帧与异常长占轴

- 异常长：`kibo|500306|50030601|0|50030601`，640f（C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_50030601.asset/MonoBehaviour/skill_control_50030601__1513569702707447185.json#skillControlData.skillPlayers[0]|skillResourceMaps[0].frameCountDict[key=0]）
- 异常长：`kibo|500399|50039901|0|50039901`，721f（C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_50039901.asset/MonoBehaviour/skill_control_50039901__6413601887178913939.json#skillControlData.skillPlayers[0]|skillResourceMaps[0].frameCountDict[key=0]）
- 异常长：`kibo|500306|50030601|0|50030601|control-variant-0`，640f（C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_50030601.asset/MonoBehaviour/skill_control_50030601__1513569702707447185.json#skillControlData.skillPlayers[0]|skillResourceMaps[0].frameCountDict[key=0]）
- 异常长：`kibo|500360|50036003|0|50036003|control-variant-1`，639f（C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_50036003.asset/MonoBehaviour/skill_control_50036003__-5586573623708219583.json#skillControlData.skillPlayers[1]|skillResourceMaps[1].frameCountDict[key=0]）
- 异常长：`kibo|500399|50039901|0|50039901|control-variant-0`，721f（C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_50039901.asset/MonoBehaviour/skill_control_50039901__6413601887178913939.json#skillControlData.skillPlayers[0]|skillResourceMaps[0].frameCountDict[key=0]）

> 动作占轴、动画、命中、输入/派生窗口和冷却分别记录；命中帧与冷却不得作为动作块时长兜底。
