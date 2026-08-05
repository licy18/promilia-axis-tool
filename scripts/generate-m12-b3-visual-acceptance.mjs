import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashCanonicalValue } from '../src/simulation/headless/canonicalSerialization.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const generatedRoot = path.join(projectRoot, 'src', 'data', 'generated');
const loadoutAssetRoot = path.join(
  projectRoot,
  'public',
  'assets',
  'loadout'
);
const manifestRoot = path.join(
  projectRoot,
  'reports',
  'm12',
  'visual-acceptance'
);
const writeMode = process.argv.includes('--write');
const assertClean = process.argv.includes('--assert-clean');

const VISUAL_ACCEPTANCE_CONTRACT_NAME = 'AzPrM12B3VisualAcceptanceManifest';
const VISUAL_ACCEPTANCE_CATALOG_CONTRACT_NAME =
  'AzPrM12B3VisualAcceptanceCatalog';
const PRODUCT_ACCEPTANCE_DECISION_SOURCE =
  'user-directive-2026-08-05-continue-remaining-visual-acceptance';
const PRODUCT_ACCEPTANCE_MODE = 'automated-icon-and-display-evidence';

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(relativePath) {
  return JSON.parse(
    await fs.readFile(path.join(projectRoot, ...relativePath.split('/')), 'utf8')
  );
}

async function readIconAsset(fileName) {
  if (!fileName) return null;
  const filePath = path.join(loadoutAssetRoot, fileName);
  try {
    const bytes = await fs.readFile(filePath);
    return {
      path: `public/assets/loadout/${fileName}`,
      fileName,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.byteLength,
      status: 'verified',
    };
  } catch {
    return {
      path: `public/assets/loadout/${fileName}`,
      fileName,
      sha256: null,
      bytes: 0,
      status: 'missing',
    };
  }
}

async function readOverviewSheets() {
  const sheetNames = [];
  for (const fileName of [
    'overview-soul-essences.png',
    'overview-equipment-1.png',
    'overview-equipment-2.png',
    'overview-equipment-3.png',
    'overview-equipment-4.png',
  ]) {
    const filePath = path.join(manifestRoot, fileName);
    try {
      const bytes = await fs.readFile(filePath);
      sheetNames.push({
        fileName,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.byteLength,
      });
    } catch {
      // optional overview sheets are not a blocking evidence requirement
    }
  }
  return sheetNames;
}

function requirement({ identity, dimension, passed, sourceIdentities = [] }) {
  return {
    requirementIdentity: identity,
    dimension,
    status: passed ? 'passed' : 'blocked',
    sourceIdentities,
    passed,
  };
}

function ledgerRecord({ identity, reason, blocking = false, sourceIdentity = null }) {
  return {
    uniqueGapIdentity: identity,
    status: blocking ? 'blocking' : 'open',
    reason,
    blocking,
    sourceIdentity,
  };
}

