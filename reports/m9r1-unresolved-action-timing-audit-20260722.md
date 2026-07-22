# M9-R1 Remaining Action Timing Audit

Basis: `ecd0ec3`, `reports/verified-combat-action-timing-coverage.json` and `reports/verified-combat-action-coverage.json` generated on 2026-07-22.

## Summary

- Public actions: 562 total, 527 timing-applied, 35 timing-unresolved.
- The 35 top-level unresolved actions are 22 non-normal actions plus 13 normal-attack chains.
- All 22 non-normal actions have exact 60fps animation durations for every control/player variant. They are unresolved because the public action has not selected one variant and the variant durations differ.
- The 13 normal-attack chains are unresolved because 31 of 95 A1..An segments lack a verified input occupancy end.
- Of those 31 segments, 30 have source-backed animation duration. Only Misa A5 has no skill-player/resource-map timing variant at all.
- Therefore the remaining gap is primarily variant/transition resolution, not absent animation data. A generic 30F fallback would discard known client timing for 34 of 35 actions.

## 22 Non-Normal Actions With Known Variant Durations

Reason for every row: `control-player-variant-duration-not-invariant`. Each listed number is an exact source animation duration in frames at 60fps; the missing fact is which variant applies for the current state/input.

| Owner | Action | Control | Variant durations (frames) |
| --- | --- | ---: | --- |
| Tushan Xiaoyu | Charged attack | 10101010 | 310 / 230 / 250 |
| Lili | Charged attack | 10200110 | 225 / 156 / 254 / 225 |
| Lili | Perfect parry | 10200127 | 230 / 156 / 225 |
| Misa | Dodge attack | 10700215 | 139 / 122 |
| Misa | Star skill | 10700212 | 336 / 402 |
| Misa | Star combo | 10700226 | 218 / 426 |
| Misa | Limit counter | 10700225 | 186 / 189 |
| Abi | Star-carry | 10700321 | 266 / 353 |
| Terara | Charged attack | 10800110 | 190 / 317 / 197 / 190 / 280 |
| Luluca | Charged attack | 10800210 | 340 / 151 / 162 / 271 / 271 |
| Miti | Charged attack | 10800310 | 209 / 86 |
| Kataru | Charged attack | 10800510 | 139 / 203 / 385 |
| Falanta | Charged attack | 11100110 | 265 / 131 / 351 |
| Falanta | Ultimate | 11100113 | 310 / 120 |
| Giselle | Charged attack | 11200110 | 309 / 294 / 294 / 156 / 156 |
| Giselle | Limit counter | 11200125 | 240 / 168 / 251 |
| Anis | Charged attack | 11200210 | 290 / 242 / 97 |
| Female protagonist | Charged attack | 19900110 | 170 / 220 |
| Male protagonist | Charged attack | 19900210 | 240 / 213 |
| Nono | Star-carry | 19900321 | 243 / 220 |
| Nono | Perfect parry | 19900327 | 239 / 234 |
| Kuku | Break/joint attack | 50030404 | 95 / 133 |

## 13 Unresolved Normal-Attack Chains

The top-level chain is unresolved when any listed segment is unresolved.

| Owner | Unresolved segments |
| --- | --- |
| Pengpeng | A1, A4 |
| Tushan Xiaoyu | A1, A2, A4, A5 |
| Ruby | A1, A2, A3, A4, A5 |
| Sifriya | A2, A3, A4, A5 |
| Misa | A4, A5 |
| Abi | A4 |
| Luluca | A3, A4, A5 |
| Xia'er | A2 |
| Falanta | A1, A2, A5 |
| Giselle | A1 |
| Anis | A3, A4, A5 |
| Female protagonist | A1 |
| Male protagonist | A1 |

## 31 Segment Primary Causes

### Six segments: all variant occupancies are known but differ

Reason: `control-player-variant-duration-not-invariant`. Variant selection is missing; timing extraction itself succeeded.

- Pengpeng A4: 65 / 96 / 83 / 82 / 82 / 62F.
- Tushan Xiaoyu A2: 35 / 28F; A4: 30 / 99F; A5: 80 / 72F.
- Ruby A5: 44 / 43 / 74F.
- Giselle A1: 18 / 25F.

### Thirteen segments: at least one variant lacks the required input window

Reason: `control-player-variant-duration-unresolved`. Some or all variants lack a matching transition/reopen EventBridge, so the aggregate cannot be invariant.

- Tushan Xiaoyu A1: 20 / unresolved / 22F.
- Ruby A1: 15 / unresolved / unresolved / unresolved; A2: 23 / unresolved / unresolved / unresolved; A3: all four unresolved; A4: four unresolved plus one 33F variant.
- Sifriya A2: four unresolved plus one 23F variant; A3: all five unresolved.
- Xia'er A2: unresolved / 42 / 44F.
- Falanta A1: 21 / 95 / unresolved / 95 / 95 / unresolved / 95F; A2: 42F plus four unresolved; A5: both variants rejected by the current window rule.
- Female protagonist A1: 20F plus one unresolved variant.
- Male protagonist A1: 20F plus one unresolved variant.

### Eleven segments: selected variant is known, but its occupancy window is missing

Reason: `selected-control-player-variant-duration-unresolved`. All rows still have source animation length; the missing fact is the next legal attack/reopen frame.

- Pengpeng A1: animation variants 199 / 288 / 137F.
- Sifriya A4: 100F; A5: 100F.
- Misa A4: 289F.
- Abi A4: 192F.
- Luluca A3: 151F; A4: 100F; A5: 100F.
- Anis A3: 254F; A4: 100F; A5: 100F.

### One segment: timing variant absent

- Misa A5 (`10700205`): `skill-control-player-variant-missing` / `control-has-no-resource-map-variant`. This is the only segment without a source skill-player/resource-map duration and requires finding the actual linked control or confirming it is not an independently playable A segment.

## EventBridge Cause Counts

These overlap the primary groups above.

- 20 segments: `next-control-event-bridge-window-unavailable`. No EventBridge in the candidate variant points to the next A control, so the earliest legal next click cannot be proven.
- 3 terminal segments: `attack-reopen-event-bridge-window-unavailable` (Sifriya A5, Luluca A5, Anis A5). No `allowAttack` reopen window was found; all three still have 100F animation duration.
- 1 segment: `input-window-ends-before-final-hit` (Falanta A5). The parser chooses an early reopen window at 31-34F while the last verified hit is at 35F, even though a later reopen window starts at 58F. This is a resolver defect and should select the first valid window after the final hit instead of leaving the segment unresolved.

## Required Resolution Order

1. Fix Falanta A5 window selection; it is a deterministic parser defect.
2. Feed ActionVariantGraph/resource/input conditions into the 22 non-normal actions and the six fully known A segments; do not use planning fallback for them.
3. For the remaining 24 A segments with known animation but missing link/reopen evidence, inspect parent-chain transitions and alternate behavior tracks. If no occupancy window exists, retain source animation duration as an explicitly labeled planning duration rather than replacing it with 30F.
4. Trace Misa A5 to its actual control/derived action identity. Only this row currently qualifies for a generic last-resort planning duration.
