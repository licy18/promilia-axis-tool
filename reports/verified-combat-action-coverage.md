# M7 真实三值动作覆盖

- 包：`azpr-tc-2026-07-18`
- 公开动作分母：562
- 已关联：562
- 可运行：318
- 明确零：0
- 未解析：244
- 真实命中节点：1174
- 公开动作变体：592（未解析 274）
- 非零回能元素：667（未关联 502）
- 普攻输入链：20 条 / 95 个输入段（可运行 49，未解析 46）

## 普攻输入链

| 角色 | 输入段 | 可运行 | 未解析 | control |
| --- | ---: | ---: | ---: | --- |
| 寒悠悠 | 5 | 0 | 5 | 10100301 / 10100302 / 10100303 / 10100304 / 10100305 |
| 芃芃 | 4 | 2 | 2 | 10100701 / 10100702 / 10100703 / 10100704 |
| 涂山小玉 | 5 | 0 | 5 | 10101001 / 10101002 / 10101003 / 10101004 / 10101005 |
| 莉莉 | 5 | 5 | 0 | 10200101 / 10200102 / 10200103 / 10200104 / 10200105 |
| 红宝石 | 5 | 0 | 5 | 10300201 / 10300202 / 10300203 / 10300204 / 10300205 |
| 西芙莉雅 | 5 | 0 | 5 | 10700101 / 10700102 / 10700103 / 10700104 / 10700105 |
| 米砂 | 5 | 2 | 3 | 10700201 / 10700202 / 10700203 / 10700204 / 10700205 |
| 阿比 | 5 | 4 | 1 | 10700301 / 10700302 / 10700303 / 10700304 / 10700305 |
| 忒拉拉 | 5 | 4 | 1 | 10800101 / 10800102 / 10800103 / 10800104 / 10800105 |
| 璐璐卡 | 5 | 1 | 4 | 10800201 / 10800202 / 10800203 / 10800204 / 10800205 |
| 米蒂 | 3 | 1 | 2 | 10800301 / 10800302 / 10800303 |
| 卡塔露 | 3 | 3 | 0 | 10800501 / 10800502 / 10800503 |
| 末音 | 5 | 4 | 1 | 10900101 / 10900102 / 10900103 / 10900104 / 10900105 |
| 夏儿 | 5 | 4 | 1 | 10900201 / 10900202 / 10900203 / 10900204 / 10900205 |
| 法兰塔 | 5 | 2 | 3 | 11100101 / 11100102 / 11100103 / 11100104 / 11100105 |
| 姬瑟贝露 | 5 | 4 | 1 | 11200101 / 11200102 / 11200103 / 11200104 / 11200105 |
| 艾妮丝 | 5 | 0 | 5 | 11200201 / 11200202 / 11200203 / 11200204 / 11200205 |
| 女主角 | 5 | 4 | 1 | 19900101 / 19900102 / 19900103 / 19900104 / 19900105 |
| 男主角 | 5 | 4 | 1 | 19900201 / 19900202 / 19900203 / 19900204 / 19900205 |
| 诺诺 | 5 | 5 | 0 | 19900301 / 19900302 / 19900303 / 19900304 / 19900305 |

## Owner / 动作类型

| Owner | 动作类型 | 目录 | 关联 | 可运行 | 明确零 | 未解析 | 命中 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| actor | charged-attack | 19 | 19 | 4 | 0 | 15 | 22 |
| actor | dodge-attack | 20 | 20 | 15 | 0 | 5 | 49 |
| actor | limit-counter | 20 | 20 | 13 | 0 | 7 | 64 |
| actor | normal-attack | 20 | 20 | 15 | 0 | 5 | 86 |
| actor | perfect-parry | 20 | 20 | 0 | 0 | 20 | 0 |
| actor | plunging-attack | 20 | 20 | 20 | 0 | 0 | 22 |
| actor | star-carry | 17 | 17 | 7 | 0 | 10 | 42 |
| actor | star-combo | 20 | 20 | 18 | 0 | 2 | 18 |
| actor | star-skill | 20 | 20 | 12 | 0 | 8 | 114 |
| actor | ultimate | 20 | 20 | 5 | 0 | 15 | 123 |
| kibo | active | 122 | 122 | 22 | 0 | 100 | 195 |
| kibo | break | 122 | 122 | 109 | 0 | 13 | 110 |
| kibo | signature | 122 | 122 | 78 | 0 | 44 | 329 |