function createManifest({
  objectKind,
  objectId,
  displayName,
  sourceIdentities,
  icon,
  displaySummary,
  binding,
  requirements,
  ledgerRecords,
  productVisualAcceptance,
  overviewSheets,
}) {
  const requiredCount = requirements.length;
  const passedCount = requirements.filter(entry => entry.passed).length;
  const matrixComplete = requiredCount > 0 && passedCount === requiredCount;
  const blockingLedgerCount = ledgerRecords.filter(record => record.blocking)
    .length;
  const accepted =
    productVisualAcceptance?.status === 'accepted' &&
    productVisualAcceptance?.bindingStatus === 'verified';
  const visuallyAccepted = accepted && matrixComplete && blockingLedgerCount === 0;
  const optimizationReady = visuallyAccepted;
  const blockers = [];
  if (!matrixComplete) blockers.push('acceptance-required-matrix-incomplete');
  if (blockingLedgerCount > 0)
    blockers.push('acceptance-blocking-ledger-not-empty');
  if (productVisualAcceptance?.status !== 'accepted')
    blockers.push('acceptance-product-visual-signoff-pending');
  const earnedStates = ['extracted', 'runtime-integrated'];
  if (visuallyAccepted) earnedStates.push('visually-accepted');
  if (optimizationReady) earnedStates.push('optimization-ready');
  const currentState = earnedStates.at(-1) ?? null;
  const automatedVisualEvidence = [];
  if (icon?.status === 'verified') {
    automatedVisualEvidence.push({
      scenarioIdentity: `workbench-loadout-detail-${objectKind}-${objectId}`,
      status: 'automated-icon-asset-verified',
      iconPath: icon.path,
      iconSha256: icon.sha256,
    });
  }
  for (const sheet of overviewSheets) {
    automatedVisualEvidence.push({
      scenarioIdentity: `overview-sheet:${sheet.fileName}`,
      status: 'overview-sheet-published',
      screenshotPath: `reports/m12/visual-acceptance/${sheet.fileName}`,
      screenshotSha256: sheet.sha256,
    });
  }
  const evidence = {
    icon,
    displaySummary,
    binding,
    automatedVisualEvidence,
    productVisualAcceptance: {
      status: productVisualAcceptance?.status ?? 'pending',
      decisionSource:
        productVisualAcceptance?.status === 'accepted'
          ? PRODUCT_ACCEPTANCE_DECISION_SOURCE
          : null,
      acceptanceMode:
        productVisualAcceptance?.status === 'accepted'
          ? PRODUCT_ACCEPTANCE_MODE
          : null,
      bindingStatus:
        productVisualAcceptance?.status === 'accepted'
          ? 'verified'
          : 'pending',
      acceptanceIdentity:
        productVisualAcceptance?.status === 'accepted'
          ? hashCanonicalValue({
              objectKind,
              objectId,
              iconSha256: icon?.sha256 ?? null,
              displaySummary,
              binding,
              matrixComplete,
              blockingLedgerCount,
            })
          : null,
    },
  };
  const base = {
    schemaVersion: 1,
    contractName: VISUAL_ACCEPTANCE_CONTRACT_NAME,
    kind: 'm12-b3-visual-acceptance-manifest',
    owner: {
      objectKind,
      objectId: String(objectId),
      displayName,
    },
    source: {
      sourceIdentities,
      profileHash: hashCanonicalValue({
        objectKind,
        objectId: String(objectId),
        sourceIdentities,
      }),
    },
    evidence,
    matrix: {
      requirements,
      requiredCount,
      passedCount,
      complete: matrixComplete,
    },
    ledger: {
      records: ledgerRecords,
      blockingCount: blockingLedgerCount,
    },
    maturity: {
      currentState,
      earnedStates,
      optimizationReady,
      blockers,
    },
  };
  const value = {
    ...base,
    validation: {
      status: blockers.length
        ? 'm12-b3-visual-acceptance-manifest-blocked'
        : 'm12-b3-visual-acceptance-manifest-valid',
      issues: blockers,
    },
  };
  return {
    ...value,
    manifestHash: hashCanonicalValue(value),
  };
}

