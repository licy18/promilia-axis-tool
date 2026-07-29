# M9-R2 全角色派生控制覆盖

- 包：`azpr-tc-2026-07-18`
- 固定分母：20 名角色 / 155 个公开动作引用 / 138 个派生 control / 261 个 player/resourceMap 变体
- 控制源：combined=11，input-controlled=110，not-yet-modeled=16，state-controlled=1
- 解析状态：applied=6，not-yet-modeled=30，partially-resolved=99，static-evidence-gap=3
- 输入选择器：6/23 已建立明确 public variant → subskill 关系
- 静默遗漏：0

## Owner / 动作类型

| Owner | 动作类型 | control | 控制源 | 解析状态 |
| ---: | --- | ---: | --- | --- |
| 101003 | charged-attack | 1 | input-controlled=1 | applied=1 |
| 101003 | normal-attack | 4 | input-controlled=4 | partially-resolved=4 |
| 101007 | charged-attack | 1 | input-controlled=1 | applied=1 |
| 101007 | dodge-attack | 1 | input-controlled=1 | partially-resolved=1 |
| 101007 | normal-attack | 4 | combined=1<br>input-controlled=3 | partially-resolved=4 |
| 101007 | star-carry | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 101007 | star-skill | 1 | state-controlled=1 | static-evidence-gap=1 |
| 101010 | charged-attack | 1 | combined=1 | partially-resolved=1 |
| 101010 | dodge-attack | 1 | input-controlled=1 | partially-resolved=1 |
| 101010 | normal-attack | 5 | combined=1<br>input-controlled=4 | partially-resolved=5 |
| 101010 | ultimate | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 102001 | charged-attack | 1 | input-controlled=1 | partially-resolved=1 |
| 102001 | limit-counter | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 102001 | normal-attack | 4 | input-controlled=4 | partially-resolved=4 |
| 102001 | perfect-parry | 1 | input-controlled=1 | partially-resolved=1 |
| 102001 | star-skill | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 103002 | charged-attack | 1 | input-controlled=1 | partially-resolved=1 |
| 103002 | limit-counter | 1 | combined=1 | partially-resolved=1 |
| 103002 | normal-attack | 5 | combined=4<br>input-controlled=1 | partially-resolved=5 |
| 103002 | star-carry | 1 | input-controlled=1 | partially-resolved=1 |
| 103002 | star-combo | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 103002 | star-skill | 1 | input-controlled=1 | partially-resolved=1 |
| 103002 | ultimate | 1 | input-controlled=1 | partially-resolved=1 |
| 107001 | charged-attack | 1 | input-controlled=1 | not-yet-modeled=1 |
| 107001 | dodge-attack | 1 | input-controlled=1 | not-yet-modeled=1 |
| 107001 | limit-counter | 1 | input-controlled=1 | not-yet-modeled=1 |
| 107001 | normal-attack | 3 | input-controlled=3 | not-yet-modeled=3 |
| 107001 | plunging-attack | 1 | input-controlled=1 | not-yet-modeled=1 |
| 107001 | star-combo | 1 | combined=1 | static-evidence-gap=1 |
| 107001 | star-skill | 1 | input-controlled=1 | not-yet-modeled=1 |
| 107001 | ultimate | 1 | combined=1 | static-evidence-gap=1 |
| 107002 | dodge-attack | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 107002 | limit-counter | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 107002 | normal-attack | 3 | input-controlled=3 | partially-resolved=3 |
| 107002 | star-combo | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 107002 | star-skill | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 107003 | charged-attack | 1 | input-controlled=1 | applied=1 |
| 107003 | normal-attack | 4 | input-controlled=4 | partially-resolved=4 |
| 107003 | star-carry | 1 | input-controlled=1 | partially-resolved=1 |
| 107003 | star-combo | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 107003 | star-skill | 1 | input-controlled=1 | partially-resolved=1 |
| 108001 | charged-attack | 1 | input-controlled=1 | not-yet-modeled=1 |
| 108001 | dodge-attack | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 108001 | normal-attack | 4 | input-controlled=4 | partially-resolved=4 |
| 108002 | charged-attack | 1 | input-controlled=1 | not-yet-modeled=1 |
| 108002 | limit-counter | 1 | input-controlled=1 | partially-resolved=1 |
| 108002 | normal-attack | 3 | input-controlled=3 | partially-resolved=3 |
| 108002 | star-skill | 1 | input-controlled=1 | partially-resolved=1 |
| 108003 | charged-attack | 1 | input-controlled=1 | not-yet-modeled=1 |
| 108003 | normal-attack | 2 | input-controlled=2 | partially-resolved=2 |
| 108005 | charged-attack | 1 | input-controlled=1 | partially-resolved=1 |
| 108005 | normal-attack | 2 | input-controlled=2 | partially-resolved=2 |
| 109001 | normal-attack | 4 | input-controlled=4 | partially-resolved=4 |
| 109002 | charged-attack | 1 | input-controlled=1 | not-yet-modeled=1 |
| 109002 | limit-counter | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 109002 | normal-attack | 4 | input-controlled=4 | partially-resolved=4 |
| 109002 | star-carry | 1 | input-controlled=1 | partially-resolved=1 |
| 111001 | charged-attack | 1 | input-controlled=1 | partially-resolved=1 |
| 111001 | normal-attack | 5 | combined=1<br>input-controlled=4 | partially-resolved=5 |
| 111001 | star-carry | 1 | input-controlled=1 | partially-resolved=1 |
| 111001 | star-skill | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 111001 | ultimate | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 112001 | charged-attack | 1 | input-controlled=1 | applied=1 |
| 112001 | limit-counter | 1 | input-controlled=1 | partially-resolved=1 |
| 112001 | normal-attack | 5 | input-controlled=5 | partially-resolved=5 |
| 112001 | star-carry | 1 | input-controlled=1 | partially-resolved=1 |
| 112001 | star-skill | 1 | input-controlled=1 | partially-resolved=1 |
| 112001 | ultimate | 1 | input-controlled=1 | partially-resolved=1 |
| 112002 | charged-attack | 1 | input-controlled=1 | not-yet-modeled=1 |
| 112002 | normal-attack | 3 | input-controlled=3 | partially-resolved=3 |
| 199001 | charged-attack | 1 | input-controlled=1 | applied=1 |
| 199001 | normal-attack | 5 | input-controlled=5 | partially-resolved=5 |
| 199001 | star-skill | 1 | input-controlled=1 | partially-resolved=1 |
| 199002 | charged-attack | 1 | input-controlled=1 | applied=1 |
| 199002 | normal-attack | 5 | input-controlled=5 | partially-resolved=5 |
| 199002 | star-skill | 1 | input-controlled=1 | partially-resolved=1 |
| 199003 | charged-attack | 1 | input-controlled=1 | not-yet-modeled=1 |
| 199003 | normal-attack | 4 | input-controlled=4 | partially-resolved=4 |
| 199003 | perfect-parry | 1 | not-yet-modeled=1 | not-yet-modeled=1 |
| 199003 | star-carry | 1 | not-yet-modeled=1 | not-yet-modeled=1 |

