import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hashCanonicalValue } from '../../../src/simulation/headless/canonicalSerialization.js';
import { validateOptimizationObjectAliasAcceptanceBundle } from '../../../src/character-acceptance/optimizationObjectAliasProtocol.js';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const evidenceCommit = '829d628bff9476c489d03e152e9377fd8c8e9e3c';
const signedAt = '2026-08-13T20:03:05.0616267+08:00';
const cases = [
  [101010, 'm11-d-101010-visual-acceptance'],
  [102001, 'm12-b3-102001-zero-distance-acceptance'],
  [103002, 'm12-b3-103002-reload-window-boundaries'],
  [107001, 'm12-b3-107001-focused-acceptance'],
  [107002, 'm12-b3-107002-reduced-action-surface-acceptance'],
  [108003, 'm12-b3-e20-2-108003-s1-visual-acceptance'],
  [109001, 'm11-d-109001-visual-acceptance'],
  [112001, 'm12-b3-112001-assumption-v1-focused-acceptance'],
  [199001, 'm12-b3-starborn-199001-focused-acceptance'],
  [199002, 'm12-b3-starborn-199002-focused-acceptance'],
];

const index = await readJson(
  path.join(
    repositoryRoot,
    'src/data/generated/character-acceptance-manifest-index.json'
  )
);
const entries = new Map(
  index.entries.map(entry => [Number(entry.ownerId), entry])
);
const summaryRows = [];

for (const [ownerId, scenarioIdentity] of cases) {
  const entry = entries.get(ownerId);
  if (!entry)
    throw new Error(`Missing generated manifest index entry for ${ownerId}`);

  const manifestPath = path.join(
    repositoryRoot,
    `reports/m11/character-acceptance/${ownerId}/manifest.json`
  );
  const manifest = await readJson(manifestPath);
  const scenario = manifest.scenarioCases.records.find(
    row => row.scenarioIdentity === scenarioIdentity
  );
  if (!scenario)
    throw new Error(`Missing scenario ${scenarioIdentity} for ${ownerId}`);

  const reviewPath = path.join(
    import.meta.dirname,
    'visual-evidence',
    `20260813-692c769c-${ownerId}-review.json`
  );
  const review = await readJson(reviewPath);
  if (
    review.ownerId !== ownerId ||
    review.chargedInputAuthority?.status !== 'applied'
  ) {
    throw new Error(`Visual review mismatch for ${ownerId}`);
  }

  const scenarioIdentities = [scenarioIdentity];
  const scenarioSetHash = hashCanonicalValue([
    { scenarioIdentity, scenarioCaseHash: scenario.scenarioCaseHash },
  ]);
  const recipePath = path.join(
    repositoryRoot,
    `scripts/character-acceptance/acceptance-recipes/${ownerId}.json`
  );
  const recipe = await readJson(recipePath);
  const priorAcceptance = recipe.productVisualAcceptance ?? {};
  const automatedEvidence = {
    scenarioIdentity,
    evidenceKind: 'workbench-playwright-screenshot',
    status: 'automated-workbench-import-passed',
    screenshotPath: review.automatedEvidence.traceScreenshotPath,
    screenshotSha256: review.automatedEvidence.traceScreenshotSha256,
  };
  const priorAutomatedEvidence = [
    ...(priorAcceptance.supersededAutomatedEvidence ?? []),
    ...(priorAcceptance.automatedEvidence ?? []),
  ].filter(
    evidence =>
      evidence.screenshotPath !== automatedEvidence.screenshotPath ||
      evidence.screenshotSha256 !== automatedEvidence.screenshotSha256
  );
  const supersededAutomatedEvidence = [
    ...new Map(
      priorAutomatedEvidence.map(evidence => [
        JSON.stringify(evidence),
        evidence,
      ])
    ).values(),
  ];
  const qualificationSubjectHash = String(
    manifest.qualificationSubjectHash ?? ''
  );
  if (!/^[0-9a-f]{16}$/.test(qualificationSubjectHash)) {
    throw new Error(`Invalid qualification subject hash for ${ownerId}`);
  }
  const recordIdentity =
    `character-product-acceptance:${ownerId}:${evidenceCommit}:` +
    qualificationSubjectHash;
  recipe.productVisualAcceptance = {
    status: 'accepted',
    acceptanceCommit: evidenceCommit,
    recordIdentity,
    qualificationSubjectHash,
    scenarioSetHash,
    scenarioIdentities,
    automatedEvidence: [automatedEvidence],
    ...(supersededAutomatedEvidence.length > 0
      ? { supersededAutomatedEvidence }
      : {}),
  };
  await writeJson(recipePath, recipe);

  review.status = 'accepted';
  review.evidenceCommit = evidenceCommit;
  review.userSignoff = {
    status: 'authorized-and-recorded',
    signedAt,
    authorization: 'current-user-request-owner-signoff-and-publish',
    acceptanceCommit: evidenceCommit,
    optimizationObjectId:
      ownerId === 199001 || ownerId === 199002 ? 'STARBORN' : null,
    jointObjectSignoff:
      ownerId === 199001 || ownerId === 199002
        ? {
            objectId: 'STARBORN',
            sourceOwnerIds: [199001, 199002],
            mode: 'single-object-joint-signoff',
          }
        : null,
  };
  await writeJson(reviewPath, review);

  summaryRows.push({
    ownerId,
    scenarioIdentity,
    qualificationSubjectHash,
    scenarioSetHash,
    canonicalTraceHash: review.canonicalTraceHash,
    control: review.chargedInputAuthority.visualAssertion,
    screenshotPath: review.automatedEvidence.traceScreenshotPath,
    screenshotSha256: review.automatedEvidence.traceScreenshotSha256,
  });
}

