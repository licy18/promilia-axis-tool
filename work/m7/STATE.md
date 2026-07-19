# M7 State

Goal: map the current public actor and kibo action catalogs to verified HP, toughness, actor SP, and kibo SP runtime inputs without silent omissions.

Baseline: `d8f567e`; M6-R2 absolute SP contract (`0..100`) is immutable.

Done criteria:

- independent public action universe, fully classified as applied, verified-zero, or unresolved;
- generated action/variant/hit mappings with exact source identities;
- generic runtime and eight-curve coverage across actors, action kinds, and kibos;
- JSON and Markdown coverage reports, full trial-release, desktop/narrow screenshots;
- focused commit, then stop for product review.

Current status: M7 implementation and release validation are complete; documentation and commit are being finalized before product review.

Audit findings:

- public denominator: 562 top-level actions (196 actor / 366 kibo), 592 public variants, 20 actors, and 122 kibos;
- 318 actions are runnable and 244 are unresolved; all 562 are explicitly classified;
- 1,174 source hit nodes are audited and 1,028 complete action-hit bindings are published;
- 667 nonzero Battle recovery elements are all linked or listed as unresolved with structured reasons;
- package generation keeps control/resource-map variants separate and includes both direct and bullet element references;
- generic runtime preserves source actor 100%, teammate 50%, equipped kibo 100%, interval identity, and absolute `0..100` SP clipping.

Verification so far:

- focused package/runtime/action-library/replay tests: 4 files, 27 tests passed;
- cross-catalog exact vectors: Han star skill 7 hits / 459 HP / 321 toughness, Muyin charged 3 / 359 / 350, kibo 500001 active 6 / 3030 / 606;
- all five project carriers rebuild identical cross-catalog binding, damage, resource, and sparse display signatures.

Final validation:

- full trial release: 105 test files / 586 tests and 47/47 production preview passed;
- all production data, action status, verified combat, applied-source, and diff guards passed;
- total JavaScript gzip: 739,564B; Workbench: 365,560B;
- screenshots: `reports/m7-catalog-runtime-desktop.png` and `reports/m7-catalog-runtime-narrow.png`.

Next step: commit the focused M7 change set and stop for product review. Do not create the next milestone automatically.

Constraints: no manual per-skill mappings, no fabricated zero values, no equipment/cultivation callbacks, no package-size work unless the final hard limit fails.
