# M7 真实三值动作覆盖

- 包：`azpr-tc-2026-07-18`
- 公开动作分母：563
- 已关联：563
- 场景可运行：550
- 来源静态可应用：440
- 来源运行时依赖：110
- 零距离场景补全：152
- 来源静态证据缺口：13
- 明确零：0
- 未解析：13
- 真实命中节点：2504
- 公开动作变体：593（未解析 43）
- 非零回能元素：667（未关联 464）
- 零距离投射物命中：2424（仍缺发射帧 73、仍缺公式 10、仍缺目标 0）
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
| kibo | active | 122 | 122 | 122 | 0 | 0 | 998 |
| kibo | break | 122 | 122 | 122 | 0 | 0 | 124 |
| kibo | signature | 122 | 122 | 122 | 0 | 0 | 678 |

## 未解析动作

- `actor|101003|10100301|0|10100303` 寒悠悠 / normal-attack / 鸢回影: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|101003|10100322|1|10100325` 寒悠悠 / limit-counter / 缚风烟: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|101010|10101001|0|10101003` 涂山小玉 / normal-attack / 画扇春: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|103002|10300201|0|10300203` 红宝石 / normal-attack / 灵感的火花: trigger-frame-missing, projectile-impact-frame-runtime-dependent, normal-attack-input-segment-duration-unresolved
- `actor|107001|10700101|0|10700103` 西芙莉雅 / normal-attack / 疾风之箭: trigger-frame-missing, projectile-impact-frame-runtime-dependent, effect-trigger-frame-missing, normal-attack-input-segment-duration-unresolved
- `actor|107001|10700101|4|10700110` 西芙莉雅 / charged-attack / 疾风之箭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|107001|10700101|6|10700115` 西芙莉雅 / dodge-attack / 疾风之箭: trigger-frame-missing, projectile-impact-frame-runtime-dependent, effect-trigger-frame-missing, effect-target-unresolved, tuning-mark-relation-notDelElementDataList-unresolved
- `actor|107001|10700121|0|10700121` 西芙莉雅 / star-carry / 余音之痕: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|107002|10700201|2|10700215` 米砂 / dodge-attack / 轻语: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|108001|10800101|1|10800110` 忒拉拉 / charged-attack / 狼行焰影: selected-control-variant-has-no-three-value-elements
- `actor|108002|10800201|1|10800210` 璐璐卡 / charged-attack / 涟漪之舞: trigger-frame-missing, projectile-impact-frame-runtime-dependent, effect-trigger-frame-missing, effect-target-unresolved
- `actor|108002|10800201|4|10800215` 璐璐卡 / dodge-attack / 涟漪之舞: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|108002|10800222|0|10800222` 璐璐卡 / star-carry / 幽浪之声: selected-control-variant-has-no-runnable-hit
- `actor|108003|10800301|1|10800310` 米蒂 / charged-attack / 破空箭: selected-control-variant-has-no-runnable-hit
- `actor|108003|10800301|6|10800315` 米蒂 / dodge-attack / 破空箭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|112002|11200201|0|11200203` 艾妮丝 / normal-attack / 慈爱的惩戒: trigger-frame-missing, projectile-impact-frame-runtime-dependent, effect-trigger-frame-missing, effect-target-unresolved, effect-combine-semantics-unresolved, normal-attack-input-segment-duration-unresolved
- `actor|112002|11200201|1|11200210` 艾妮丝 / charged-attack / 慈爱的惩戒: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|112002|11200201|3|11200215` 艾妮丝 / dodge-attack / 慈爱的惩戒: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|112002|11200222|1|11200225` 艾妮丝 / limit-counter / 后勤保障: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|199003|19900301|1|19900310` 诺诺 / charged-attack / 咻咻嘿咻: selected-control-variant-has-no-runnable-hit
- `kibo|500002|502015|0|502015` 水灵仔 / active / 水弹连射: trigger-frame-missing
- `kibo|500002|50000203|0|50000203` 水灵仔 / break / 水灵仔-合击: trigger-frame-missing
- `kibo|500003|502019|0|502019` 水灵偶 / active / 漂浮水泡: trigger-frame-missing
- `kibo|500003|50000303|0|50000303` 水灵偶 / break / 水灵偶-合击: trigger-frame-missing
- `kibo|500004|502016|0|502016` 汐灵偶 / active / 大海浪: trigger-frame-missing
- `kibo|500004|50000417|0|50000417` 汐灵偶 / break / 汐灵偶-合击: trigger-frame-missing
- `kibo|500005|501014|0|501014` 火灵仔 / active / 火球连射: trigger-frame-missing
- `kibo|500006|501017|0|501017` 火灵偶 / active / 空降之焰: trigger-frame-missing
- `kibo|500007|501016|0|501016` 焰灵偶 / active / 分裂之焰: trigger-frame-missing
- `kibo|500020|503001|0|503001` 小雪狼 / active / 冰锥: trigger-frame-missing
- `kibo|500020|50002004|0|50002004` 小雪狼 / break / 小雪狼-合击: trigger-frame-missing
- `kibo|500021|503006|0|503006` 冰速狼 / active / 寒冰碎片: trigger-frame-missing
- `kibo|500022|503004|0|503004` 霜刃狼 / active / 冰矛连射: trigger-frame-missing
- `kibo|500023|505013|0|505013` 苗鸡 / active / 种子飞弹: trigger-frame-missing
- `kibo|500024|505006|0|505006` 菜鸡 / active / 灵木繁星: trigger-frame-missing
- `kibo|500025|507003|0|507003` 拉加野猪 / active / 落雷: trigger-frame-missing
- `kibo|500026|505006|0|505006` 碧羽灵龙 / active / 灵木繁星: trigger-frame-missing
- `kibo|500035|505004|0|505004` 叶冠驼 / active / 株连灵木: trigger-frame-missing
- `kibo|500035|50003501|0|50003501` 叶冠驼 / break / 叶冠驼-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500037|501001|0|501001` 焰羊羊 / active / 火球: trigger-frame-missing
- `kibo|500038|501003|0|501003` 尾火羊 / active / 烈焰弹: trigger-frame-missing
- `kibo|500039|501003|0|501003` 炎灼角羊 / active / 烈焰弹: trigger-frame-missing
- `kibo|500040|506001|0|506001` 铁球蜥 / active / 岩锥: trigger-frame-missing
- `kibo|500041|506001|0|506001` 三角蜥 / active / 岩锥: trigger-frame-missing
- `kibo|500043|504012|0|504012` 小浮蝶 / active / 小风弹: trigger-frame-missing
- `kibo|500044|504012|0|504012` 浮蝶 / active / 小风弹: trigger-frame-missing
- `kibo|500045|504020|0|504020` 幻蝶 / active / 旋风回旋镖: trigger-frame-missing
- `kibo|500046|505013|0|505013` 木灵苞 / active / 种子飞弹: trigger-frame-missing
- `kibo|500047|505014|0|505014` 木灵朵 / active / 花绽飞弹: trigger-frame-missing
- `kibo|500048|505018|0|505018` 蔓音花 / active / 种子风暴: trigger-frame-missing
- `kibo|500051|506001|0|506001` 岩甲蜥 / active / 岩锥: trigger-frame-missing
- `kibo|500057|507001|0|507001` 猪古力 / active / 雷球: trigger-frame-missing
- `kibo|500064|504001|0|504001` 柔风鹰 / active / 风刃: trigger-frame-missing
- `kibo|500067|502006|0|502006` 飞鳐 / active / 水弹散射: trigger-frame-missing
- `kibo|500068|502003|0|502003` 星鳐 / active / 爆裂水球: trigger-frame-missing
- `kibo|500072|503004|0|503004` 乌尔 / active / 冰矛连射: trigger-frame-missing
- `kibo|500083|501001|0|501001` 滚地犰 / active / 火球: trigger-frame-missing
- `kibo|500095|509001|0|509001` 雾粘蛙 / active / 暗魂影: trigger-frame-missing
- `kibo|500096|509002|0|509002` 雾球蛙 / active / 暗魂影爆阵: trigger-frame-missing
- `kibo|500098|50009804|0|50009804` 水岩卫 / break / 水岩卫-合击: trigger-frame-missing
- `kibo|500110|505001|0|505001` 宝蓝雏龙 / active / 灵木弹: trigger-frame-missing
- `kibo|500114|503009|0|503009` 冰灵仔 / active / 冰晶弹: trigger-frame-missing
- `kibo|500115|503010|0|503010` 冰灵偶 / active / 冰晶散射: trigger-frame-missing
- `kibo|500116|503018|0|503018` 霜灵偶 / active / 寒冰之罚: trigger-frame-missing
- `kibo|500120|504001|0|504001` 哈加 / active / 风刃: trigger-frame-missing
- `kibo|500123|504012|0|504012` 风灵苞 / active / 小风弹: trigger-frame-missing
- `kibo|500124|504012|0|504012` 风灵朵 / active / 小风弹: trigger-frame-missing
- `kibo|500125|504014|0|504014` 岚音花 / active / 风刃扩张: trigger-frame-missing
- `kibo|500126|504012|0|504012` 风灵仔 / active / 小风弹: trigger-frame-missing
- `kibo|500127|504012|0|504012` 风灵偶 / active / 小风弹: trigger-frame-missing
- `kibo|500128|504014|0|504014` 岚灵偶 / active / 风刃扩张: trigger-frame-missing
- `kibo|500129|507001|0|507001` 呼姆猴 / active / 雷球: trigger-frame-missing
- `kibo|500130|507003|0|507003` 环尾猴 / active / 落雷: trigger-frame-missing
- `kibo|500131|507003|0|507003` 环影猴 / active / 落雷: trigger-frame-missing
- `kibo|500133|506001|0|506001` 加多利 / active / 岩锥: trigger-frame-missing
- `kibo|500138|501001|0|501001` 红宝虫 / active / 火球: trigger-frame-missing
- `kibo|500139|506005|0|506005` 赤晶甲 / active / 巨石投掷: trigger-frame-missing
- `kibo|500140|506005|0|506005` 炎晶甲 / active / 巨石投掷: trigger-frame-missing
- `kibo|500147|505013|0|505013` 木灵仔 / active / 种子飞弹: trigger-frame-missing
- `kibo|500147|50014704|0|50014704` 木灵仔 / break / 木灵仔-合击: trigger-frame-missing
- `kibo|500148|505014|0|505014` 木灵偶 / active / 花绽飞弹: trigger-frame-missing
- `kibo|500148|50014804|0|50014804` 木灵偶 / break / 木灵偶-合击: trigger-frame-missing
- `kibo|500149|505017|0|505017` 蔓灵偶 / active / 地蔓突击: trigger-frame-missing
- `kibo|500149|50014904|0|50014904` 蔓灵偶 / break / 蔓灵偶-合击: trigger-frame-missing
- `kibo|500156|501001|0|501001` 火花雀 / active / 火球: trigger-frame-missing
- `kibo|500156|50015604|0|50015604` 火花雀 / break / 火花雀-合击: trigger-frame-missing
- `kibo|500157|501005|0|501005` 焰火雀 / active / 焰弹连发: trigger-frame-missing
- `kibo|500157|50015704|0|50015704` 焰火雀 / break / 焰火雀-合击: trigger-frame-missing
- `kibo|500158|501005|0|501005` 火烈鹰 / active / 焰弹连发: trigger-frame-missing
- `kibo|500164|507012|0|507012` 雷灵苞 / active / 电能子弹: trigger-frame-missing
- `kibo|500165|507020|0|507020` 雷灵朵 / active / 连锁雷暴: trigger-frame-missing
- `kibo|500166|507019|0|507019` 电音花 / active / 雷电惩戒: trigger-frame-missing
- `kibo|500173|507012|0|507012` 雷灵仔 / active / 电能子弹: trigger-frame-missing
- `kibo|500174|507020|0|507020` 雷灵偶 / active / 连锁雷暴: trigger-frame-missing
- `kibo|500179|509001|0|509001` 竖耳蝠 / active / 暗魂影: trigger-frame-missing
- `kibo|500180|509002|0|509002` 嘻哈蝠 / active / 暗魂影爆阵: trigger-frame-missing
- `kibo|500181|509002|0|509002` 笑面蝠 / active / 暗魂影爆阵: trigger-frame-missing
- `kibo|500185|504009|0|504009` 森彩灵蝶 / active / 旋风涡流: trigger-frame-missing
- `kibo|500186|502001|0|502001` 布鲁达 / active / 水弹: trigger-frame-missing, base-function-unverified, common-function-unverified, projectile-impact-frame-runtime-dependent, level-ratio-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `kibo|500187|502007|0|502007` 蓝羽西格尼 / active / 泡泡攻击: trigger-frame-missing
- `kibo|500213|509001|0|509001` 菇噜噜 / active / 暗魂影: trigger-frame-missing
- `kibo|500220|509010|0|509010` 星云伊欧 / active / 暗影连袭: trigger-frame-missing
- `kibo|500231|507003|0|507003` 铁鬃霸主 / active / 落雷: trigger-frame-missing
- `kibo|500244|501001|0|501001` 焰哞哞 / active / 火球: trigger-frame-missing
- `kibo|500258|505001|0|505001` 小芽狐 / active / 灵木弹: trigger-frame-missing
- `kibo|500261|502001|0|502001` 河狸仔 / active / 水弹: trigger-frame-missing, base-function-unverified, common-function-unverified, projectile-impact-frame-runtime-dependent, level-ratio-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `kibo|500262|502001|0|502001` 波河狸 / active / 水弹: trigger-frame-missing, base-function-unverified, common-function-unverified, projectile-impact-frame-runtime-dependent, level-ratio-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `kibo|500263|502005|0|502005` 河狸大师 / active / 浪袭: trigger-frame-missing
- `kibo|500304|504012|0|504012` 库库 / active / 小风弹: trigger-frame-missing
- `kibo|500305|504020|0|504020` 库库尔 / active / 旋风回旋镖: trigger-frame-missing
- `kibo|500306|504006|0|504006` 库库尔克 / active / 风龙卷: trigger-frame-missing
- `kibo|500313|501016|0|501016` 绒心布里尼 / active / 分裂之焰: trigger-frame-missing
- `kibo|500322|504001|0|504001` 赛可洛 / active / 风刃: trigger-frame-missing
- `kibo|500324|504006|0|504006` 伊欧利安 / active / 风龙卷: trigger-frame-missing
- `kibo|500354|509001|0|509001` 小暮鸮 / active / 暗魂影: trigger-frame-missing
- `kibo|500355|509002|0|509002` 夜猫鸮 / active / 暗魂影爆阵: trigger-frame-missing
- `kibo|500357|504012|0|504012` 啵啵丁 / active / 小风弹: trigger-frame-missing
- `kibo|500360|509002|0|509002` 怯影之翼 / active / 暗魂影爆阵: trigger-frame-missing
- `kibo|500368|504012|0|504012` 小音浮 / active / 小风弹: trigger-frame-missing
- `kibo|500369|507003|0|507003` 乐乐蛙 / active / 落雷: trigger-frame-missing
- `kibo|500370|507003|0|507003` 音霸蛙 / active / 落雷: trigger-frame-missing
- `kibo|500399|502007|0|502007` 浮云 / active / 泡泡攻击: trigger-frame-missing
- `kibo|500467|506001|0|506001` 小岩蹄 / active / 岩锥: trigger-frame-missing

## 未关联非零回能元素

- linked-only-to-unresolved-public-action: 35
- not-referenced-by-public-action-control: 399
- referenced-only-by-unselected-control-variant: 30

逐项 source identity 与字段值见 `verified-combat-action-coverage.json#nonzeroRecoveryCoverage`。

> `unresolved` 不会进入运行时，也不会被写成 0；完整逐项原因见同名 JSON 报告。
