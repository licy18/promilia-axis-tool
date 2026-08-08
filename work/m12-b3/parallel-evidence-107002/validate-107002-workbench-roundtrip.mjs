#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createVerifiedCombatMechanicsBuild } from '../../../scripts/sync-verified-combat-mechanics.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../..');
const fixturePath = path.join(
  repositoryRoot,
  'fixtures',
  'character-acceptance',
  '107002-visual.json'
);

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
const build = await createVerifiedCombatMechanicsBuild();
const mechanicsPackage = build.mechanicsPackage;

assertBattleEffectCatalogPackageShape(mechanicsPackage);

assertEqual(
  fixture.dataIdentity?.verifiedMechanicsPackageId,
  mechanicsPackage.packageId,
  'fixture package id'
);
const runtimeFixture = JSON.parse(JSON.stringify(fixture));
runtimeFixture.dataIdentity.verifiedMechanicsPackageHash =
  mechanicsPackage.packageHash;
assertEqual(
  fixture.scenario?.optimizationScenarioPolicy?.policyId,
  'm12c-zero-distance-passive-boss-v1',
  'frozen scenario policy'
);
assertEqual(
  fixture.scenario?.projectile?.targetDistance,
  0,
  'zero-distance projectile policy'
);
assertEqual(
  fixture.scenario?.projectile?.defaultWillHit,
  true,
  'immediate projectile-hit policy'
);
assertDeepEqual(
  fixture.metadata?.kiboDnaFactors,
  [],
  'Kibo DNA factors remain empty'
);
assert(
  !Object.hasOwn(fixture.metadata ?? {}, 'hero_rank'),
  'hero_rank must not be an input'
);

