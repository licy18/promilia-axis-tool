# M11-R2 External Audit Remediation

## Goal

Close the short rereview findings against `6601ebd1d53748fc4eaeea3ecf3dec9fc891cce6`: upstream M11-09 source ordering, valued CLI options, and canonical warning paths. M11-01 through M11-08 remain externally closed.

## Branch And Worktree

- Branch: `fix/m11-external-audit-r2`
- Worktree: `C:\Codex\AzPr Axis\.worktrees\promilia-m11-external-audit-r2`
- Rereview: `C:\Codex\AzPr Axis\doc\promilia-axis-m11-headless-rereview-6601ebd1d537-20260731.md`
- Counterexample: `C:\Codex\AzPr Axis\doc\recheck-m11-6601.mjs`

## Current Status

- Raw Machine Axis array order is recorded before compile and propagated as source sequence through derived actions and runtime.
- Renaming only action IDs preserves Kibo then actor execution and produces `468 / 468` HP damage in the external counterexample.
- CLI valued-option failures return exit 2 before I/O; warning paths resolve to plan indexes 1 and 15.
- Product contract allows duplicate Kibo species across different actors; cooldown and resources are isolated by `actorId+kiboId`.
- Final generated mechanics package hash is `55a275658a36358b490ba9730f214e15cf48e0e816912f6f92d263a1986a89f9`.
- The 120 second Machine Axis hashes are `c91f9da64e02ef84 / 4e36871189392dc1 / d10c45fb73dc7c6f / 0b410dc9255d2654`.
- Headless focused regression is 22 files / 195 tests passed; axis boundary is 23/23 and Machine Axis boundary/CLI is 40/40.
- Eight deterministic audits are clean and production build passes.
- Remediation disposition is recorded in `reports/m11/m11-external-audit-remediation-20260730.{json,md}`.
- Next: commit R2, then build and clean-room smoke a new merged-only audit package and run the external counterexample against its extraction.

## Done Criteria

- M11-09/P2/P3 have code, focused tests, disposition, and explicit remaining evidence boundaries.
- Headless/core regressions and all data/evidence audits pass without treating performance or bundle size as blockers.
- One focused remediation commit exists.
- A new merged-only audit directory and ZIP are generated, verified from a clean extraction, and pass CLI catalog/validate/simulate/explain/compare smoke.
- Stop at external short rereview; M12 remains locked.

## Do Not Repeat

- Do not repair in the dirty main worktree or in pre-merge character/kibo branches.
- Do not preserve rejected behavioral hashes as expected truth.
- Do not infer evidence closure from scenario assumptions.
- Do not overwrite the rejected audit snapshot.