## 待收口合同

- `actor:101003|control:10100301|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:101003|control:10100302|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:101003|control:10100303|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:101003|control:10100304|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:101007|control:10100701|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:101007|control:10100702|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:101007|control:10100703|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:101007|control:10100704|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:101007|control:10100712|derived-control` star-skill：static-evidence-gap；switch-duration-unresolved, switch-wrapper-relation-unresolved, effect-trigger-frame-static-evidence-gap, effect-target-static-evidence-gap
- `actor:101007|control:10100715|derived-control` dodge-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:101007|control:10100721|derived-control` star-carry：not-yet-modeled；derived-control-source-not-yet-modeled
- `actor:101010|control:10101001|derived-control` normal-attack：partially-resolved；effect-trigger-frame-static-evidence-gap, effect-target-static-evidence-gap, switch-duration-unresolved, switch-wrapper-relation-unresolved, event-bridge-input-semantics-partially-modeled
- `actor:101010|control:10101002|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:101010|control:10101003|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:101010|control:10101004|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:101010|control:10101005|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:101010|control:10101010|derived-control` charged-attack：partially-resolved；switch-duration-unresolved, switch-wrapper-relation-unresolved, effect-trigger-frame-static-evidence-gap, effect-target-static-evidence-gap, input-selector-to-subskill-relation-not-yet-modeled
- `actor:101010|control:10101013|derived-control` ultimate：not-yet-modeled；derived-control-source-not-yet-modeled
- `actor:101010|control:10101015|derived-control` dodge-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:102001|control:10200101|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:102001|control:10200102|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:102001|control:10200103|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:102001|control:10200104|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:102001|control:10200110|derived-control` charged-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:102001|control:10200112|derived-control` star-skill：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:102001|control:10200125|derived-control` limit-counter：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:102001|control:10200127|derived-control` perfect-parry：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300201|derived-control` normal-attack：partially-resolved；switch-wrapper-relation-unresolved, effect-trigger-frame-static-evidence-gap, effect-target-static-evidence-gap, event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300202|derived-control` normal-attack：partially-resolved；switch-wrapper-relation-unresolved, effect-trigger-frame-static-evidence-gap, effect-target-static-evidence-gap, event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300203|derived-control` normal-attack：partially-resolved；switch-wrapper-relation-unresolved, effect-trigger-frame-static-evidence-gap, effect-target-static-evidence-gap, event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300204|derived-control` normal-attack：partially-resolved；switch-wrapper-relation-unresolved, effect-trigger-frame-static-evidence-gap, effect-target-static-evidence-gap, event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300205|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300210|derived-control` charged-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300212|derived-control` star-skill：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300213|derived-control` ultimate：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300221|derived-control` star-carry：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300225|derived-control` limit-counter：partially-resolved；switch-target-control-variant-missing, switch-wrapper-relation-unresolved, effect-trigger-frame-static-evidence-gap, effect-target-static-evidence-gap, event-bridge-input-semantics-partially-modeled
- `actor:103002|control:10300226|derived-control` star-combo：not-yet-modeled；derived-control-source-not-yet-modeled
- `actor:107001|control:10700101|derived-control` normal-attack：not-yet-modeled；input-selector-to-subskill-relation-not-yet-modeled
- `actor:107001|control:10700102|derived-control` normal-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, input-selector-to-subskill-relation-not-yet-modeled
- `actor:107001|control:10700103|derived-control` normal-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, input-selector-to-subskill-relation-not-yet-modeled
- `actor:107001|control:10700110|derived-control` charged-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, input-selector-to-subskill-relation-not-yet-modeled
- `actor:107001|control:10700111|derived-control` plunging-attack：not-yet-modeled；input-selector-to-subskill-relation-not-yet-modeled
- `actor:107001|control:10700112|derived-control` star-skill：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, input-selector-to-subskill-relation-not-yet-modeled
- `actor:107001|control:10700113|derived-control` ultimate：static-evidence-gap；switch-duration-unresolved, switch-wrapper-relation-unresolved, effect-trigger-frame-static-evidence-gap, effect-target-static-evidence-gap, input-selector-to-subskill-relation-not-yet-modeled
- `actor:107001|control:10700115|derived-control` dodge-attack：not-yet-modeled；input-selector-to-subskill-relation-not-yet-modeled
- `actor:107001|control:10700125|derived-control` limit-counter：not-yet-modeled；input-selector-to-subskill-relation-not-yet-modeled
- `actor:107001|control:10700126|derived-control` star-combo：static-evidence-gap；switch-duration-unresolved, switch-wrapper-relation-unresolved, effect-trigger-frame-static-evidence-gap, effect-target-static-evidence-gap, input-selector-to-subskill-relation-not-yet-modeled
- `actor:107002|control:10700201|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:107002|control:10700202|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:107002|control:10700203|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:107002|control:10700212|derived-control` star-skill：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:107002|control:10700215|derived-control` dodge-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:107002|control:10700225|derived-control` limit-counter：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:107002|control:10700226|derived-control` star-combo：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:107003|control:10700301|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:107003|control:10700302|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:107003|control:10700303|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:107003|control:10700304|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:107003|control:10700312|derived-control` star-skill：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:107003|control:10700321|derived-control` star-carry：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:107003|control:10700326|derived-control` star-combo：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:108001|control:10800101|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108001|control:10800102|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108001|control:10800103|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108001|control:10800104|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:108001|control:10800110|derived-control` charged-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, input-selector-to-subskill-relation-not-yet-modeled
- `actor:108001|control:10800115|derived-control` dodge-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:108002|control:10800201|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108002|control:10800202|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108002|control:10800203|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108002|control:10800210|derived-control` charged-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, input-selector-to-subskill-relation-not-yet-modeled
- `actor:108002|control:10800212|derived-control` star-skill：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108002|control:10800225|derived-control` limit-counter：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108003|control:10800301|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108003|control:10800302|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108003|control:10800310|derived-control` charged-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, input-selector-to-subskill-relation-not-yet-modeled
- `actor:108005|control:10800501|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108005|control:10800502|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:108005|control:10800510|derived-control` charged-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:109001|control:10900101|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:109001|control:10900102|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:109001|control:10900103|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:109001|control:10900104|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:109002|control:10900201|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:109002|control:10900202|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:109002|control:10900203|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:109002|control:10900204|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:109002|control:10900210|derived-control` charged-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, input-selector-to-subskill-relation-not-yet-modeled
- `actor:109002|control:10900221|derived-control` star-carry：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:109002|control:10900225|derived-control` limit-counter：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:111001|control:11100101|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:111001|control:11100102|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:111001|control:11100103|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:111001|control:11100104|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:111001|control:11100105|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:111001|control:11100110|derived-control` charged-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:111001|control:11100112|derived-control` star-skill：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:111001|control:11100113|derived-control` ultimate：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:111001|control:11100121|derived-control` star-carry：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:112001|control:11200101|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:112001|control:11200102|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:112001|control:11200103|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:112001|control:11200104|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:112001|control:11200105|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:112001|control:11200112|derived-control` star-skill：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:112001|control:11200113|derived-control` ultimate：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:112001|control:11200121|derived-control` star-carry：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:112001|control:11200125|derived-control` limit-counter：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:112002|control:11200201|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:112002|control:11200202|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:112002|control:11200203|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:112002|control:11200210|derived-control` charged-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, input-selector-to-subskill-relation-not-yet-modeled
- `actor:199001|control:19900101|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:199001|control:19900102|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199001|control:19900103|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199001|control:19900104|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199001|control:19900105|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199001|control:19900112|derived-control` star-skill：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199002|control:19900201|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:199002|control:19900202|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199002|control:19900203|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199002|control:19900204|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199002|control:19900205|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199002|control:19900212|derived-control` star-skill：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199003|control:19900301|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199003|control:19900302|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199003|control:19900303|derived-control` normal-attack：partially-resolved；variant-condition-source-families-audited-not-yet-modeled, event-bridge-input-semantics-partially-modeled
- `actor:199003|control:19900304|derived-control` normal-attack：partially-resolved；event-bridge-input-semantics-partially-modeled
- `actor:199003|control:19900310|derived-control` charged-attack：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, input-selector-to-subskill-relation-not-yet-modeled
- `actor:199003|control:19900321|derived-control` star-carry：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled
- `actor:199003|control:19900327|derived-control` perfect-parry：not-yet-modeled；variant-condition-source-families-audited-not-yet-modeled, derived-control-source-not-yet-modeled

> `not-yet-modeled` 表示实现覆盖尚未完成；`static-evidence-gap` 与 `runtime-dependent` 才表示证据或运行时输入边界。完整条件、变体时长和 source identity 见同名 JSON。