const starbornRecipePath = path.join(
  repositoryRoot,
  'scripts/character-acceptance/optimization-object-recipes/STARBORN.json'
);
const starbornRecipe = await readJson(starbornRecipePath);
const starbornSources = await Promise.all(
  starbornRecipe.sourceAliases.map(async alias => ({
    sourceCharacterId: Number(alias.sourceCharacterId),
    profile: await readJson(path.join(repositoryRoot, alias.profilePath)),
    fixture: await readJson(path.join(repositoryRoot, alias.fixturePath)),
    manifest: await readJson(
      path.join(repositoryRoot, alias.acceptanceManifestPath)
    ),
    scenarioCases: await readJson(
      path.join(repositoryRoot, alias.scenarioCasesPath)
    ),
  }))
);
const starbornBindingProbe = validateOptimizationObjectAliasAcceptanceBundle({
  recipe: {
    ...starbornRecipe,
    productVisualAcceptance: {
      status: 'accepted',
      acceptanceCommit: evidenceCommit,
      recordIdentity: '',
      acceptanceSubjectHash: '',
      formalAdmission: true,
      optimizationReady: true,
    },
  },
  sources: starbornSources,
});
const starbornUnexpectedIssues = starbornBindingProbe.issues.filter(
  issue =>
    issue.code !== 'optimization-object-product-acceptance-binding-invalid'
);
if (starbornUnexpectedIssues.length > 0) {
  throw new Error(
    `STARBORN source aliases are not ready: ${JSON.stringify(starbornUnexpectedIssues)}`
  );
}
const starbornBindingIssue = starbornBindingProbe.issues.find(
  issue =>
    issue.code === 'optimization-object-product-acceptance-binding-invalid'
);
const starbornAcceptanceSubjectHash = String(
  starbornBindingIssue?.expected?.acceptanceSubjectHash ?? ''
);
if (!/^[0-9a-f]{16}$/.test(starbornAcceptanceSubjectHash)) {
  throw new Error(
    'Unable to derive the current STARBORN acceptance subject hash'
  );
}
const starbornRecordIdentity =
  `optimization-object-product-acceptance:STARBORN:${evidenceCommit}:` +
  starbornAcceptanceSubjectHash;
starbornRecipe.productVisualAcceptance = {
  status: 'accepted',
  acceptanceCommit: evidenceCommit,
  recordIdentity: starbornRecordIdentity,
  acceptanceSubjectHash: starbornAcceptanceSubjectHash,
  formalAdmission: true,
  optimizationReady: true,
};
const starbornFinalValidation = validateOptimizationObjectAliasAcceptanceBundle(
  {
    recipe: starbornRecipe,
    sources: starbornSources,
  }
);
if (
  !starbornFinalValidation.valid ||
  starbornFinalValidation.bundle.status !== 'optimization-ready'
) {
  throw new Error(
    `STARBORN joint signoff is invalid: ${JSON.stringify(starbornFinalValidation.issues)}`
  );
}
await writeJson(starbornRecipePath, starbornRecipe);

const summary = {
  schemaVersion: 1,
  contractName: 'M12CChargedOwnerProductVisualSignoff',
  status: 'owner-signoff-recorded-awaiting-release-gates',
  signedAt,
  evidenceCommit,
  ownerCount: summaryRows.length,
  optimizationObjectCount: 9,
  starborn: {
    optimizationObjectId: 'STARBORN',
    sourceOwnerIds: [199001, 199002],
    signoffMode: 'single-object-joint-signoff',
    acceptanceSubjectHash: starbornAcceptanceSubjectHash,
    recordIdentity: starbornRecordIdentity,
    optimizationReady: true,
  },
  owners: summaryRows,
};
await writeJson(
  path.join(import.meta.dirname, 'OWNER_VISUAL_SIGNOFF.json'),
  summary
);

console.log(
  JSON.stringify(
    {
      status: summary.status,
      ownerCount: summary.ownerCount,
      evidenceCommit,
      signedAt,
    },
    null,
    2
  )
);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
