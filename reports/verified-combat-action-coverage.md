# M7 真实三值动作覆盖

- 包：`azpr-tc-2026-07-18`
- 公开动作分母：645
- 已关联：645
- 场景可运行：632
- 来源静态可应用：459
- 来源运行时依赖：173
- 零距离场景补全：586
- 来源静态证据缺口：13
- 明确零：0
- 未解析：13
- 真实命中节点：3214
- 公开动作变体：675（未解析 43）
- 非零回能元素：667（未关联 464）
- 零距离投射物命中：3540（仍缺发射帧 70、仍缺公式 7、仍缺目标 0）
- 普攻输入链：20 条 / 95 个输入段（可运行 80，未解析 15）
- 普攻输入时序：已确认 78，未确认 17

## 普攻输入链

| 角色 | 输入段 | 可运行 | 未解析 | control |
| --- | ---: | ---: | ---: | --- |
| 寒悠悠 | 5 | 5 | 0 | 10100301 / 10100302 / 10100303 / 10100304 / 10100305 |
| 芃芃 | 4 | 4 | 0 | 10100701 / 10100702 / 10100703 / 10100704 |
| 涂山小玉 | 5 | 5 | 0 | 10101001 / 10101002 / 10101003 / 10101004 / 10101005 |
| 莉莉 | 5 | 5 | 0 | 10200101 / 10200102 / 10200103 / 10200104 / 10200105 |
| 红宝石 | 5 | 5 | 0 | 10300201 / 10300202 / 10300203 / 10300204 / 10300205 |
| 西芙莉雅 | 5 | 3 | 2 | 10700101 / 10700102 / 10700103 / 10700104 / 10700105 |
| 米砂 | 5 | 2 | 3 | 10700201 / 10700202 / 10700203 / 10700204 / 10700205 |
| 阿比 | 5 | 5 | 0 | 10700301 / 10700302 / 10700303 / 10700304 / 10700305 |
| 忒拉拉 | 5 | 5 | 0 | 10800101 / 10800102 / 10800103 / 10800104 / 10800105 |
| 璐璐卡 | 5 | 2 | 3 | 10800201 / 10800202 / 10800203 / 10800204 / 10800205 |
| 米蒂 | 3 | 3 | 0 | 10800301 / 10800302 / 10800303 |
| 卡塔露 | 3 | 3 | 0 | 10800501 / 10800502 / 10800503 |
| 末音 | 5 | 5 | 0 | 10900101 / 10900102 / 10900103 / 10900104 / 10900105 |
| 夏儿 | 5 | 5 | 0 | 10900201 / 10900202 / 10900203 / 10900204 / 10900205 |
| 法兰塔 | 5 | 5 | 0 | 11100101 / 11100102 / 11100103 / 11100104 / 11100105 |
| 姬瑟贝露 | 5 | 5 | 0 | 11200101 / 11200102 / 11200103 / 11200104 / 11200105 |
| 艾妮丝 | 5 | 0 | 5 | 11200201 / 11200202 / 11200203 / 11200204 / 11200205 |
| 女主角 | 5 | 4 | 1 | 19900101 / 19900102 / 19900103 / 19900104 / 19900105 |
| 男主角 | 5 | 4 | 1 | 19900201 / 19900202 / 19900203 / 19900204 / 19900205 |
| 诺诺 | 5 | 5 | 0 | 19900301 / 19900302 / 19900303 / 19900304 / 19900305 |

## Owner / 动作类型

| Owner | 动作类型 | 目录 | 关联 | 可运行 | 明确零 | 未解析 | 命中 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| actor | charged-attack | 20 | 20 | 15 | 0 | 5 | 75 |
| actor | dodge-attack | 20 | 20 | 16 | 0 | 4 | 50 |
| actor | limit-counter | 20 | 20 | 19 | 0 | 1 | 81 |
| actor | normal-attack | 20 | 20 | 19 | 0 | 1 | 93 |
| actor | perfect-parry | 20 | 20 | 20 | 0 | 0 | 10 |
| actor | plunging-attack | 20 | 20 | 20 | 0 | 0 | 22 |
| actor | star-carry | 17 | 17 | 15 | 0 | 2 | 74 |
| actor | star-combo | 20 | 20 | 20 | 0 | 0 | 20 |
| actor | star-skill | 20 | 20 | 20 | 0 | 0 | 140 |
| actor | ultimate | 20 | 20 | 20 | 0 | 0 | 139 |
| kibo | active | 82 | 82 | 82 | 0 | 0 | 842 |
| kibo | break | 122 | 122 | 122 | 0 | 0 | 124 |
| kibo | normal-attack | 122 | 122 | 122 | 0 | 0 | 857 |
| kibo | signature | 122 | 122 | 122 | 0 | 0 | 687 |

