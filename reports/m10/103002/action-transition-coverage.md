# 103002 动作衔接与派生闭包

- 公开动作：10
- 原始控制窗口：159
- 语义转移：37/37
- 仅索引未接入窗口：19
- 玩法影响缺口：0

## 已归一转移

| 来源 | 触发 | 输入窗 | 资源/印记 | 目标 | 语义 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| hidden-control 10300201/sub0 | input-window | [15,47) | - | ruby-normal-default-three-inputs / 普通攻击 A2 | continue-chain | applied |
| hidden-control 10300201/sub1 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E2 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300201/sub1 | input-window | [24,210) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E2 | continue-chain | applied |
| hidden-control 10300201/sub2 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E3 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300201/sub2 | input-window | [24,224) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E3 | continue-chain | applied |
| hidden-control 10300201/sub3 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E4 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300201/sub3 | input-window | [32,248) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E4 | continue-chain | applied |
| hidden-control 10300202/sub0 | input-window | [23,47) | - | ruby-normal-default-three-inputs / 普通攻击 A3 | continue-chain | applied |
| hidden-control 10300202/sub1 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E5 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300202/sub1 | input-window | [24,210) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E5 | continue-chain | applied |
| hidden-control 10300202/sub2 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E6 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300202/sub2 | input-window | [24,234) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E6 | continue-chain | applied |
| hidden-control 10300202/sub3 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E7 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300202/sub3 | input-window | [32,255) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E7 | continue-chain | applied |
| normal-attack 10300203/sub0 | input-window | [34,79) | - | ruby-enhanced-twelve-inputs / 强化普攻 E1 | replace-action-phase | applied |
| hidden-control 10300203/sub1 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E8 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300203/sub1 | input-window | [18,229) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E8 | continue-chain | applied |
| hidden-control 10300203/sub2 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E9 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300203/sub2 | input-window | [18,228) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E9 | continue-chain | applied |
| hidden-control 10300203/sub3 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E10 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300203/sub3 | input-window | [28,256) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E10 | continue-chain | applied |
| hidden-control 10300204/sub0 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E11 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300204/sub0 | input-window | [18,228) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E11 | continue-chain | applied |
| hidden-control 10300204/sub1 | state-activation | [3,243) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E12 | continue-chain | verified-action-variant-edge-ready |
| hidden-control 10300204/sub1 | input-window | [37,249) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E12 | continue-chain | applied |
| hidden-control 10300204/sub3 | state-activation | [5,245) | consume@0F | ruby-enhanced-twelve-inputs / 强化普攻 E11 | continue-chain | verified-action-variant-edge-ready |
| charged-attack 10300210/sub0 | state-activation | [24,144) | gain@24F | ruby-enhanced-twelve-inputs / 强化普攻 E1 | direct-entry | verified-action-variant-edge-ready |
| charged-attack 10300210/sub0 | state-activation | [24,264) | gain@24F | ruby-enhanced-twelve-inputs / 强化普攻 E1 | direct-entry | applied |
| hidden-control 10300210/sub1 | state-activation | [33,153) | - | ruby-enhanced-twelve-inputs / 强化普攻 E1 | direct-entry | verified-action-variant-edge-ready |
| hidden-control 10300210/sub2 | state-activation | [24,264) | gain@24F | ruby-enhanced-twelve-inputs / 强化普攻 E1 | direct-entry | verified-action-variant-edge-ready |
| hidden-control 10300210/sub2 | state-activation | [24,144) | gain@24F | ruby-enhanced-twelve-inputs / 强化普攻 E1 | direct-entry | verified-action-variant-edge-ready |
| star-skill 10300212/sub0 | state-activation | [0,240) | set-to-capacity@0F；tuning-mark:fire@0F | ruby-enhanced-twelve-inputs / 强化普攻 E1 | direct-entry | applied |
| ultimate 10300213/sub0 | state-activation | [297,417) | set-to-capacity@113F；action-effect:-@114F | ruby-enhanced-twelve-inputs / 强化普攻 E1 | direct-entry | verified-action-variant-edge-ready |
| ultimate 10300213/sub0 | state-activation | [329,537) | set-to-capacity@113F；action-effect:-@114F | ruby-enhanced-twelve-inputs / 强化普攻 E1 | direct-entry | applied |
| dodge-attack 10300215/sub0 | input-window | [30,246) | - | ruby-enhanced-twelve-inputs / null | resume-next-chain-segment | applied |
| star-carry 10300221/sub0 | input-window | [80,112) | tuning-mark:thunder@54F | ruby-enhanced-twelve-inputs / 强化普攻 E1 | direct-entry | applied |
| star-combo 10300226/sub0 | state-activation | [35,155) | - | ruby-enhanced-twelve-inputs / 强化普攻 E1 | direct-entry | verified-action-variant-edge-ready |

## 公开动作覆盖

| 动作 | control/sub | 转移 | 资源事务 | 调谐效果 | 状态 |
| --- | --- | ---: | ---: | ---: | --- |
| normal-attack | 10300203/sub0 | 1/1 | 0 | 0 | applied |
| charged-attack | 10300210/sub0 | 2/2 | 1 | 0 | applied |
| dodge-attack | 10300215/sub0 | 1/1 | 0 | 0 | applied |
| plunging-attack | 10300211/sub0 | 0/0 | 0 | 0 | not-applicable |
| star-skill | 10300212/sub0 | 1/1 | 1 | 1 | applied |
| star-combo | 10300226/sub0 | 1/1 | 0 | 0 | applied |
| ultimate | 10300213/sub0 | 2/2 | 1 | 0 | applied |
| star-carry | 10300221/sub0 | 1/1 | 0 | 1 | applied |
| limit-counter | 10300225/sub0 | 0/0 | 1 | 0 | applied |
| perfect-parry | 10300227/sub0 | 0/0 | 0 | 0 | not-applicable |