## 未解析动作

- `actor|101003|10100301|0|10100303` 寒悠悠 / normal-attack / 鸢回影: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|101003|10100301|1|10100310` 寒悠悠 / charged-attack / 鸢回影: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|101003|10100322|1|10100325` 寒悠悠 / limit-counter / 缚风烟: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|101003|10100322|2|10100327` 寒悠悠 / perfect-parry / 缚风烟: selected-control-variant-has-no-runnable-hit
- `actor|101007|10100713|0|10100713` 芃芃 / ultimate / 猛虎扑食: trigger-frame-missing
- `actor|101007|10100721|2|10100727` 芃芃 / perfect-parry / 来打我啊！: selected-control-variant-has-no-runnable-hit
- `actor|101010|10101001|0|10101003` 涂山小玉 / normal-attack / 画扇春: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|101010|10101001|2|10101010` 涂山小玉 / charged-attack / 画扇春: multiple-control-variants-without-root-selection
- `actor|101010|10101012|0|10101012` 涂山小玉 / star-skill / 落花影: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `actor|101010|10101013|0|10101013` 涂山小玉 / ultimate / 世间缘: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `actor|101010|10101021|0|10101021` 涂山小玉 / star-carry / 驭仙风: trigger-frame-missing, base-function-unverified, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete, projectile-impact-frame-runtime-dependent
- `actor|101010|10101021|2|10101027` 涂山小玉 / perfect-parry / 驭仙风: selected-control-variant-has-no-runnable-hit
- `actor|102001|10200101|1|10200110` 莉莉 / charged-attack / 风翼枪术: multiple-control-variants-without-root-selection
- `actor|102001|10200122|2|10200127` 莉莉 / perfect-parry / 骑士加护: multiple-control-variants-without-root-selection
- `actor|103002|10300201|0|10300203` 红宝石 / normal-attack / 灵感的火花: multiple-control-variants-without-root-selection
- `actor|103002|10300212|0|10300212` 红宝石 / star-skill / 艺术的舞曲: trigger-frame-missing
- `actor|103002|10300221|1|10300225` 红宝石 / limit-counter / 一瞬的灼热: multiple-control-variants-without-root-selection
- `actor|103002|10300221|2|10300227` 红宝石 / perfect-parry / 一瞬的灼热: selected-control-variant-has-no-runnable-hit
- `actor|107001|10700101|0|10700103` 西芙莉雅 / normal-attack / 疾风之箭: multiple-control-variants-without-root-selection
- `actor|107001|10700101|4|10700110` 西芙莉雅 / charged-attack / 疾风之箭: multiple-control-variants-without-root-selection
- `actor|107001|10700101|6|10700115` 西芙莉雅 / dodge-attack / 疾风之箭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|107001|10700112|0|10700112` 西芙莉雅 / star-skill / 穿流之舞: multiple-control-variants-without-root-selection
- `actor|107001|10700112|4|10700126` 西芙莉雅 / star-combo / 穿流之舞: multiple-control-variants-without-root-selection
- `actor|107001|10700113|0|10700113` 西芙莉雅 / ultimate / 烈风回旋曲: multiple-root-player-skill-variants
- `actor|107001|10700121|0|10700121` 西芙莉雅 / star-carry / 余音之痕: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|107001|10700121|2|10700125` 西芙莉雅 / limit-counter / 余音之痕: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|107001|10700121|4|10700127` 西芙莉雅 / perfect-parry / 余音之痕: selected-control-variant-has-no-runnable-hit
- `actor|107002|10700201|2|10700215` 米砂 / dodge-attack / 轻语: multiple-root-player-skill-variants
- `actor|107002|10700212|0|10700212` 米砂 / star-skill / 浮茵: multiple-root-player-skill-variants
- `actor|107002|10700212|1|10700226` 米砂 / star-combo / 浮茵: multiple-root-player-skill-variants
- `actor|107002|10700213|0|10700213` 米砂 / ultimate / 森之祈愿: base-function-unverified, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete, trigger-frame-missing
- `actor|107002|10700222|0|10700222` 米砂 / star-carry / 林隙留影: base-function-unverified, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `actor|107002|10700222|1|10700225` 米砂 / limit-counter / 林隙留影: multiple-root-player-skill-variants
- `actor|107002|10700222|2|10700227` 米砂 / perfect-parry / 林隙留影: selected-control-variant-has-no-runnable-hit
- `actor|107003|10700321|0|10700321` 阿比 / star-carry / 阿比咆哮: multiple-control-variants-without-root-selection
- `actor|107003|10700321|2|10700327` 阿比 / perfect-parry / 阿比咆哮: selected-control-variant-has-no-runnable-hit
- `actor|108001|10800101|1|10800110` 忒拉拉 / charged-attack / 狼行焰影: multiple-root-player-skill-variants
- `actor|108001|10800112|0|10800112` 忒拉拉 / star-skill / 跃空行枪: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `actor|108001|10800113|0|10800113` 忒拉拉 / ultimate / 灼焰烈舞: trigger-frame-missing
- `actor|108001|10800121|2|10800127` 忒拉拉 / perfect-parry / 奔野之狼: selected-control-variant-has-no-runnable-hit
- `actor|108002|10800201|1|10800210` 璐璐卡 / charged-attack / 涟漪之舞: multiple-control-variants-without-root-selection
- `actor|108002|10800201|4|10800215` 璐璐卡 / dodge-attack / 涟漪之舞: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|108002|10800212|0|10800212` 璐璐卡 / star-skill / 洑流之源: selected-control-variant-has-no-runnable-hit
- `actor|108002|10800213|0|10800213` 璐璐卡 / ultimate / 万灵的誓约: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|108002|10800222|0|10800222` 璐璐卡 / star-carry / 幽浪之声: selected-control-variant-has-no-runnable-hit
- `actor|108002|10800222|1|10800225` 璐璐卡 / limit-counter / 幽浪之声: projectile-impact-frame-runtime-dependent
- `actor|108002|10800222|2|10800227` 璐璐卡 / perfect-parry / 幽浪之声: selected-control-variant-has-no-runnable-hit
- `actor|108003|10800301|1|10800310` 米蒂 / charged-attack / 破空箭: multiple-control-variants-without-root-selection
- `actor|108003|10800301|6|10800315` 米蒂 / dodge-attack / 破空箭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|108003|10800313|0|10800313` 米蒂 / ultimate / 雷电强袭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|108003|10800322|0|10800322` 米蒂 / star-carry / 唤雷箭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|108003|10800322|2|10800327` 米蒂 / perfect-parry / 唤雷箭: selected-control-variant-has-no-runnable-hit
- `actor|108005|10800501|1|10800510` 卡塔露 / charged-attack / 坚盾乱打: multiple-control-variants-without-root-selection
- `actor|108005|10800513|0|10800513` 卡塔露 / ultimate / 弯角的意志: base-function-unverified, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `actor|108005|10800522|2|10800527` 卡塔露 / perfect-parry / 不屈者: selected-control-variant-has-no-runnable-hit
- `actor|109001|10900113|0|10900113` 末音 / ultimate / 绽华章之舞: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `actor|109001|10900121|3|10900127` 末音 / perfect-parry / 凝飓风之旋: selected-control-variant-has-no-runnable-hit
- `actor|109002|10900201|1|10900210` 夏儿 / charged-attack / 流水贯石: multiple-control-variants-without-root-selection
- `actor|109002|10900221|2|10900227` 夏儿 / perfect-parry / 踏波: selected-control-variant-has-no-runnable-hit
- `actor|111001|11100101|5|11100110` 法兰塔 / charged-attack / 疾风投羽: multiple-control-variants-without-root-selection
- `actor|111001|11100112|0|11100112` 法兰塔 / star-skill / 斩彻裂空: multiple-control-variants-without-root-selection
- `actor|111001|11100113|0|11100113` 法兰塔 / ultimate / 风暴再临: multiple-root-player-skill-variants
- `actor|111001|11100121|0|11100121` 法兰塔 / star-carry / 追猎之翼: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|111001|11100121|2|11100127` 法兰塔 / perfect-parry / 追猎之翼: selected-control-variant-has-no-runnable-hit
- `actor|112001|11200101|1|11200110` 姬瑟贝露 / charged-attack / 女仆的清扫: multiple-control-variants-without-root-selection
- `actor|112001|11200113|0|11200113` 姬瑟贝露 / ultimate / 女仆的逐客令: trigger-frame-missing
- `actor|112001|11200121|0|11200121` 姬瑟贝露 / star-carry / 女仆的心得: multiple-control-variants-without-root-selection
- `actor|112001|11200121|1|11200125` 姬瑟贝露 / limit-counter / 女仆的心得: multiple-root-player-skill-variants
- `actor|112001|11200121|2|11200127` 姬瑟贝露 / perfect-parry / 女仆的心得: selected-control-variant-has-no-runnable-hit
- `actor|112002|11200201|0|11200203` 艾妮丝 / normal-attack / 慈爱的惩戒: trigger-frame-missing, base-function-unverified, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete, projectile-impact-frame-runtime-dependent
- `actor|112002|11200201|1|11200210` 艾妮丝 / charged-attack / 慈爱的惩戒: multiple-root-player-skill-variants
- `actor|112002|11200201|3|11200215` 艾妮丝 / dodge-attack / 慈爱的惩戒: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|112002|11200212|0|11200212` 艾妮丝 / star-skill / 不许捣乱哦: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete, projectile-impact-frame-runtime-dependent
- `actor|112002|11200213|0|11200213` 艾妮丝 / ultimate / 治疗时间到: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `actor|112002|11200222|0|11200222` 艾妮丝 / star-carry / 后勤保障: selected-control-variant-has-no-runnable-hit
- `actor|112002|11200222|1|11200225` 艾妮丝 / limit-counter / 后勤保障: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `actor|112002|11200222|2|11200227` 艾妮丝 / perfect-parry / 后勤保障: selected-control-variant-has-no-runnable-hit
- `actor|199001|19900101|1|19900110` 女主角 / charged-attack / 跃动之星: multiple-root-player-skill-variants
- `actor|199001|19900113|0|19900113` 女主角 / ultimate / 终将归于星海: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `actor|199001|19900122|2|19900127` 女主角 / perfect-parry / 星辉之环: selected-control-variant-has-no-runnable-hit
- `actor|199002|19900201|1|19900210` 男主角 / charged-attack / 跃动之星: multiple-root-player-skill-variants
- `actor|199002|19900213|0|19900213` 男主角 / ultimate / 终将归于星海: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `actor|199002|19900222|2|19900227` 男主角 / perfect-parry / 星辉之环: selected-control-variant-has-no-runnable-hit
- `actor|199003|19900301|1|19900310` 诺诺 / charged-attack / 咻咻嘿咻: selected-control-variant-has-no-runnable-hit
- `actor|199003|19900313|0|19900313` 诺诺 / ultimate / 呼拉拉猛锤: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `actor|199003|19900321|0|19900321` 诺诺 / star-carry / 嘭咚锤: multiple-control-variants-without-root-selection
- `actor|199003|19900321|2|19900327` 诺诺 / perfect-parry / 嘭咚锤: multiple-control-variants-without-root-selection
- `kibo|500001|50000102|0|50000102` 迅狼 / signature / 迅风刃: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500002|50000202|0|50000202` 水灵仔 / signature / 水灵涟漪: base-function-unverified, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `kibo|500002|502015|0|502015` 水灵仔 / active / 水弹连射: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500002|50000203|0|50000203` 水灵仔 / break / 水灵仔-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500003|50000302|0|50000302` 水灵偶 / signature / 灵偶涟漪: base-function-unverified, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `kibo|500003|502019|0|502019` 水灵偶 / active / 漂浮水泡: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500003|50000303|0|50000303` 水灵偶 / break / 水灵偶-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500004|50000404|0|50000404` 汐灵偶 / signature / 潮汐涟漪: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `kibo|500004|502016|0|502016` 汐灵偶 / active / 大海浪: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500004|50000417|0|50000417` 汐灵偶 / break / 汐灵偶-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500005|501014|0|501014` 火灵仔 / active / 火球连射: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500006|501017|0|501017` 火灵偶 / active / 空降之焰: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500007|501016|0|501016` 焰灵偶 / active / 分裂之焰: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500020|503001|0|503001` 小雪狼 / active / 冰锥: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500020|50002004|0|50002004` 小雪狼 / break / 小雪狼-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500021|503006|0|503006` 冰速狼 / active / 寒冰碎片: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500022|503004|0|503004` 霜刃狼 / active / 冰矛连射: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500023|505013|0|505013` 苗鸡 / active / 种子飞弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500024|505006|0|505006` 菜鸡 / active / 灵木繁星: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500025|507003|0|507003` 拉加野猪 / active / 落雷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500026|50002616|0|50002616` 碧羽灵龙 / signature / 碧灵激流: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500026|505006|0|505006` 碧羽灵龙 / active / 灵木繁星: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500035|50003503|0|50003503` 叶冠驼 / signature / 治愈守护: base-function-unverified, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `kibo|500035|505004|0|505004` 叶冠驼 / active / 株连灵木: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500035|50003501|0|50003501` 叶冠驼 / break / 叶冠驼-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500037|501001|0|501001` 焰羊羊 / active / 火球: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500038|50003801|0|50003801` 尾火羊 / signature / 火焰踏击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500038|501003|0|501003` 尾火羊 / active / 烈焰弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500039|50003901|0|50003901` 炎灼角羊 / signature / 爆炎踏击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500039|501003|0|501003` 炎灼角羊 / active / 烈焰弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500040|506001|0|506001` 铁球蜥 / active / 岩锥: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500041|506001|0|506001` 三角蜥 / active / 岩锥: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500043|504012|0|504012` 小浮蝶 / active / 小风弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500044|504012|0|504012` 浮蝶 / active / 小风弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500045|504020|0|504020` 幻蝶 / active / 旋风回旋镖: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500046|50004604|0|50004604` 木灵苞 / signature / 木苞生长: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500046|505013|0|505013` 木灵苞 / active / 种子飞弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500047|50004705|0|50004705` 木灵朵 / signature / 灵朵绽放: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500047|505014|0|505014` 木灵朵 / active / 花绽飞弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500048|50004805|0|50004805` 蔓音花 / signature / 蔓音回响: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500048|505018|0|505018` 蔓音花 / active / 种子风暴: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500051|506001|0|506001` 岩甲蜥 / active / 岩锥: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500052|506008|0|506008` 穿甲蜥 / active / 岩固之盾: selected-control-variant-has-no-runnable-hit
- `kibo|500053|50005302|0|50005302` 钻山蜥 / signature / 钻山猛击: projectile-impact-frame-runtime-dependent
- `kibo|500053|506008|0|506008` 钻山蜥 / active / 岩固之盾: selected-control-variant-has-no-runnable-hit
- `kibo|500057|507001|0|507001` 猪古力 / active / 雷球: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500058|50005801|0|50005801` 焰翎龙 / signature / 焰翎利箭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500064|504001|0|504001` 柔风鹰 / active / 风刃: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500066|50006601|0|50006601` 兔耳鳐 / signature / 水流射击: trigger-frame-missing
- `kibo|500066|502004|0|502004` 兔耳鳐 / active / 毒液弹: trigger-frame-missing, base-function-unverified, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete, projectile-impact-frame-runtime-dependent
- `kibo|500067|502006|0|502006` 飞鳐 / active / 水弹散射: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500068|502003|0|502003` 星鳐 / active / 爆裂水球: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500072|503004|0|503004` 乌尔 / active / 冰矛连射: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500081|50008102|0|50008102` 碎冰兔 / signature / 碎冰寒矛: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500081|503007|0|503007` 碎冰兔 / active / 凛冬矛击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500081|50008104|0|50008104` 碎冰兔 / break / 碎冰兔-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500082|50008201|0|50008201` 雷冠牦 / signature / 雷冠之力: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500082|507008|0|507008` 雷冠牦 / active / 滚滚落雷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500083|501001|0|501001` 滚地犰 / active / 火球: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500085|50008503|0|50008503` 熔岩犰 / signature / 炽火陨星: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500093|50009305|0|50009305` 目绒兔 / signature / 紧急治疗: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `kibo|500095|509001|0|509001` 雾粘蛙 / active / 暗魂影: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500096|509002|0|509002` 雾球蛙 / active / 暗魂影爆阵: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500097|502010|0|502010` 水岩灵 / active / 唤潮: selected-control-variant-has-no-runnable-hit
- `kibo|500098|502010|0|502010` 水岩卫 / active / 唤潮: selected-control-variant-has-no-runnable-hit
- `kibo|500098|50009804|0|50009804` 水岩卫 / break / 水岩卫-合击: trigger-frame-missing
- `kibo|500110|505001|0|505001` 宝蓝雏龙 / active / 灵木弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500114|503009|0|503009` 冰灵仔 / active / 冰晶弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500115|503010|0|503010` 冰灵偶 / active / 冰晶散射: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500116|503018|0|503018` 霜灵偶 / active / 寒冰之罚: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500120|504001|0|504001` 哈加 / active / 风刃: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500123|504012|0|504012` 风灵苞 / active / 小风弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500124|504012|0|504012` 风灵朵 / active / 小风弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500125|504014|0|504014` 岚音花 / active / 风刃扩张: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500126|50012602|0|50012602` 风灵仔 / signature / 烈风: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500126|504012|0|504012` 风灵仔 / active / 小风弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500127|50012702|0|50012702` 风灵偶 / signature / 灵偶烈风: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500127|504012|0|504012` 风灵偶 / active / 小风弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500128|50012802|0|50012802` 岚灵偶 / signature / 激岚烈风: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500128|504014|0|504014` 岚灵偶 / active / 风刃扩张: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500129|507001|0|507001` 呼姆猴 / active / 雷球: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500130|507003|0|507003` 环尾猴 / active / 落雷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500131|507003|0|507003` 环影猴 / active / 落雷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500133|506001|0|506001` 加多利 / active / 岩锥: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500138|50013801|0|50013801` 红宝虫 / signature / 宝石飞射: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500138|501001|0|501001` 红宝虫 / active / 火球: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500139|50013901|0|50013901` 赤晶甲 / signature / 赤晶飞射: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500139|506005|0|506005` 赤晶甲 / active / 巨石投掷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500140|50014001|0|50014001` 炎晶甲 / signature / 炎晶爆袭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500140|506005|0|506005` 炎晶甲 / active / 巨石投掷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500147|505013|0|505013` 木灵仔 / active / 种子飞弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500147|50014704|0|50014704` 木灵仔 / break / 木灵仔-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500148|505014|0|505014` 木灵偶 / active / 花绽飞弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500148|50014804|0|50014804` 木灵偶 / break / 木灵偶-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500149|505017|0|505017` 蔓灵偶 / active / 地蔓突击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500149|50014904|0|50014904` 蔓灵偶 / break / 蔓灵偶-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500156|501001|0|501001` 火花雀 / active / 火球: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500156|50015604|0|50015604` 火花雀 / break / 火花雀-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500157|50015702|0|50015702` 焰火雀 / signature / 焰火旋风: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500157|501005|0|501005` 焰火雀 / active / 焰弹连发: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500157|50015704|0|50015704` 焰火雀 / break / 焰火雀-合击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500158|50015802|0|50015802` 火烈鹰 / signature / 烈火龙卷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500158|501005|0|501005` 火烈鹰 / active / 焰弹连发: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500164|507012|0|507012` 雷灵苞 / active / 电能子弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500165|507020|0|507020` 雷灵朵 / active / 连锁雷暴: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500166|507019|0|507019` 电音花 / active / 雷电惩戒: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500173|507012|0|507012` 雷灵仔 / active / 电能子弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500174|507020|0|507020` 雷灵偶 / active / 连锁雷暴: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500179|509001|0|509001` 竖耳蝠 / active / 暗魂影: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500180|509002|0|509002` 嘻哈蝠 / active / 暗魂影爆阵: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500181|509002|0|509002` 笑面蝠 / active / 暗魂影爆阵: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500185|50018502|0|50018502` 森彩灵蝶 / signature / 幻惑之风: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500185|504009|0|504009` 森彩灵蝶 / active / 旋风涡流: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500186|50018602|0|50018602` 布鲁达 / signature / 激浪旋冲: trigger-frame-missing
- `kibo|500186|502001|0|502001` 布鲁达 / active / 水弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500187|502007|0|502007` 蓝羽西格尼 / active / 泡泡攻击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500209|50020901|0|50020901` 森境鹿 / signature / 森境束缚: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete, projectile-impact-frame-runtime-dependent
- `kibo|500213|509001|0|509001` 菇噜噜 / active / 暗魂影: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500220|50022001|0|50022001` 星云伊欧 / signature / 星云连射: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500220|509010|0|509010` 星云伊欧 / active / 暗影连袭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500231|507003|0|507003` 铁鬃霸主 / active / 落雷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500244|501001|0|501001` 焰哞哞 / active / 火球: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500258|50025801|0|50025801` 小芽狐 / signature / 芽之息: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete, projectile-impact-frame-runtime-dependent
- `kibo|500258|505001|0|505001` 小芽狐 / active / 灵木弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500259|50025901|0|50025901` 蓬尾狐 / signature / 蓬尾之息: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete, projectile-impact-frame-runtime-dependent
- `kibo|500260|50026001|0|50026001` 萝冠灵狐 / signature / 萝冠之息: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete, projectile-impact-frame-runtime-dependent
- `kibo|500261|502001|0|502001` 河狸仔 / active / 水弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500262|502001|0|502001` 波河狸 / active / 水弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500263|502005|0|502005` 河狸大师 / active / 浪袭: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500304|50030401|0|50030401` 库库 / signature / 风旋: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500304|504012|0|504012` 库库 / active / 小风弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500304|50030404|0|50030404` 库库 / break / 库库-合击: multiple-control-variants-without-root-selection
- `kibo|500305|50030501|0|50030501` 库库尔 / signature / 大风旋: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500305|504020|0|504020` 库库尔 / active / 旋风回旋镖: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500306|50030601|0|50030601` 库库尔克 / signature / 与风共舞: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500306|504006|0|504006` 库库尔克 / active / 风龙卷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500313|50031302|0|50031302` 绒心布里尼 / signature / 绒心炸弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500313|501016|0|501016` 绒心布里尼 / active / 分裂之焰: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500322|50032201|0|50032201` 赛可洛 / signature / 卷风呼啸: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500322|504001|0|504001` 赛可洛 / active / 风刃: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500323|50032301|0|50032301` 托纳缇欧 / signature / 龙卷风暴: projectile-impact-frame-runtime-dependent
- `kibo|500324|50032401|0|50032401` 伊欧利安 / signature / 暴风旋引: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500324|504006|0|504006` 伊欧利安 / active / 风龙卷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500354|509001|0|509001` 小暮鸮 / active / 暗魂影: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500355|509002|0|509002` 夜猫鸮 / active / 暗魂影爆阵: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500357|504012|0|504012` 啵啵丁 / active / 小风弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500358|505011|0|505011` 绒绒云 / active / 森之守护: selected-control-variant-has-no-runnable-hit
- `kibo|500360|50036001|0|50036001` 怯影之翼 / signature / 血噬暗影: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete
- `kibo|500360|509002|0|509002` 怯影之翼 / active / 暗魂影爆阵: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500368|504012|0|504012` 小音浮 / active / 小风弹: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500369|507003|0|507003` 乐乐蛙 / active / 落雷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500370|507003|0|507003` 音霸蛙 / active / 落雷: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500399|50039901|0|50039901` 浮云 / signature / 绽源之云: base-function-unverified, trigger-frame-missing, hp:damage-formula-inputs-incomplete, toughness:pre-shield-damage-inputs-incomplete, projectile-impact-frame-runtime-dependent
- `kibo|500399|502007|0|502007` 浮云 / active / 泡泡攻击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500467|50046701|0|50046701` 小岩蹄 / signature / 震踪踏击: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500467|506001|0|506001` 小岩蹄 / active / 岩锥: trigger-frame-missing, projectile-impact-frame-runtime-dependent
- `kibo|500468|50046801|0|50046801` 重岩蹄 / signature / 震袭连踏: trigger-frame-missing, projectile-impact-frame-runtime-dependent

## 未关联非零回能元素

- linked-only-to-unresolved-public-action: 26
- not-referenced-by-public-action-control: 400
- referenced-only-by-unselected-control-variant: 76

逐项 source identity 与字段值见 `verified-combat-action-coverage.json#nonzeroRecoveryCoverage`。

> `unresolved` 不会进入运行时，也不会被写成 0；完整逐项原因见同名 JSON 报告。