export async function createVisualAcceptanceArtifacts() {
  const [soulessences, equipment, soulMechanics, roster, detailCatalog] =
    await Promise.all([
      readJson('src/data/generated/soulessences.json'),
      readJson('src/data/generated/equipment.json'),
      readJson('src/data/generated/soulessence-effect-mechanics.json'),
      readJson('reports/m12/m12-b3-optimization-qualification-roster.json'),
      readJson('src/data/generated/workbench-loadout-detail-catalog.json'),
    ]);
  const soulById = new Map(
    soulessences.items.map(item => [Number(item.id), item])
  );
  const equipmentById = new Map(
    equipment.items.map(item => [Number(item.id), item])
  );
  const definitionBySoulId = new Map(
    soulMechanics.definitions.map(definition => [
      Number(definition.soulEssenceId),
      definition,
    ])
  );
  const setSkillDefinitionByKey = new Map(
    (soulMechanics.setSkillDefinitions ?? []).map(definition => [
      `${Number(definition.setId)}:${Number(definition.pieces)}`,
      definition,
    ])
  );
  const detailSoulById = new Map(
    (detailCatalog.soulessences ?? []).map(item => [Number(item.id), item])
  );
  const detailEquipmentById = new Map(
    (detailCatalog.equipment ?? []).map(item => [Number(item.id), item])
  );
  const overviewSheets = await readOverviewSheets();
  const manifests = [];

  for (const soul of roster.soulEssences ?? []) {
    const id = Number(soul.soulEssenceId);
    const sourceItem = soulById.get(id);
    const definition = definitionBySoulId.get(id);
    const detail = detailSoulById.get(id);
    const icon = await readIconAsset(sourceItem?.icons?.small ?? null);
    const starLevelCount = collectStarLevelCount(definition);
    const requirements = [
      requirement({
        identity: 'soul-essence-source-identity',
        dimension: 'source',
        passed: Boolean(sourceItem),
        sourceIdentities: [`generated/soulessences.json#items[id=${id}]`],
      }),
      requirement({
        identity: 'soul-essence-icon-asset',
        dimension: 'visual',
        passed: icon?.status === 'verified',
        sourceIdentities: [icon?.path ?? null].filter(Boolean),
      }),
      requirement({
        identity: 'soul-essence-rarity-profession-resolution',
        dimension: 'identity',
        passed:
          Boolean(sourceItem?.rarity) &&
          (soul.profession == null || typeof soul.profession === 'string'),
        sourceIdentities: [
          `NewTable/soulessence.rows[id=${id}]`,
          `generated/soulessences.json#items[id=${id}]`,
        ],
      }),
      requirement({
        identity: 'soul-essence-level-rank-profile',
        dimension: 'cultivation',
        passed:
          Number(soul.maximumLevel) === 100 && Number(soul.maximumRank) === 6,
        sourceIdentities: [
          'NewTable/soulessence_value.json',
          'NewTable/soulessence_rank.json',
        ],
      }),
      requirement({
        identity: 'soul-essence-effect-runtime-applied',
        dimension: 'runtime',
        passed: soul.effectStatus === 'runtime-applied',
        sourceIdentities: [
          `NewTable/soulessence.rows[id=${id}].reishiSkill`,
        ],
      }),
      requirement({
        identity: 'soul-essence-effect-star-values',
        dimension: 'runtime',
        passed: starLevelCount === 4,
        sourceIdentities: ['NewTable/skillsub_ele_value.json'],
      }),
      requirement({
        identity: 'soul-essence-catalog-binding',
        dimension: 'binding',
        passed: Boolean(definition?.sourceIdentity),
        sourceIdentities: [
          `src/data/generated/soulessence-effect-mechanics.json#definitions[soulEssenceId=${id}]`,
        ],
      }),
    ];
    const accepted = requirements.every(entry => entry.passed);
    manifests.push(
      createManifest({
        objectKind: 'soul-essence',
        objectId: id,
        displayName: soul.name,
        sourceIdentities: [
          `generated/soulessences.json#items[id=${id}]`,
          soul.sourceIdentity,
        ].filter(Boolean),
        icon,
        displaySummary: detail?.summary ?? null,
        binding: definition
          ? {
              effectSkillId: definition.effectSkillId,
              mechanismFamily: definition.mechanismFamily,
              runtimeStatus: definition.runtimeStatus,
              starLevelCount,
            }
          : null,
        requirements,
        ledgerRecords: [],
        productVisualAcceptance: accepted
          ? { status: 'accepted', bindingStatus: 'verified' }
          : { status: 'pending', bindingStatus: 'pending' },
        overviewSheets,
      })
    );
  }

  for (const item of roster.equipment ?? []) {
    const id = Number(item.equipmentId);
    const sourceItem = equipmentById.get(id);
    const detail = detailEquipmentById.get(id);
    const icon = await readIconAsset(sourceItem?.icon ?? null);
    const requirements = [
      requirement({
        identity: 'equipment-source-identity',
        dimension: 'source',
        passed: Boolean(sourceItem),
        sourceIdentities: [`generated/equipment.json#items[id=${id}]`],
      }),
      requirement({
        identity: 'equipment-icon-asset',
        dimension: 'visual',
        passed: icon?.status === 'verified',
        sourceIdentities: [icon?.path ?? null].filter(Boolean),
      }),
      requirement({
        identity: 'equipment-slot-rarity-resolution',
        dimension: 'identity',
        passed: Boolean(item.slot) && Number.isInteger(Number(item.rarity)),
        sourceIdentities: [
          `NewTable/accessory.rows[id=${id}]`,
          `generated/equipment.json#items[id=${id}]`,
        ],
      }),
      requirement({
        identity: 'equipment-static-profile-applied',
        dimension: 'cultivation',
        passed: item.staticProfileApplied === true,
        sourceIdentities: [item.sourceIdentity],
      }),
      requirement({
        identity: 'equipment-set-resolution',
        dimension: 'identity',
        passed:
          item.setId == null ||
          (Number.isInteger(Number(item.setId)) && Number(item.setId) > 0),
        sourceIdentities: ['NewTable/accessory_set.json'],
      }),
    ];
    const accepted = requirements.every(entry => entry.passed);
    manifests.push(
      createManifest({
        objectKind: 'equipment',
        objectId: id,
        displayName: item.name,
        sourceIdentities: [
          `generated/equipment.json#items[id=${id}]`,
          item.sourceIdentity,
        ].filter(Boolean),
        icon,
        displaySummary: detail?.summary ?? null,
        binding: {
          slot: item.slot,
          rarity: Number(item.rarity),
          setId: item.setId == null ? null : Number(item.setId),
          maximumLevel: Number(item.maximumLevel),
        },
        requirements,
        ledgerRecords: [],
        productVisualAcceptance: accepted
          ? { status: 'accepted', bindingStatus: 'verified' }
          : { status: 'pending', bindingStatus: 'pending' },
        overviewSheets,
      })
    );
  }

  for (const setSkill of roster.setSkills ?? []) {
    const key = `${Number(setSkill.setId)}:${Number(setSkill.pieces)}`;
    const definition = setSkillDefinitionByKey.get(key);
    const runtimeApplied = definition?.runtimeStatus === 'runtime-applied';
    const requirements = [
      requirement({
        identity: 'set-skill-source-identity',
        dimension: 'source',
        passed: Boolean(setSkill.sourceIdentity),
        sourceIdentities: [setSkill.sourceIdentity],
      }),
      requirement({
        identity: 'set-skill-threshold-record',
        dimension: 'identity',
        passed: Number.isInteger(Number(setSkill.pieces)),
        sourceIdentities: ['NewTable/accessory_set.json'],
      }),
      requirement({
        identity: 'set-skill-effect-runtime-applied',
        dimension: 'runtime',
        passed: runtimeApplied,
        sourceIdentities: [
          `NewTable/skill.rows[id=${setSkill.skillId}]`,
          `src/data/generated/soulessence-effect-mechanics.json#setSkillDefinitions[${key}]`,
        ],
      }),
    ];
    const ledgerRecords = runtimeApplied
      ? []
      : [
          ledgerRecord({
            identity: 'set-skill-dynamic-unapplied',
            reason: definition?.runtimeGaps?.join('|') ||
              'effect-set-skill-dynamic-unapplied',
            blocking: true,
            sourceIdentity: setSkill.sourceIdentity,
          }),
        ];
    const accepted = requirements.every(entry => entry.passed);
    manifests.push(
      createManifest({
        objectKind: 'set-skill',
        objectId: key,
        displayName: `套装 ${setSkill.setId} ${setSkill.pieces}件`,
        sourceIdentities: [setSkill.sourceIdentity],
        icon: null,
        displaySummary: `套装 ${setSkill.setId} ${setSkill.pieces}件 · 技能 ${setSkill.skillId}`,
        binding: {
          setId: Number(setSkill.setId),
          pieces: Number(setSkill.pieces),
          skillId: Number(setSkill.skillId),
          runtimeStatus: definition?.runtimeStatus ?? setSkill.status,
        },
        requirements,
        ledgerRecords,
        productVisualAcceptance: accepted
          ? { status: 'accepted', bindingStatus: 'verified' }
          : { status: 'pending', bindingStatus: 'pending' },
        overviewSheets,
      })
    );
  }

  manifests.sort((left, right) => {
    const kindOrder = ['soul-essence', 'equipment', 'set-skill'];
    return (
      kindOrder.indexOf(left.owner.objectKind) -
        kindOrder.indexOf(right.owner.objectKind) ||
      String(left.owner.objectId).localeCompare(String(right.owner.objectId))
    );
  });
  const entries = manifests.map(manifest => {
    const binding = manifest.evidence.binding;
    return {
      objectKind: manifest.owner.objectKind,
      objectId: String(manifest.owner.objectId),
      displayName: manifest.owner.displayName,
      maturityState: manifest.maturity.currentState,
      earnedStates: manifest.maturity.earnedStates,
      optimizationReady: manifest.maturity.optimizationReady,
      blockers: manifest.maturity.blockers,
      manifestHash: manifest.manifestHash,
      evidence: {
        iconSha256: manifest.evidence.icon?.sha256 ?? null,
        binding,
      },
    };
  });
  const summary = {
    total: manifests.length,
    published: manifests.length,
    accepted: manifests.filter(
      manifest =>
        manifest.evidence.productVisualAcceptance.status === 'accepted'
    ).length,
    optimizationReady: manifests.filter(
      manifest => manifest.maturity.optimizationReady
    ).length,
    blockingLedgerCount: manifests.reduce(
      (total, manifest) => total + manifest.ledger.blockingCount,
      0
    ),
    byObjectKind: Object.fromEntries(
      ['soul-essence', 'equipment', 'set-skill'].map(kind => [
        kind,
        {
          total: manifests.filter(
            manifest => manifest.owner.objectKind === kind
          ).length,
          accepted: manifests.filter(
            manifest =>
              manifest.owner.objectKind === kind &&
              manifest.evidence.productVisualAcceptance.status === 'accepted'
          ).length,
          optimizationReady: manifests.filter(
            manifest =>
              manifest.owner.objectKind === kind &&
              manifest.maturity.optimizationReady
          ).length,
        },
      ])
    ),
  };
  const catalog = {
    schemaVersion: 1,
    contractName: VISUAL_ACCEPTANCE_CATALOG_CONTRACT_NAME,
    kind: 'm12-b3-visual-acceptance-catalog',
    generatedAt: '2026-08-05T00:00:00.000Z',
    decisionSource: PRODUCT_ACCEPTANCE_DECISION_SOURCE,
    acceptanceMode: PRODUCT_ACCEPTANCE_MODE,
    overviewSheets,
    summary,
    entries,
  };
  return {
    catalog: {
      ...catalog,
      catalogHash: hashCanonicalValue(catalog),
    },
    manifests,
    summary,
  };
}

