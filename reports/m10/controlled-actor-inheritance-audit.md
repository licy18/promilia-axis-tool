# Controlled-actor inheritance field audit

Status: `verified-element-inheritance-field-audit-ready`

## Field contract

- Controlled-actor transfer is gated only by `inheritType`.
- `inherit` is retained as `isTeamElement` evidence and does not gate transfer.

## Nonzero inheritType matrix

- Self / team=true: 70
- Self / team=false: 2
- Source / team=true: 4
- Source / team=false: 6

## Fixed-owner negative regressions

- 101010206: team=true, inheritType=0, expected=fixed-owner-no-controlled-actor-transfer
- 103002275: team=true, inheritType=0, expected=fixed-owner-no-controlled-actor-transfer

## Legacy unreachable evidence

- 101010030: legacy-unreachable-evidence; no-current-skill-list-or-reachable-character-combat-contract-reference
- 101010039: legacy-unreachable-evidence; no-current-skill-list-or-reachable-character-combat-contract-reference
- 101010081: legacy-unreachable-evidence; no-current-skill-list-or-reachable-character-combat-contract-reference
- 103002040: legacy-unreachable-evidence; no-current-skill-list-or-reachable-character-combat-contract-reference
- 103002079: legacy-unreachable-evidence; no-current-skill-list-or-reachable-character-combat-contract-reference
- 103002157: legacy-unreachable-evidence; no-current-skill-list-or-reachable-character-combat-contract-reference