const vite = await createServer({
  root: repositoryRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const packageModule = await vite.ssrLoadModule(
    '/src/data/verifiedCombatMechanicsPackage.js'
  );
  const serviceModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisService.js'
  );
  const adapterModule = await vite.ssrLoadModule(
    '/src/machine-axis/workbenchMachineAxisAdapter.js'
  );
  const coreModule = await vite.ssrLoadModule(
    '/src/simulation/headless/defaultHeadlessCombatCore.js'
  );

  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const service = serviceModule.createMachineAxisService();
  const adapter = adapterModule.createWorkbenchMachineAxisAdapter({ service });
  const blockedProbeId = 'misa-star-before-cooldown-boundary';
  const sourceStar = runtimeFixture.actions.find(action => action.id === 'misa-star');
  assert(sourceStar, 'source star action missing for blocked probe');
  const blockedProbe = {
    ...JSON.parse(JSON.stringify(sourceStar)),
    id: blockedProbeId,
    schedule: { mode: 'absolute', frame: 1500 },
  };
  const fullFixture = {
    ...runtimeFixture,
    actions: [...runtimeFixture.actions, blockedProbe],
  };
  const blockedValidation = service.validate(fullFixture);
  assertEqual(blockedValidation.valid, false, 'blocked probe validation');
  assertDeepEqual(
    blockedValidation.issues.map(issue => ({
      actionId: issue.actionId,
      code: issue.code,
      violationCodes: issue.violationCodes,
    })),
    [
      {
        actionId: blockedProbeId,
        code: 'machine-axis-action-not-executable',
        violationCodes: ['skill-cooldown-active'],
      },
    ],
    'blocked probe diagnostics'
  );
  const fullCompilation = service.compile(fullFixture);
  const fullFirst = coreModule.DEFAULT_HEADLESS_COMBAT_CORE.simulate(
    fullCompilation.canonicalCompilation
  );
  const fullSecond = coreModule.DEFAULT_HEADLESS_COMBAT_CORE.simulate(
    fullCompilation.canonicalCompilation
  );
  assertDeepEqual(fullFirst.hashes, fullSecond.hashes, 'full two-run hashes');
  assertDeepEqual(fullFirst.trace, fullSecond.trace, 'full two-run trace');

  const validation = service.validate(runtimeFixture);
  assert(
    validation.valid,
    `Machine Axis validation failed: ${JSON.stringify(validation.issues)}`
  );

  const first = service.simulate(runtimeFixture);
  const second = service.simulate(runtimeFixture);
  assertDeepEqual(first.hashes, second.hashes, 'two-run canonical hashes');
  assertDeepEqual(first.trace, second.trace, 'two-run canonical trace');

  const imported = adapter.importContract(runtimeFixture);
  const exported = adapter.exportProject(imported.project, {
    metadata: fixture.metadata,
  });
  const roundTrip = service.simulate(
    JSON.parse(JSON.stringify(exported))
  );
  assertDeepEqual(first.hashes, roundTrip.hashes, 'Workbench roundtrip hashes');
  assertDeepEqual(first.trace, roundTrip.trace, 'Workbench roundtrip trace');

  const selectionByActionId = new Map(
    (first.trace?.variants?.selections ?? []).map(selection => [
      selection.actionId,
      selection,
    ])
  );
  for (const [actionId, controlSkillId] of [
    ['misa-a3', 10700203],
    ['misa-a4', 10700204],
    ['misa-charged', 10700210],
    ['misa-star', 10700226],
    ['misa-ultimate', 10700213],
  ]) {
    const selection = selectionByActionId.get(actionId);
    assert(selection, `selection missing: ${actionId}`);
    assertEqual(
      selection.controlSkillId,
      controlSkillId,
      `${actionId} control skill`
    );
    assertEqual(selection.subSkillIndex, 0, `${actionId} subskill`);
  }

  const executionByActionId = new Map(
    (fullFirst.trace?.executionPlan?.actions ?? []).map(action => [
      action.actionId,
      action,
    ])
  );
  const preBoundary = executionByActionId.get(
    'misa-star-before-cooldown-boundary'
  );
  assert(preBoundary, 'pre-boundary cooldown probe missing');
  assertEqual(preBoundary.execute, false, 'pre-boundary cooldown probe');
  assert(
    (preBoundary.violationCodes ?? []).includes('skill-cooldown-active'),
    'pre-boundary cooldown diagnostic missing'
  );
  assertEqual(
    executionByActionId.get('misa-star-at-cooldown-boundary')?.execute,
    true,
    'right-open cooldown boundary'
  );
  assertEqual(
    fixture.dataIdentity?.verifiedMechanicsPackageHash,
    mechanicsPackage.packageHash,
    'fixture package hash'
  );

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        fixture: path.relative(repositoryRoot, fixturePath).replaceAll('\\', '/'),
        packageId: mechanicsPackage.packageId,
        packageHash: mechanicsPackage.packageHash,
        validation: 'passed',
        replay: 'byte-equivalent-canonical-trace',
        workbenchRoundTrip: 'passed',
        hashes: first.hashes,
        selectionCount: selectionByActionId.size,
        actionCount: runtimeFixture.actions.length,
        executableActionCount: runtimeFixture.actions.length,
        blockedProbe: blockedProbeId,
      },
      null,
      2
    )
  );
} finally {
  await vite.close();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label) {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: values differ`);
  }
}

function assertBattleEffectCatalogPackageShape(value) {
  const invalidNodes = (value?.battleEffectCatalog?.nodes ?? []).filter(
    node =>
      !node.catalogIdentity ||
      !['applied', 'verified-zero', 'unresolved'].includes(node.classification)
  );
  const invalidRoots = [
    ...(value?.controlBindings ?? []),
    ...(value?.actionVariantControlBindings ?? []),
  ].flatMap(binding =>
    (binding.effectGraph ?? [])
      .filter(
        root =>
          !Array.isArray(root.nodeIdentities) || Object.hasOwn(root, 'nodes')
      )
      .map(root => ({
        controlSkillId: binding.controlSkillId,
        graphIdentity: root.graphIdentity,
        keys: Object.keys(root),
      }))
  );
  assert(
    Number(value?.packageVersion) >= 13 &&
      value?.battleEffectCatalog?.status ===
        'verified-battle-effect-node-catalog-ready' &&
      Array.isArray(value?.battleEffectCatalog?.nodes) &&
      invalidNodes.length === 0 &&
      invalidRoots.length === 0,
    `battle effect catalog package shape invalid: ${JSON.stringify({
      packageVersion: value?.packageVersion,
      status: value?.battleEffectCatalog?.status,
      nodeCount: value?.battleEffectCatalog?.nodes?.length ?? null,
      invalidNodes: invalidNodes.slice(0, 5),
      invalidRoots: invalidRoots.slice(0, 5),
    })}`
  );
}