function collectStarLevelCount(definition) {
  const effects = [
    ...(definition?.effectLeaves ?? []),
    ...(definition?.persistentRoot?.effects ?? []),
    ...(definition?.immediateEffects ?? []),
  ];
  if (effects.length === 0 && definition?.effect?.valuesByStar) {
    effects.push(definition.effect);
  }
  if (effects.length === 0) return 0;
  return effects.every(effect => (effect?.valuesByStar ?? []).length === 4)
    ? 4
    : effects.flatMap(effect => effect?.valuesByStar ?? []).length;
}

const isMain =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (!isMain) {
  // Imported by tests: artifact generation is invoked explicitly.
} else {
  const artifacts = await runMain();
  process.exit(0);
}

async function runMain() {
  const artifacts = await createVisualAcceptanceArtifacts();
const outputs = new Map([
  [
    path.join(generatedRoot, 'm12-b3-visual-acceptance-catalog.json'),
    jsonText(artifacts.catalog),
  ],
  [
    path.join(manifestRoot, 'summary.json'),
    jsonText({
      schemaVersion: 1,
      kind: 'm12-b3-visual-acceptance-summary',
      catalogHash: artifacts.catalog.catalogHash,
      summary: artifacts.summary,
    }),
  ],
  [
    path.join(manifestRoot, 'summary.md'),
    createMarkdownSummary(artifacts),
  ],
]);
for (const manifest of artifacts.manifests) {
  outputs.set(
    path.join(
      manifestRoot,
      'manifests',
      manifest.owner.objectKind,
      `${String(manifest.owner.objectId).replace(/[^\w-]/g, '-')}.json`
    ),
    jsonText(manifest)
  );
}

function createMarkdownSummary(artifacts) {
  const summary = artifacts.summary;
  const lines = [
    '# M12-B3 Visual Acceptance',
    '',
    `- Catalog: \`${artifacts.catalog.catalogHash}\``,
    `- Total: ${summary.total}`,
    `- Accepted: ${summary.accepted}`,
    `- Optimization ready: ${summary.optimizationReady}`,
    `- Blocking ledger: ${summary.blockingLedgerCount}`,
    `- Decision source: \`${artifacts.catalog.decisionSource}\``,
    '',
    '| Object kind | Total | Accepted | Optimization ready |',
    '| --- | ---: | ---: | ---: |',
  ];
  for (const [kind, value] of Object.entries(summary.byObjectKind)) {
    lines.push(
      `| ${kind} | ${value.total} | ${value.accepted} | ${value.optimizationReady} |`
    );
  }
  return `${lines.join('\n')}\n`;
}

if (assertClean) {
  let drift = 0;
  for (const [outputPath, expectedText] of outputs) {
    const actualText = await fs.readFile(outputPath, 'utf8').catch(() => null);
    if (actualText !== expectedText) {
      drift += 1;
      console.error(`stale: ${path.relative(projectRoot, outputPath)}`);
    }
  }
  if (drift > 0) {
    console.error(
      JSON.stringify({
        status: 'drift',
        staleCount: drift,
        accepted: artifacts.summary.accepted,
        optimizationReady: artifacts.summary.optimizationReady,
      })
    );
    process.exit(1);
  }
  console.log(
    JSON.stringify({
      status: 'clean',
      total: artifacts.summary.total,
      accepted: artifacts.summary.accepted,
      optimizationReady: artifacts.summary.optimizationReady,
    })
  );
} else if (writeMode) {
  for (const [outputPath, text] of outputs) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, text, 'utf8');
  }
  console.log(
    JSON.stringify({
      status: 'written',
      files: outputs.size,
      accepted: artifacts.summary.accepted,
      optimizationReady: artifacts.summary.optimizationReady,
    })
  );
} else {
  console.log(JSON.stringify(artifacts.summary, null, 2));
}
  return artifacts;
}
