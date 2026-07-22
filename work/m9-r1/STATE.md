# M9-R1 State

Goal: make every public action schedulable without treating planning data as verified, resolve reliable projectiles under the explicit zero-distance scenario, and persist per-hit `willHit` choices.

Current product decisions:
- Separate `schedulable`, `sourceEvidenceStatus`, and `scenarioRuntimeStatus`.
- Projectile scenario defaults to `targetDistance=0`, `defaultWillHit=true`; impact equals a verified launch frame when travel is zero.
- Keep `projectile-impact-frame-runtime-dependent` in source audits.
- Known variant/animation durations must never be replaced by generic 30F. Generic 30F is only the final fallback for a missing control identity.
- Variant states are `partially-resolved`, `variant-condition-not-yet-modeled`, `static-evidence-gap`, or `runtime-dependent`, not one generic unresolved label.

Evidence already traced:
- Han Youyou control `10100301` has `CreateBulletBehaviorData` at frame 13, launches bullet `101003011`, whose collision action injects damage element `101003087` into the skill target.
- Timing audit: 34/35 top-level timing-unresolved actions have source duration evidence; only Misa A5 `10700205` lacks a timing variant.

Completed implementation:
1. The sync generator now emits scheduling contracts, all-owner variant discovery, launch contracts, stable scenario hit identities, and source/scenario coverage.
2. Runtime filters each hit through persisted `hitOverrides` while keeping cost, CD, pre-hit effects, and unrelated hits independent.
3. `combatScenario` and hit overrides persist through history, cycles, project drafts, local storage, JSON, share URLs, and PNG.
4. Coverage now reports 630 exact occupancies, 26 source-animation planning durations, and one generic planning duration (Misa A5 only); 455/562 public actions are scenario-runnable.

Verification:
- Focused unit tests and the six affected production-preview workflows pass.
- Full `npm run test:trial-release` passes 120 test files, 664 assertions, and 50/50 production-preview workflows.
- Workbench gzip is 369,273B and total JavaScript gzip is 726,492B.

Next: commit the focused M9-R1 changes and wait for product acceptance.