## 未解析动作

- `actor|101003|10100301|0|10100303|normal-attack` 寒悠悠 / normal-attack / 鸢回影: trigger-frame-missing
- `actor|101003|10100322|1|10100325|limit-counter` 寒悠悠 / limit-counter / 缚风烟: trigger-frame-missing
- `actor|101010|10101001|0|10101003|normal-attack` 涂山小玉 / normal-attack / 画扇春: trigger-frame-missing
- `actor|103002|10300201|0|10300203|normal-attack` 红宝石 / normal-attack / 灵感的火花: trigger-frame-missing, normal-attack-input-segment-duration-unresolved
- `actor|107001|10700101|0|10700103|normal-attack` 西芙莉雅 / normal-attack / 疾风之箭: trigger-frame-missing, effect-trigger-frame-missing, normal-attack-input-segment-duration-unresolved
- `actor|107001|10700101|4|10700110|charged-attack` 西芙莉雅 / charged-attack / 疾风之箭: trigger-frame-missing
- `actor|107001|10700101|6|10700115|dodge-attack` 西芙莉雅 / dodge-attack / 疾风之箭: trigger-frame-missing, projectile-impact-frame-runtime-dependent, effect-trigger-frame-missing, effect-target-unresolved, tuning-mark-relation-notDelElementDataList-unresolved
- `actor|107001|10700121|0|10700121|star-carry` 西芙莉雅 / star-carry / 余音之痕: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|107002|10700201|2|10700215|dodge-attack` 米砂 / dodge-attack / 轻语: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|108001|10800101|1|10800110|charged-attack` 忒拉拉 / charged-attack / 狼行焰影: selected-control-variant-has-no-three-value-elements
- `actor|108002|10800201|1|10800210|charged-attack` 璐璐卡 / charged-attack / 涟漪之舞: trigger-frame-missing, projectile-impact-frame-runtime-dependent, effect-trigger-frame-missing, effect-target-unresolved
- `actor|108002|10800201|4|10800215|dodge-attack` 璐璐卡 / dodge-attack / 涟漪之舞: trigger-frame-missing
- `actor|108002|10800222|0|10800222|star-carry` 璐璐卡 / star-carry / 幽浪之声: selected-control-variant-has-no-runnable-hit
- `actor|108003|10800301|1|10800310|charged-attack` 米蒂 / charged-attack / 破空箭: selected-control-variant-has-no-runnable-hit
- `actor|108003|10800301|6|10800315|dodge-attack` 米蒂 / dodge-attack / 破空箭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|112002|11200201|0|11200203|normal-attack` 艾妮丝 / normal-attack / 慈爱的惩戒: trigger-frame-missing, projectile-impact-frame-runtime-dependent, effect-trigger-frame-missing, effect-target-unresolved, effect-combine-semantics-unresolved, normal-attack-input-segment-duration-unresolved
- `actor|112002|11200201|1|11200210|charged-attack` 艾妮丝 / charged-attack / 慈爱的惩戒: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|112002|11200201|3|11200215|dodge-attack` 艾妮丝 / dodge-attack / 慈爱的惩戒: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|112002|11200222|1|11200225|limit-counter` 艾妮丝 / limit-counter / 后勤保障: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|199003|19900301|1|19900310|charged-attack` 诺诺 / charged-attack / 咻咻嘿咻: selected-control-variant-has-no-runnable-hit

## 未关联非零回能元素

- linked-only-to-unresolved-public-action: 35
- not-referenced-by-public-action-control: 399
- referenced-only-by-unselected-control-variant: 30

逐项 source identity 与字段值见 `verified-combat-action-coverage.json#nonzeroRecoveryCoverage`。

> `unresolved` 不会进入运行时，也不会被写成 0；完整逐项原因见同名 JSON 报告。
