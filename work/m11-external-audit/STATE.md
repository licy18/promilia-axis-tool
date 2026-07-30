# M11-R External Audit Remediation

## Goal

Close M11-01 through M11-09 against merged baseline `290da378944dde1f8e477022710044a74805b7fb` without starting M12 or changing UI, bundle, performance, or character scope.

## Branch And Worktree

- Branch: `fix/m11-external-audit-remediation`
- Worktree: `C:\Codex\AzPr Axis\.worktrees\promilia-m11-external-audit`
- Audit: `C:\Codex\AzPr Axis\doc\promilia-axis-m11-headless-audit-20260730.md`

## Current Status

- M11-01 through M11-09 are implemented in the shared Machine Axis and canonical runtime paths.
- Product contract allows duplicate Kibo species across different actors; cooldown and resources are isolated by `actorId+kiboId`.
- Final generated mechanics package hash is `55a275658a36358b490ba9730f214e15cf48e0e816912f6f92d263a1986a89f9`.
- The 120 second Machine Axis hashes are `a8dd9bfcdf4fad86 / 4e36871189392dc1 / 75fd655bba918b53 / 0b410dc9255d2654`.
- Headless focused regression is 18 files / 138 tests passed; eight deterministic audits are clean and production build passes.
- Remediation disposition is recorded in `reports/m11/m11-external-audit-remediation-20260730.{json,md}`.
- Next: stage only remediation files, commit, then build and clean-room smoke a new merged-only audit package from that commit.

## Done Criteria

- M11-01 through M11-09 have code, focused tests, disposition, and explicit remaining evidence boundaries.
- Headless/core regressions and all data/evidence audits pass without treating performance or bundle size as blockers.
- One focused remediation commit exists.
- A new merged-only audit directory and ZIP are generated, verified from a clean extraction, and pass CLI catalog/validate/simulate/explain/compare smoke.
- Stop at external re-review; M12 remains locked.

## Do Not Repeat

- Do not repair in the dirty main worktree or in pre-merge character/kibo branches.
- Do not preserve rejected behavioral hashes as expected truth.
- Do not infer evidence closure from scenario assumptions.
- Do not overwrite the rejected audit snapshot.
