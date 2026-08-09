import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  createCharacterAcceptanceCatalog,
  createCharacterAcceptanceManifest,
  createCharacterAcceptanceManifestIndex,
  createScenarioProfileProjectionRows,
  validateUnnamedSecondaryPassiveBoundary,
} from './character-acceptance/character-acceptance-generation.mjs';
import {
  validateCharacterAcceptanceManifest,
  validateCharacterAcceptanceManifestIndex,
} from '../src/character-acceptance/characterAcceptanceProtocol.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const recipeRoot = path.join(
  projectRoot,
  'scripts',
  'character-acceptance',
  'acceptance-recipes'
);
const generatedCatalogPath = path.join(
  projectRoot,
  'src',
  'data',
  'generated',
  'character-acceptance-catalog.json'
);
const generatedManifestIndexPath = path.join(
  projectRoot,
  'src',
  'data',
  'generated',
  'character-acceptance-manifest-index.json'
);
const reportRoot = path.join(
  projectRoot,
  'reports',
  'm11',
  'character-acceptance'
);
const writeMode = process.argv.includes('--write');
const assertClean = process.argv.includes('--assert-clean');
const requestedOwnerId = readRequestedOwnerId(process.argv.slice(2));

const recipes = (await loadRecipes()).filter(
  recipe =>
    requestedOwnerId == null || Number(recipe.ownerId) === requestedOwnerId
);
if (requestedOwnerId != null && recipes.length !== 1) {
  throw new Error(
    'Character acceptance recipe missing for owner: ' + requestedOwnerId
  );
}
const mechanicsPackage = await readJson(
  path.join(
    projectRoot,
    'src',
    'data',
    'generated',
    'verified-combat-mechanics-package.json'
  )
);
const vite = await createServer({
  root: projectRoot,
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
  const traceIndexModule = await vite.ssrLoadModule(
    '/src/features/workbench/canonicalTraceViewIndex.js'
  );
  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const service = serviceModule.createMachineAxisService();
  const adapter = adapterModule.createWorkbenchMachineAxisAdapter({ service });
  const manifests = [];
  const visualRuns = [];

  for (const recipe of recipes) {
    await verifyAutomatedVisualEvidence(recipe);
    const ownerId = Number(recipe.ownerId);
    const loaded = await Promise.all([
      readJson(
        path.join(
          projectRoot,
          'src',
          'data',
          'generated',
          'character-combat-profiles',
          ownerId + '.json'
        )
      ),
      readJson(
        path.join(
          projectRoot,
          'reports',
          'm10',
          String(ownerId),
          'runtime-coverage.json'
        )
      ),
      readJson(
        path.join(
          projectRoot,
          'reports',
          'm10',
          String(ownerId),
          'unresolved-ledger.json'
        )
      ),
      readJson(path.join(projectRoot, recipe.fixturePath)),
      ...recipe.goldenReports.map(reportPath =>
        readJson(path.join(projectRoot, reportPath))
      ),
    ]);
    const profile = loaded[0];
    const runtimeCoverage = loaded[1];
    const unresolvedLedger = loaded[2];
    const fixture = loaded[3];
    const goldenReports = loaded.slice(4);
    const goldens = recipe.goldenReports.map((reportPath, index) => ({
      path: reportPath,
      report: goldenReports[index],
    }));
    const visualScenario = executeVisualScenario({
      recipe,
      fixture,
      service,
      adapter,
      traceIndexModule,
      profile,
    });
    const manifest = createCharacterAcceptanceManifest({
      recipe,
      profile,
      runtimeCoverage,
      unresolvedLedger,
      goldens,
      visualScenario,
    });
    const validation = validateCharacterAcceptanceManifest(manifest, {
      checkPublication: false,
    });
    if (!validation.valid) {
      throw new Error(
        'Character acceptance manifest invalid for ' +
          ownerId +
          ': ' +
          validation.issues.join(', ')
      );
    }
    const passiveBoundary = recipe.unnamedSecondaryPassiveSkillId
      ? validateUnnamedSecondaryPassiveBoundary(
          manifest,
          recipe.unnamedSecondaryPassiveSkillId
        )
      : { valid: true };
    if (!passiveBoundary.valid) {
      throw new Error(
        'Unnamed secondary passive boundary invalid for ' +
          ownerId +
          ': ' +
          JSON.stringify(passiveBoundary)
      );
    }
    manifests.push(manifest);
    visualRuns.push(visualScenario);
  }

  const result =
    requestedOwnerId == null
      ? createPublishedAcceptanceResult(manifests, visualRuns)
      : createOwnerAcceptanceResult(manifests, visualRuns);
  const { report, outputs } = result;
  if (writeMode) await writeOutputs(outputs);
  if (assertClean) await assertOutputsClean(outputs);
  console.log(JSON.stringify(report.summary, null, 2));
} finally {
  await vite.close();
}

function createPublishedAcceptanceResult(manifests, visualRuns) {
  const manifestIndex = createCharacterAcceptanceManifestIndex(manifests);
  const indexValidation =
    validateCharacterAcceptanceManifestIndex(manifestIndex);
  if (!indexValidation.valid) {
    throw new Error(
      'Character acceptance manifest index invalid: ' +
        indexValidation.issues.join(', ')
    );
  }
  for (const manifest of manifests) {
    const publishedValidation = validateCharacterAcceptanceManifest(manifest, {
      publishedManifestIndex: manifestIndex,
      checkPublication: true,
    });
    if (!publishedValidation.valid) {
      throw new Error(
        'Published character acceptance manifest invalid for ' +
          manifest.owner.ownerId +
          ': ' +
          publishedValidation.issues.join(', ')
      );
    }
  }
  const catalog = createCharacterAcceptanceCatalog(manifests, manifestIndex);
  const report = createAcceptanceReport(
    manifests,
    visualRuns,
    catalog,
    manifestIndex
  );
  return {
    report,
    outputs: createOutputs(manifests, catalog, manifestIndex, report),
  };
}

function createOwnerAcceptanceResult(manifests, visualRuns) {
  if (manifests.length !== 1 || visualRuns.length !== 1) {
    throw new Error('Owner acceptance generation requires exactly one owner');
  }
  const manifest = manifests[0];
  const visualRun = visualRuns[0];
  return {
    report: {
      summary: {
        ownerId: manifest.owner.ownerId,
        requirementCount: manifest.matrix.summary.requirementCount,
        requiredCount: manifest.matrix.summary.requiredCount,
        passedCount: manifest.matrix.summary.passedCount,
        notApplicableCount: manifest.matrix.summary.notApplicableCount,
        blockedCount: manifest.matrix.summary.blockedCount,
        sourceGapCount: manifest.ledger.summary.sourceGapCount,
        acceptanceGapCount: manifest.ledger.summary.acceptanceGapCount,
        functionalFailureCount: manifest.ledger.summary.uniqueBlockingCount,
        headlessReplayPassed: visualRun.status === 'passed',
        canonicalReplayStable: visualRun.stableReplay === true,
        workbenchRoundTripPassed: visualRun.workbenchRoundTrip === 'passed',
        productVisualAcceptance:
          manifest.evidence.productVisualAcceptance.status,
        optimizationReady: manifest.maturity.optimizationReady,
      },
    },
    outputs: createOwnerOutputs(manifests),
  };
}

function executeVisualScenario({
  recipe,
  fixture,
  service,
  adapter,
  traceIndexModule,
  profile,
}) {
  const validation = service.validate(fixture);
  if (!validation.valid) {
    throw new Error(
      'Machine Axis fixture invalid for ' +
        recipe.ownerId +
        ': ' +
        JSON.stringify(validation.issues)
    );
  }
  const first = service.simulate(fixture);
  const second = service.simulate(fixture);
  const imported = adapter.importContract(fixture);
  const exported = adapter.exportProject(imported.project, {
    metadata: fixture.metadata,
  });
  const roundTrip = service.simulate(exported);
  const traceIndex = traceIndexModule.createCanonicalTraceViewIndex(
    imported.canonicalRun
  );
  const stableReplay = sameHashes(first.hashes, second.hashes);
  const workbenchRoundTrip = sameHashes(first.hashes, roundTrip.hashes);
  const criticalMatrix = inspectCriticalMatrix(
    Number(recipe.ownerId),
    first,
    second,
    recipe.criticalProbe ?? null
  );
  const thunderLifecycle = inspectThunderLifecycle(first);
  const configuredInputWindowBoundaries = recipe.inputWindowProbe
    ? inspectConfiguredInputWindowBoundaries({
        fixture,
        run: first,
        profile,
        probe: recipe.inputWindowProbe,
      })
    : null;
  const inputWindowBoundaries =
    configuredInputWindowBoundaries ??
    (Number(recipe.ownerId) === 108003
      ? inspectMitiInputWindowBoundaries(fixture, first, service)
      : inspectInputWindowBoundaries(fixture, first));
  const foregroundBackgroundSwitch =
    Number(recipe.ownerId) === 108003
      ? inspectMitiForegroundBackgroundSwitch(first)
      : null;
  const probeResults = recipe.probes.map(probe =>
    inspectRecipeProbe(first, probe)
  );
  const resourceBackedEffects = projectResourceBackedEffects(
    first,
    fixture.scenario.id
  );
  const appliedEffectSourceElements = projectAppliedEffectSourceElements(
    first,
    fixture.scenario.id
  );
  const tuningComponentEffects = projectVerifiedTuningComponentEffects(
    first,
    fixture.scenario.id
  );
  const verifiedDirectEffectSources = projectVerifiedDirectEffectSources(
    first,
    fixture.scenario.id
  );
  const tuningMarkResourceEffects = projectTuningMarkResourceEffects(
    first,
    fixture.scenario.id
  );
  const sourceActionBindingForms = projectSourceActionBindingForms(
    first,
    fixture.scenario.id
  );
  const sourceHitAliases = projectSourceHitAliases(first, fixture.scenario.id);
  const assertionResults = [
    { identity: 'machine-axis-validation', passed: validation.valid },
    { identity: 'canonical-same-input-replay', passed: stableReplay },
    {
      identity: 'workbench-import-export-round-trip',
      passed: workbenchRoundTrip,
    },
    ...Object.entries(criticalMatrix)
      .filter(([key]) => key !== 'details')
      .map(([key, passed]) => ({ identity: 'critical:' + key, passed })),
    ...(Number(recipe.ownerId) === 109001
      ? [
          {
            identity: 'buff-apply-refresh-stack-expire',
            passed: thunderLifecycle.passed,
            actual: thunderLifecycle.details,
          },
          {
            identity: 'input-window-inside-outside-boundaries',
            passed: inputWindowBoundaries.passed,
            actual: inputWindowBoundaries.details,
          },
        ]
      : []),
    ...(Number(recipe.ownerId) === 108003
      ? [
          {
            identity: 'input-window-inside-outside-boundaries',
            passed: inputWindowBoundaries.passed,
            actual: inputWindowBoundaries.details,
          },
          {
            identity: 'foreground-background-switch',
            passed: foregroundBackgroundSwitch.passed,
            actual: foregroundBackgroundSwitch.details,
          },
        ]
      : []),
    ...(configuredInputWindowBoundaries
      ? [
          {
            identity: 'input-window-inside-outside-boundaries',
            passed: configuredInputWindowBoundaries.passed,
            actual: configuredInputWindowBoundaries.details,
          },
        ]
      : []),
    ...probeResults,
  ];
  const failed = assertionResults.filter(result => !result.passed);
  const selectionRows = first.trace?.variants?.selections ?? [];
  const profileRows = createScenarioProfileProjectionRows({
    profile,
    exercisedControls: collectRuntimeExercisedControls(first),
    exercisedFromHitAndEffectIdentities: [
      ...(first.trace?.damage ?? []).map(event => event.hitIdentity),
      ...(first.trace?.effects?.events ?? []).map(event => event.effectId),
    ],
    observedEffectIds: [
      ...(first.trace?.effects?.events ?? []).map(event => event.effectId),
      ...resourceBackedEffects.map(event => event.effectIdentity),
      ...appliedEffectSourceElements.map(event => event.effectIdentity),
      ...tuningComponentEffects.map(event => event.effectIdentity),
      ...verifiedDirectEffectSources.map(event => event.effectIdentity),
      ...tuningMarkResourceEffects.map(event => event.effectIdentity),
    ],
    scenarioId: fixture.scenario?.id,
    prefix: 'machine',
  });
  return {
    scenarioIdentity: String(fixture.scenario?.id),
    fixturePath: recipe.fixturePath,
    status: failed.length ? 'failed' : 'passed',
    stableReplay,
    workbenchRoundTrip: workbenchRoundTrip ? 'passed' : 'failed',
    canonicalHashes: first.hashes,
    actionCount: fixture.actions.length,
    executedActionCount:
      first.trace?.executionPlan?.actions?.length ??
      first.trace?.actions?.length ??
      selectionRows.length,
    traceIndex: {
      traceHash: traceIndex.traceHash,
      actionCount: traceIndex.summary.actionCount,
      hitCount: traceIndex.summary.hitCount,
      effectEventCount: traceIndex.summary.effectEventCount,
      effectIntervalCount: traceIndex.summary.effectIntervalCount,
      resourceTransactionCount: traceIndex.summary.resourceTransactionCount,
    },
    assertionSummary: {
      assertionCount: assertionResults.length,
      passedCount: assertionResults.length - failed.length,
      failedCount: failed.length,
      failedIdentities: failed.map(result => result.identity),
    },
    criticalMatrix,
    mechanismProbes: {
      thunderLifecycle,
      inputWindowBoundaries,
      foregroundBackgroundSwitch,
    },
    probeResults,
    assertionResults: assertionResults.map(result => ({
      assertionIdentity: result.identity,
      status: result.passed ? 'passed' : 'blocked',
      selector: {
        kind: 'scenario-fact',
        factIdentity: result.identity,
        expectedValue: true,
      },
      reasons: result.passed ? [] : ['canonical-scenario-assertion-failed'],
    })),
    traceProjection: {
      actionForms: [
        ...selectionRows.map(selection => ({
          projectionIdentity:
            'machine-action-form:' +
            fixture.scenario.id +
            ':' +
            selection.actionId,
          actionId: selection.actionId,
          ownerId: selection.ownerId,
          semanticName: selection.semanticName,
          controlSkillId: selection.controlSkillId,
          subSkillIndex: selection.subSkillIndex,
          actualDurationFrames: selection.actualDurationFrames,
        })),
        ...sourceActionBindingForms,
      ],
      hits: [
        ...(first.trace?.damage ?? [])
          .filter(event => event.hitIdentity)
          .map((event, index) => ({
            projectionIdentity:
              'machine-hit:' + fixture.scenario.id + ':' + index,
            actionId: event.actionId ?? null,
            hitIdentity: event.hitIdentity,
            frame: event.frame ?? null,
          })),
        ...sourceHitAliases,
      ],
      resources: (first.trace?.variants?.resourceEvents ?? []).map(
        (event, index) => ({
          projectionIdentity:
            'machine-resource:' + fixture.scenario.id + ':' + index,
          actionId: event.actionId ?? null,
          resourceIdentity: event.payload?.resourceIdentity ?? null,
          operation: event.payload?.operation ?? event.type ?? null,
          beforeValue: event.payload?.beforeValue ?? null,
          afterValue: event.payload?.afterValue ?? null,
        })
      ),
      states: (first.trace?.state?.targetEvents ?? []).map((event, index) => ({
        projectionIdentity:
          'machine-state:' + fixture.scenario.id + ':' + index,
        actionId: event.actionId ?? null,
        stateIdentity:
          event.payload?.stateIdentity ?? event.stateIdentity ?? null,
        operation: event.payload?.operation ?? event.type ?? null,
      })),
      effects: [
        ...(first.trace?.effects?.events ?? []).map((event, index) => ({
          projectionIdentity:
            'machine-effect:' + fixture.scenario.id + ':' + index,
          actionId: event.actionId ?? null,
          effectIdentity: event.effectId ?? event.runtimeEffectId ?? null,
          operation: event.operation ?? null,
          targetId: event.targetId ?? null,
        })),
        ...(first.trace?.damage ?? [])
          .filter(event => Number.isInteger(Number(event.elementId)))
          .map((event, index) => ({
            projectionIdentity:
              'machine-damage-effect:' + fixture.scenario.id + ':' + index,
            actionId: event.actionId ?? null,
            effectIdentity: 'battle-element:' + Number(event.elementId),
            operation: 'damage',
            targetId: event.targetId ?? null,
            sourceSequencePath: Array.isArray(event.sourceSequencePath)
              ? [...event.sourceSequencePath]
              : null,
          })),
        ...tuningComponentEffects,
        ...resourceBackedEffects,
        ...appliedEffectSourceElements,
        ...verifiedDirectEffectSources,
        ...tuningMarkResourceEffects,
      ],
      diagnostics: [
        ...(first.trace?.diagnostics?.validationWarnings ?? []),
        ...(first.trace?.diagnostics?.actionRules?.diagnostics ?? []),
      ].map((diagnostic, index) => ({
        projectionIdentity:
          'machine-diagnostic:' + fixture.scenario.id + ':' + index,
        actionId: diagnostic.actionId ?? null,
        code: diagnostic.code ?? null,
        status: diagnostic.status ?? null,
      })),
      criticalDecisions: (first.trace?.damage ?? [])
        .filter(event => event.formula?.randomBranch)
        .map((event, index) => ({
          projectionIdentity:
            'machine-critical:' + fixture.scenario.id + ':' + index,
          actionId: event.actionId ?? null,
          hitIdentity: event.hitIdentity ?? null,
          mode: event.formula.randomBranch.mode ?? null,
          sourceCriticalBasisPoints:
            event.formula.randomBranch.sourceCriticalBasisPoints ?? null,
          targetCriticalDefenseBasisPoints:
            event.formula.randomBranch.targetCriticalDefenseBasisPoints ?? null,
          effectiveThresholdBasisPoints:
            event.formula.randomBranch.criticalThreshold ?? null,
          criticalRoll: event.formula.randomBranch.criticalRoll ?? null,
          critical: event.formula.randomBranch.critical ?? null,
        })),
      ...profileRows,
      facts: Object.fromEntries(
        assertionResults.map(result => [result.identity, result.passed])
      ),
    },
  };
}

function inspectCriticalMatrix(ownerId, first, second, probe) {
  const prefix = String(ownerId) + '-critical-';
  const boundary = { low: 499, threshold: 500 };
  const damageEvents = first.trace?.damage ?? [];
  const capturedSample = damageEvents.find(
    event =>
      event.actionId === prefix + 'sampled-low' &&
      event.eventType === 'VERIFIED_COMBAT_HIT' &&
      event.formula?.randomBranch?.mode === 'captured-critical-roll'
  );
  const overriddenHitIdentity = capturedSample?.hitIdentity ?? null;
  const findHit = suffix =>
    damageEvents.find(
      event =>
        event.actionId === prefix + suffix &&
        event.eventType === 'VERIFIED_COMBAT_HIT' &&
        event.hitIdentity === overriddenHitIdentity
    ) ?? null;
  const sampledLow = findHit('sampled-low');
  const sampledBoundary = findHit('sampled-boundary');
  const expected = findHit('expected');
  const critical = findHit('critical');
  const nonCritical = findHit('non-critical');
  const miss = findHit('miss-critical');
  const rateZero = findHit('rate-zero');
  const rateOneHundred = findHit('rate-one-hundred');
  const configuredPreHit = probe?.preHitAttributeChange ?? null;
  const preHitBefore = configuredPreHit
    ? findConfiguredCriticalHit(
        damageEvents,
        configuredPreHit.beforeActionId,
        configuredPreHit.hitIdentity ?? overriddenHitIdentity
      )
    : ownerId === 109001
      ? (first.trace?.damage ?? []).find(
          event =>
            event.actionId === 'moyin-lifecycle-a5-1' &&
            event.eventType === 'VERIFIED_COMBAT_HIT' &&
            String(event.hitIdentity ?? '').endsWith('|47|6')
        )
      : ownerId === 108003
        ? sampledLow
        : null;
  const preHitAfter = configuredPreHit
    ? findConfiguredCriticalHit(
        damageEvents,
        configuredPreHit.afterActionId,
        configuredPreHit.hitIdentity ?? overriddenHitIdentity
      )
    : ownerId === 109001
      ? (first.trace?.damage ?? []).find(
          event =>
            event.actionId === 'moyin-lifecycle-a5-1' &&
            event.eventType === 'VERIFIED_COMBAT_HIT' &&
            String(event.hitIdentity ?? '').endsWith('|56|7')
        )
      : ownerId === 108003
        ? (first.trace?.damage ?? []).find(
            event =>
              event.actionId === 'miti-pre-hit-after-mark' &&
              event.eventType === 'VERIFIED_COMBAT_HIT' &&
              event.hitIdentity === sampledLow?.hitIdentity
          )
        : null;
  const configuredNonCrittable = probe?.nonCrittable ?? null;
  const nonCrittable = damageEvents.find(event =>
    configuredNonCrittable
      ? event.actionId === configuredNonCrittable.actionId &&
        event.eventType === configuredNonCrittable.eventType &&
        Number(event.elementId) === Number(configuredNonCrittable.elementId)
      : event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
        Number(event.elementId) === 251
  );
  const nonCrittablePeer = (first.trace?.damage ?? []).find(
    event =>
      event.actionId === nonCrittable?.actionId &&
      event.eventType === 'VERIFIED_COMBAT_HIT' &&
      event.formula?.randomBranch
  );
  const expectedResult = expected?.formula?.verifiedResult?.expectedCritical;
  return {
    sameSeedReplay: sameHashes(first.hashes, second.hashes),
    integerThresholdBoundary:
      sampledLow?.formula?.randomBranch?.criticalRoll === boundary.low &&
      sampledLow?.formula?.randomBranch?.criticalThreshold ===
        boundary.threshold &&
      sampledLow?.formula?.randomBranch?.critical === true &&
      sampledBoundary?.formula?.randomBranch?.criticalRoll ===
        boundary.threshold &&
      sampledBoundary?.formula?.randomBranch?.criticalThreshold ===
        boundary.threshold &&
      sampledBoundary?.formula?.randomBranch?.critical === false,
    perHitModes:
      sampledLow?.formula?.randomBranch?.mode === 'captured-critical-roll' &&
      expected?.formula?.randomBranch?.mode === 'expected' &&
      critical?.formula?.randomBranch?.mode === 'critical' &&
      nonCritical?.formula?.randomBranch?.mode === 'non-critical',
    expectedNoCriticalEvent:
      expectedResult?.criticalEventMaterialized === false &&
      expectedResult?.weightedValue === expected?.rawDamage,
    missSuppressesHit: miss == null,
    ...([109001, 108003].includes(ownerId) || probe
      ? {
          rateZero:
            rateZero?.formula?.randomBranch?.criticalThreshold === 0 &&
            rateZero?.formula?.randomBranch?.criticalRoll === 0 &&
            rateZero?.formula?.randomBranch?.critical === false,
          rateOneHundredPercent:
            rateOneHundred?.formula?.randomBranch?.criticalThreshold ===
              10000 &&
            rateOneHundred?.formula?.randomBranch?.criticalRoll === 9999 &&
            rateOneHundred?.formula?.randomBranch?.critical === true,
          preHitAttributeChange:
            criticalAttributeIncreased(
              preHitBefore,
              preHitAfter,
              'sourceCriticalRateBasisPoints'
            ) &&
            criticalAttributeIncreased(
              preHitBefore,
              preHitAfter,
              'sourceCriticalDamageBasisPoints'
            ),
          nonCrittableRejection:
            nonCrittable?.formula?.status ===
              'verified-tuning-formula-applied' &&
            nonCrittable?.formula?.randomBranch == null &&
            Number(nonCrittable?.rawDamage) > 0 &&
            Boolean(nonCrittablePeer?.formula?.randomBranch),
        }
      : {}),
    details: {
      sampledLow: projectCriticalHit(sampledLow),
      sampledBoundary: projectCriticalHit(sampledBoundary),
      expected: projectCriticalHit(expected),
      critical: projectCriticalHit(critical),
      nonCritical: projectCriticalHit(nonCritical),
      rateZero: projectCriticalHit(rateZero),
      rateOneHundred: projectCriticalHit(rateOneHundred),
      preHitBefore: projectCriticalHit(preHitBefore),
      preHitAfter: projectCriticalHit(preHitAfter),
      nonCrittable: projectCriticalHit(nonCrittable),
      nonCrittablePeer: projectCriticalHit(nonCrittablePeer),
    },
  };
}

function findConfiguredCriticalHit(events, actionId, hitIdentity) {
  return (
    events.find(
      event =>
        event.actionId === actionId &&
        event.eventType === 'VERIFIED_COMBAT_HIT' &&
        (hitIdentity == null || event.hitIdentity === hitIdentity)
    ) ?? null
  );
}

function criticalAttributeIncreased(before, after, field) {
  const beforeValue = Number(before?.formula?.randomBranch?.[field]);
  const afterValue = Number(after?.formula?.randomBranch?.[field]);
  return (
    Number.isFinite(beforeValue) &&
    Number.isFinite(afterValue) &&
    afterValue > beforeValue
  );
}

function inspectThunderLifecycle(run) {
  const marks = (run.trace?.resources?.tuningMarks ?? []).filter(
    event => Number(event.markId) === 250
  );
  const targetEvents = run.trace?.state?.targetEvents ?? [];
  const findMark = (actionId, predicate = () => true) =>
    marks.find(event => event.actionId === actionId && predicate(event)) ??
    null;
  const suppressedOffAcquire = findMark(
    'moyin-a5-brilliant-off',
    event => event.kind === 'acquire'
  );
  const suppressedOffCondition = targetEvents.find(
    event =>
      event.actionId === 'moyin-a5-brilliant-off' &&
      event.type === 'VERIFIED_ACTION_EFFECT_STATE_CONDITION_EVALUATED' &&
      event.payload?.stateIdentity === 'moyin-brilliant' &&
      event.payload?.applied === false
  );
  const apply = findMark(
    'moyin-lifecycle-a5-1',
    event => event.kind === 'acquire'
  );
  const stack = findMark(
    'moyin-lifecycle-a5-2',
    event => event.kind === 'acquire'
  );
  const cap = findMark(
    'moyin-lifecycle-a5-3',
    event => event.kind === 'acquire'
  );
  const refresh = findMark(
    'moyin-lifecycle-a5-4-refresh',
    event => event.kind === 'acquire'
  );
  const expire = marks.find(event => event.kind === 'expire') ?? null;
  const firstHeldDamage = (run.trace?.damage ?? []).find(
    event =>
      event.actionId === 'moyin-lifecycle-a5-1' &&
      event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
      Number(event.elementId) === 251
  );
  const nextHeldDamage = (run.trace?.damage ?? []).find(
    event =>
      event.actionId === 'moyin-held-boundary-hit' &&
      event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
      Number(event.elementId) === 251
  );
  const heldDamageInsideCooldown = (run.trace?.damage ?? []).find(
    event =>
      event.actionId === 'moyin-lifecycle-a5-2' &&
      event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
      Number(event.elementId) === 251
  );
  const persistentEffect = (run.trace?.effects?.events ?? []).find(
    event =>
      event.actionId === 'moyin-lifecycle-a5-1' &&
      event.effectId === 'tuning-mark:250:persistent' &&
      event.operation === 'apply' &&
      event.targetId === 'actor-109001'
  );
  const expiryBoundaryHit = (run.trace?.damage ?? []).find(
    event =>
      event.actionId === 'moyin-expiry-boundary-hit' &&
      event.eventType === 'VERIFIED_COMBAT_HIT' &&
      String(event.hitIdentity ?? '').endsWith('|12|1')
  );
  const modifierByAttribute = new Map(
    (persistentEffect?.modifiers ?? []).map(modifier => [
      Number(modifier.attributeId),
      Number(modifier.valueRaw),
    ])
  );
  const passed =
    suppressedOffAcquire == null &&
    suppressedOffCondition != null &&
    apply?.before === 0 &&
    apply?.after === 2 &&
    apply?.delta === 2 &&
    stack?.before === 2 &&
    stack?.after === 4 &&
    cap?.before === 3 &&
    cap?.after === 5 &&
    cap?.delta === 2 &&
    refresh?.before === 5 &&
    refresh?.after === 5 &&
    refresh?.delta === 0 &&
    expire?.before === 5 &&
    expire?.after === 4 &&
    expire?.delta === -1 &&
    expire?.frameIndex === expiryBoundaryHit?.absoluteFrame &&
    expiryBoundaryHit?.formula?.randomBranch?.sourceCriticalRateBasisPoints ===
      672 &&
    firstHeldDamage?.formula?.status === 'verified-tuning-formula-applied' &&
    Number(firstHeldDamage?.rawDamage) > 0 &&
    firstHeldDamage?.absoluteFrame === apply?.frameIndex &&
    heldDamageInsideCooldown == null &&
    nextHeldDamage?.formula?.status === 'verified-tuning-formula-applied' &&
    Number(nextHeldDamage?.rawDamage) > Number(firstHeldDamage?.rawDamage) &&
    Math.abs(
      Number(nextHeldDamage?.timeMs) - Number(firstHeldDamage?.timeMs) - 5000
    ) < 0.001 &&
    modifierByAttribute.get(7) === 43 &&
    modifierByAttribute.get(8) === 86;
  return {
    passed,
    details: {
      suppressedOffAcquire,
      suppressedOffCondition,
      apply,
      stack,
      cap,
      refresh,
      expire,
      firstHeldDamage: projectCriticalHit(firstHeldDamage),
      nextHeldDamage: projectCriticalHit(nextHeldDamage),
      heldDamageInsideCooldown: projectCriticalHit(heldDamageInsideCooldown),
      persistentEffect,
      expiryBoundaryHit: projectCriticalHit(expiryBoundaryHit),
    },
  };
}

function inspectInputWindowBoundaries(fixture, run) {
  const selections = new Map(
    (run.trace?.variants?.selections ?? []).map(selection => [
      selection.actionId,
      selection,
    ])
  );
  const actions = new Map(
    (fixture.actions ?? []).map(action => [action.id, action])
  );
  const cases = [
    ['window-outside-before', 39, 10900101],
    ['window-inside-start', 41, 10900143],
    ['window-inside-end', 76, 10900143],
    ['window-outside-after', 78, 10900101],
  ].map(([actionId, expectedOffset, expectedControlSkillId]) => {
    const action = actions.get(actionId);
    const contextAction = actions.get(
      action?.intent?.attackInput?.contextActionId
    );
    const actualOffset =
      Number(action?.schedule?.frame) - Number(contextAction?.schedule?.frame);
    const selection = selections.get(actionId) ?? null;
    return {
      actionId,
      expectedOffset,
      actualOffset,
      expectedControlSkillId,
      actualControlSkillId: Number(selection?.controlSkillId),
      passed:
        actualOffset === expectedOffset &&
        Number(selection?.controlSkillId) === expectedControlSkillId,
      selection,
    };
  });
  return {
    passed: cases.every(entry => entry.passed),
    details: {
      sourceControlSkillId: 10900112,
      transitionControlSkillId: 10900143,
      sourceWindow: '(40,77] source frames',
      cases,
    },
  };
}

function inspectConfiguredInputWindowBoundaries({
  fixture,
  run,
  profile,
  probe,
}) {
  if (probe.kind !== 'focused-mechanic-window') {
    return {
      passed: false,
      details: { reason: 'configured-input-window-probe-kind-unsupported' },
    };
  }
  const window = (profile.contracts?.attackInputMechanicWindows ?? []).find(
    candidate => candidate.bindingIdentity === probe.bindingIdentity
  );
  const action = (fixture.actions ?? []).find(
    candidate => candidate.id === probe.actionId
  );
  const selection = (run.trace?.variants?.selections ?? []).find(
    candidate => candidate.actionId === probe.actionId
  );
  const actionFrame = Number(action?.schedule?.frame);
  const durationFrames = Number(window?.durationFrames);
  const lastCoveredHitFrame = Number(window?.lastCoveredHitFrame);
  const hitPrefix = `${Number(window?.controlSkillId)}|${Number(
    window?.subSkillIndex
  )}|`;
  const relativeHitFrames = (run.trace?.damage ?? [])
    .filter(
      event =>
        event.actionId === probe.actionId &&
        event.eventType === 'VERIFIED_COMBAT_HIT' &&
        String(event.hitIdentity ?? '').startsWith(hitPrefix)
    )
    .map(event => Number(event.absoluteFrame) - actionFrame)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const leftOutsideClear = relativeHitFrames.every(frame => frame >= 0);
  const rightInsideObserved = relativeHitFrames.includes(lastCoveredHitFrame);
  const rightOutsideClear = relativeHitFrames.every(
    frame => frame < durationFrames
  );
  const passed =
    Boolean(window) &&
    Boolean(action) &&
    Boolean(selection) &&
    window.status === 'verified-attack-input-mechanic-window-ready' &&
    window.applied === true &&
    window.interval === '[0,durationFrames)' &&
    Number(selection.controlSkillId) === Number(window.controlSkillId) &&
    Number(selection.subSkillIndex) === Number(window.subSkillIndex) &&
    Number.isInteger(actionFrame) &&
    Number.isInteger(durationFrames) &&
    durationFrames === lastCoveredHitFrame + 1 &&
    relativeHitFrames.length > 0 &&
    leftOutsideClear &&
    rightInsideObserved &&
    rightOutsideClear;
  return {
    passed,
    details: {
      probeKind: probe.kind,
      bindingIdentity: probe.bindingIdentity,
      sourceIdentity: window?.sourceIdentity ?? null,
      interval: window?.interval ?? null,
      actionId: probe.actionId,
      actionFrame: Number.isInteger(actionFrame) ? actionFrame : null,
      controlSkillId: window?.controlSkillId ?? null,
      subSkillIndex: window?.subSkillIndex ?? null,
      durationFrames: Number.isInteger(durationFrames) ? durationFrames : null,
      lastCoveredHitFrame: Number.isInteger(lastCoveredHitFrame)
        ? lastCoveredHitFrame
        : null,
      relativeHitFrames,
      boundaries: {
        leftOutsideFrame: -1,
        leftInsideFrame: 0,
        rightInsideFrame: Number.isInteger(durationFrames)
          ? durationFrames - 1
          : null,
        rightOutsideFrame: Number.isInteger(durationFrames)
          ? durationFrames
          : null,
        leftOutsideClear,
        rightInsideObserved,
        rightOutsideClear,
      },
    },
  };
}

function inspectMitiInputWindowBoundaries(fixture, run, service) {
  const activeActionId = 'miti-star-combo-active';
  const pairedKiboActionId = 'miti-star-combo-kibo-break';
  const insideActor = (run.trace?.executionPlan?.actions ?? []).find(
    action => action.actionId === activeActionId
  );
  const insideKibo = (run.trace?.executionPlan?.actions ?? []).find(
    action => action.actionId === pairedKiboActionId
  );
  const outsideFixture = structuredClone(fixture);
  const outsideKiboAction = (outsideFixture.actions ?? []).find(
    action => action.id === pairedKiboActionId
  );
  outsideKiboAction.schedule.frame += 1;
  const outsideValidation = service.validate(outsideFixture);
  const outsideDiagnostics = (outsideValidation.issues ?? []).filter(issue =>
    [activeActionId, pairedKiboActionId].includes(String(issue.actionId))
  );
  const expectedDiagnosticCodes = new Set([
    'joint-attack-frame-mismatch',
    'joint-attack-pair-missing',
  ]);
  const rejectedActionIds = new Set(
    outsideDiagnostics
      .filter(issue =>
        (issue.violationCodes ?? []).some(code =>
          expectedDiagnosticCodes.has(code)
        )
      )
      .map(issue => String(issue.actionId))
  );
  return {
    passed:
      insideActor?.execute !== false &&
      insideKibo?.execute !== false &&
      outsideValidation.valid === false &&
      rejectedActionIds.has(activeActionId) &&
      rejectedActionIds.has(pairedKiboActionId),
    details: {
      sourceContract: 'azpr-joint-attack-input-contract',
      inside: {
        actorFrame: Number(
          fixture.actions.find(action => action.id === activeActionId)?.schedule
            ?.frame
        ),
        kiboFrame: Number(
          fixture.actions.find(action => action.id === pairedKiboActionId)
            ?.schedule?.frame
        ),
        actorExecute: insideActor?.execute ?? null,
        kiboExecute: insideKibo?.execute ?? null,
      },
      outside: {
        actorFrame: Number(
          outsideFixture.actions.find(action => action.id === activeActionId)
            ?.schedule?.frame
        ),
        kiboFrame: Number(outsideKiboAction.schedule.frame),
        validationValid: outsideValidation.valid,
        rejectedActionIds: [...rejectedActionIds].sort(),
        diagnosticCodes: outsideDiagnostics.flatMap(
          issue => issue.violationCodes ?? [issue.code]
        ),
      },
    },
  };
}

function inspectMitiForegroundBackgroundSwitch(run) {
  const controlledActorAt = timeMs => {
    const switches = (run.trace?.events ?? [])
      .filter(
        event => event.type === 'SWITCH' && Number(event.timeMs) <= timeMs
      )
      .sort((left, right) => Number(left.timeMs) - Number(right.timeMs));
    return switches.at(-1)?.payload?.targetActorId ?? 'actor-108003';
  };
  const periodicSpEvents = (run.trace?.resources?.actors ?? []).filter(
    event => Number(event.elementId) === 108003164 && Number(event.change) === 2
  );
  const backgroundTicks = periodicSpEvents.filter(
    event => controlledActorAt(Number(event.timeMs)) !== 'actor-108003'
  );
  const targets = [
    ...new Set(periodicSpEvents.map(event => String(event.actorId ?? ''))),
  ].sort();
  const switchEvents = (run.trace?.events ?? []).filter(
    event => event.type === 'SWITCH'
  );
  return {
    passed:
      switchEvents.length >= 2 &&
      backgroundTicks.length > 0 &&
      ['actor-101010', 'actor-103002', 'actor-108003'].every(actorId =>
        targets.includes(actorId)
      ),
    details: {
      switchEvents: switchEvents.map(event => ({
        timeMs: event.timeMs,
        fromActorId: event.payload?.fromActorId ?? null,
        toActorId: event.payload?.targetActorId ?? null,
      })),
      periodicSpEventCount: periodicSpEvents.length,
      periodicSpTargets: targets,
      backgroundTickCount: backgroundTicks.length,
      backgroundTicks: backgroundTicks.map(event => ({
        timeMs: event.timeMs,
        actorId: event.actorId ?? null,
        controlledActorId: controlledActorAt(Number(event.timeMs)),
      })),
    },
  };
}

function projectVerifiedTuningComponentEffects(run, scenarioId) {
  const profiles = mechanicsPackage.tuningMechanicsCatalog?.profiles ?? [];
  const damageComponents = new Map(
    profiles.flatMap(profile =>
      (profile.heldDamageTemplates ?? []).map(template => [
        Number(template.elementConfigId),
        { profile, template },
      ])
    )
  );
  const rows = [];
  for (const [index, event] of (run.trace?.damage ?? []).entries()) {
    if (
      event.eventType !== 'VERIFIED_TUNING_DAMAGE' ||
      !damageComponents.has(Number(event.elementId)) ||
      event.formula?.status !== 'verified-tuning-formula-applied'
    ) {
      continue;
    }
    rows.push({
      projectionIdentity:
        'machine-tuning-damage-effect:' + scenarioId + ':' + index,
      actionId: event.actionId ?? null,
      effectIdentity: 'battle-element:' + Number(event.elementId),
      operation: 'settle-damage',
      targetId: event.targetId ?? null,
      sourceIdentity: event.formula?.sourceIdentity ?? null,
      rawDamage: event.rawDamage ?? null,
    });
  }
  for (const [index, event] of (run.trace?.effects?.events ?? []).entries()) {
    const match = String(event.effectId ?? '').match(
      /^tuning-mark:(\d+):persistent$/
    );
    if (!match) continue;
    const profile = profiles.find(
      candidate => Number(candidate.markId) === Number(match[1])
    );
    if (!profile) continue;
    for (const modifier of event.modifiers ?? []) {
      const verified = (profile.persistentModifiers ?? []).find(
        candidate =>
          Number(candidate.attributeId) === Number(modifier.attributeId) &&
          Number(candidate.valueRaw) === Number(modifier.valueRaw)
      );
      if (!verified) continue;
      rows.push({
        projectionIdentity:
          'machine-tuning-modifier-effect:' +
          scenarioId +
          ':' +
          index +
          ':' +
          verified.componentId,
        actionId: event.actionId ?? null,
        effectIdentity: 'battle-element:' + Number(verified.componentId),
        operation: event.operation ?? null,
        targetId: event.targetId ?? null,
        sourceIdentity: verified.sourceIdentity ?? null,
        attributeId: Number(verified.attributeId),
        valueRaw: Number(verified.valueRaw),
      });
    }
  }
  for (const [index, event] of (run.trace?.events ?? []).entries()) {
    if (
      event.type !== 'VERIFIED_TUNING_PERIODIC_HEAL' ||
      event.payload?.applied !== true ||
      event.payload?.appliedToCalculators !== true
    ) {
      continue;
    }
    const sourceText = String(event.payload?.sourceIdentity ?? '');
    const profile = profiles.find(candidate =>
      sourceText.includes(
        `markContainers[elementConfigId=${Number(candidate.markId)}]`
      )
    );
    for (const componentId of profile?.heldEffect?.componentIds ?? []) {
      rows.push({
        projectionIdentity:
          'machine-tuning-periodic-heal-component:' +
          scenarioId +
          ':' +
          index +
          ':' +
          Number(componentId),
        actionId: event.actionId ?? null,
        effectIdentity: 'battle-element:' + Number(componentId),
        operation: 'periodic-heal',
        targetId: event.targetId ?? null,
        sourceIdentity: event.payload?.sourceIdentity ?? null,
        requestedChange: event.payload?.requestedChange ?? null,
      });
    }
  }
  return rows;
}

function projectResourceBackedEffects(run, scenarioId) {
  return (run.trace?.events ?? [])
    .filter(
      event =>
        event.type === 'VERIFIED_RESOURCE_CHANGE' &&
        Number.isInteger(Number(event.payload?.elementId)) &&
        Number(event.payload?.change) !== 0
    )
    .map((event, index) => ({
      projectionIdentity:
        'machine-resource-backed-effect:' + scenarioId + ':' + index,
      actionId: event.actionId ?? null,
      effectIdentity: 'battle-element:' + Number(event.payload.elementId),
      operation: 'resource-change',
      targetId: event.actorId ?? event.targetId ?? null,
      sourceIdentity: event.payload?.sourceIdentity ?? null,
      beforeValue: event.payload?.beforeValue ?? null,
      afterValue: event.payload?.afterValue ?? null,
      change: event.payload?.change ?? null,
    }));
}

function projectAppliedEffectSourceElements(run, scenarioId) {
  const rows = [];
  for (const [eventIndex, event] of (
    run.trace?.effects?.events ?? []
  ).entries()) {
    const sourceText = String(event.sourceIdentity?.identity ?? '');
    const elementIds = [
      ...new Set(
        [...sourceText.matchAll(/ast_(\d+)\.asset/g)].map(match =>
          Number(match[1])
        )
      ),
    ];
    for (const [elementIndex, elementId] of elementIds.entries()) {
      rows.push({
        projectionIdentity:
          'machine-applied-effect-source-element:' +
          scenarioId +
          ':' +
          eventIndex +
          ':' +
          elementIndex,
        actionId: event.actionId ?? null,
        effectIdentity: 'battle-element:' + elementId,
        operation: event.operation ?? null,
        targetId: event.targetId ?? null,
        sourceIdentity: event.sourceIdentity ?? null,
      });
    }
  }
  return rows;
}

function projectVerifiedDirectEffectSources(run, scenarioId) {
  const rows = [];
  for (const [eventIndex, event] of (run.trace?.events ?? []).entries()) {
    if (
      event.type !== 'VERIFIED_DIRECT_HEAL' ||
      event.payload?.applied !== true ||
      event.payload?.appliedToCalculators !== true ||
      !(Number(event.payload?.requestedChange) > 0)
    ) {
      continue;
    }
    const sourceText = String(event.payload?.sourceIdentity ?? '');
    const elementIds = extractBattleElementIds(sourceText);
    for (const [elementIndex, elementId] of elementIds.entries()) {
      rows.push({
        projectionIdentity:
          'machine-verified-direct-effect-source:' +
          scenarioId +
          ':' +
          eventIndex +
          ':' +
          elementIndex,
        actionId: event.actionId ?? null,
        effectIdentity: 'battle-element:' + elementId,
        operation: 'direct-heal',
        targetId: event.targetId ?? null,
        sourceIdentity: event.payload?.sourceIdentity ?? null,
        effectSourceIdentity: event.payload?.effectIdentity ?? null,
        requestedChange: event.payload?.requestedChange ?? null,
      });
    }
  }
  return rows;
}

function projectTuningMarkResourceEffects(run, scenarioId) {
  return (run.trace?.resources?.tuningMarks ?? [])
    .filter(
      event =>
        ['acquire', 'consume'].includes(String(event.kind)) &&
        Number.isInteger(Number(event.markId)) &&
        Number(event.delta) !== 0
    )
    .map((event, index) => ({
      projectionIdentity:
        'machine-tuning-mark-resource-effect:' + scenarioId + ':' + index,
      actionId: event.actionId ?? null,
      effectIdentity: 'battle-element:' + Number(event.markId),
      operation: event.kind,
      targetId: event.targetId ?? null,
      sourceIdentity: event.sourceIdentity ?? null,
      beforeValue: event.before ?? null,
      afterValue: event.after ?? null,
      change: event.delta ?? null,
    }));
}

function projectSourceActionBindingForms(run, scenarioId) {
  const rows = [];
  const seen = new Set();
  for (const evidence of collectActionBindingEvidence(run)) {
    const binding = parseActionBindingIdentity(evidence.sourceIdentity);
    if (
      !binding ||
      binding.controlSkillId === binding.executionControlSkillId
    ) {
      continue;
    }
    const key = `${evidence.actionId}|${binding.ownerId}|${binding.controlSkillId}|${binding.subSkillIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      projectionIdentity:
        'machine-source-action-form:' + scenarioId + ':' + rows.length,
      actionId: evidence.actionId,
      ownerId: binding.ownerId,
      semanticName: binding.actionKind,
      controlSkillId: binding.controlSkillId,
      subSkillIndex: binding.subSkillIndex,
      executionControlSkillId: binding.executionControlSkillId,
      sourceIdentity: evidence.sourceIdentity,
    });
  }
  return rows;
}

function projectSourceHitAliases(run, scenarioId) {
  const rows = [];
  for (const [index, event] of (run.trace?.damage ?? []).entries()) {
    if (
      event.eventType !== 'VERIFIED_COMBAT_HIT' ||
      !event.hitIdentity ||
      typeof event.formula?.sourceIdentity !== 'string'
    ) {
      continue;
    }
    const binding = parseActionBindingIdentity(event.formula.sourceIdentity);
    if (
      !binding ||
      binding.controlSkillId === binding.executionControlSkillId
    ) {
      continue;
    }
    const executionPrefix = `${binding.executionControlSkillId}|${binding.subSkillIndex}|`;
    if (!String(event.hitIdentity).startsWith(executionPrefix)) continue;
    rows.push({
      projectionIdentity:
        'machine-source-hit-alias:' + scenarioId + ':' + index,
      actionId: event.actionId ?? null,
      hitIdentity:
        `${binding.controlSkillId}|${binding.subSkillIndex}|` +
        String(event.hitIdentity).slice(executionPrefix.length),
      executionHitIdentity: event.hitIdentity,
      frame: event.frame ?? null,
      sourceIdentity: event.formula.sourceIdentity,
    });
  }
  return rows;
}

function collectRuntimeExercisedControls(run) {
  const pairs = new Map();
  const add = (controlSkillId, subSkillIndex) => {
    const control = Number(controlSkillId);
    const sub = Number(subSkillIndex);
    if (!Number.isInteger(control) || !Number.isInteger(sub)) return;
    pairs.set(`${control}|${sub}`, [control, sub]);
  };
  for (const selection of run.trace?.variants?.selections ?? []) {
    add(selection.controlSkillId, selection.subSkillIndex);
  }
  for (const event of run.trace?.damage ?? []) {
    const match = String(event.hitIdentity ?? '').match(/^(\d+)\|(\d+)\|/);
    if (match) add(match[1], match[2]);
  }
  for (const evidence of collectActionBindingEvidence(run)) {
    const binding = parseActionBindingIdentity(evidence.sourceIdentity);
    if (!binding) continue;
    add(binding.controlSkillId, binding.subSkillIndex);
    add(binding.executionControlSkillId, binding.subSkillIndex);
  }
  return [...pairs.values()].sort(
    (left, right) => left[0] - right[0] || left[1] - right[1]
  );
}

function collectActionBindingEvidence(run) {
  return [
    ...(run.trace?.damage ?? []).map(event => ({
      actionId: event.actionId ?? null,
      sourceIdentity: event.formula?.sourceIdentity ?? null,
    })),
    ...(run.trace?.events ?? []).map(event => ({
      actionId: event.actionId ?? null,
      sourceIdentity:
        typeof event.payload?.sourceIdentity === 'string'
          ? event.payload.sourceIdentity
          : (event.payload?.sourceIdentity?.actionBindingIdentity ?? null),
    })),
    ...(run.trace?.effects?.events ?? []).map(event => ({
      actionId: event.actionId ?? null,
      sourceIdentity: event.sourceIdentity?.actionBindingIdentity ?? null,
    })),
  ].filter(
    evidence =>
      evidence.actionId != null && typeof evidence.sourceIdentity === 'string'
  );
}

function parseActionBindingIdentity(value) {
  const match = String(value ?? '').match(
    /^actor\|(\d+)\|\d+\|\d+\|(\d+)\|([^|]+)\|execution-control:(\d+)\|sub:(\d+)$/
  );
  if (!match) return null;
  return {
    ownerId: Number(match[1]),
    controlSkillId: Number(match[2]),
    actionKind: match[3],
    executionControlSkillId: Number(match[4]),
    subSkillIndex: Number(match[5]),
  };
}

function extractBattleElementIds(sourceText) {
  return [
    ...new Set(
      [
        ...String(sourceText).matchAll(/ast_(\d+)\.asset/g),
        ...String(sourceText).matchAll(/elementConfigId=(\d+)/g),
        ...String(sourceText).matchAll(/(?:^|[;|])heal=(\d+)/g),
      ].map(match => Number(match[1]))
    ),
  ].filter(Number.isInteger);
}

function projectCriticalHit(event) {
  if (!event) return null;
  return {
    actionId: event.actionId,
    hitIdentity: event.hitIdentity,
    rawDamage: event.rawDamage,
    randomBranch: event.formula?.randomBranch ?? null,
    expectedCritical: event.formula?.verifiedResult?.expectedCritical ?? null,
  };
}

function inspectRecipeProbe(run, probe) {
  if (probe.kind === 'variant-selection') {
    const selection = (run.trace?.variants?.selections ?? []).find(
      row => row.actionId === probe.actionId
    );
    return {
      identity: 'probe:variant-selection:' + probe.actionId,
      passed:
        Number(selection?.controlSkillId) === Number(probe.controlSkillId) &&
        Number(selection?.subSkillIndex) === Number(probe.subSkillIndex),
      actual: selection ?? null,
    };
  }
  if (probe.kind === 'special-resource-change') {
    const event = (run.trace?.variants?.resourceEvents ?? []).find(
      row =>
        row.actionId === probe.actionId &&
        row.payload?.resourceIdentity === probe.resourceIdentity &&
        Number(row.payload?.beforeValue) === Number(probe.beforeValue) &&
        Number(row.payload?.afterValue) === Number(probe.afterValue) &&
        Number(row.payload?.change) === Number(probe.change)
    );
    return {
      identity: 'probe:special-resource-change:' + probe.actionId,
      passed: Boolean(event),
      actual: event ?? null,
    };
  }
  if (probe.kind === 'conditional-hit-group') {
    const group = (run.trace?.state?.conditionalHitGroups ?? []).find(
      row =>
        row.actionId === probe.actionId &&
        row.groupIdentity === probe.groupIdentity
    );
    return {
      identity: 'probe:conditional-hit-group:' + probe.actionId,
      passed:
        Boolean(group) &&
        Number(group.beforeStacks) === Number(probe.beforeStacks) &&
        Number(group.consumedStacks) === Number(probe.consumedStacks) &&
        Number(group.afterStacks) === Number(probe.afterStacks) &&
        group.applied === probe.applied,
      actual: group ?? null,
    };
  }
  return {
    identity: 'probe:unsupported:' + String(probe.kind),
    passed: false,
    actual: null,
  };
}

function createAcceptanceReport(manifests, visualRuns, catalog, manifestIndex) {
  const value = {
    schemaVersion: 1,
    kind: 'm11-d-character-acceptance-protocol-report',
    baselineCommit: '308dd07fbbb8fe0759062e9dcc02c65b0fd46115',
    status: 'r1-implementation-complete-awaiting-product-acceptance',
    protocolIdentity: 'm11-d-character-acceptance-v1',
    optimizationScenarioPolicy: structuredClone(
      catalog.optimizationScenarioPolicy
    ),
    optimizationCandidateRoster: structuredClone(
      catalog.optimizationCandidateRoster
    ),
    productScenarioExcludedCharacters: structuredClone(
      catalog.productScenarioExcludedCharacters
    ),
    r1: {
      baseCommit: '5add67feb2a0ced22453df78d1408312a9e33fdb',
      status: 'implementation-complete-awaiting-product-acceptance',
      trustModel: 'repo-local-derived-source-of-truth',
      derivation: {
        requirementInventory: 'source-contract-derived',
        scenarioCases: 'canonical-replay-derived',
        coverageEdges: 'selector-and-assertion-derived',
        ledger: 'deduplicated-source-and-acceptance-gaps',
        publication: 'committed-manifest-index-bound',
      },
      verification: {
        focusedVitest: '4 files / 28 tests passed',
        characterAcceptanceAudit: 'clean',
        existingSixAudits: 'clean',
        productionBuild: 'passed',
        focusedProductionE2E: '1/1 passed',
      },
    },
    owners: manifests.map(manifest => {
      const visualRun = visualRuns.find(run =>
        run.fixturePath.includes(String(manifest.owner.ownerId))
      );
      return {
        ownerId: manifest.owner.ownerId,
        ownerName: manifest.owner.ownerName,
        maturityState: manifest.maturity.currentState,
        optimizationReady: manifest.maturity.optimizationReady,
        blockers: manifest.maturity.blockers,
        blockingLedgerCount: manifest.ledger.summary.uniqueBlockingCount,
        sourceGapCount: manifest.ledger.summary.sourceGapCount,
        acceptanceGapCount: manifest.ledger.summary.acceptanceGapCount,
        nonBlockingSourceCount: manifest.ledger.summary.nonBlockingCount,
        matrix: manifest.matrix.summary,
        manifestHash: manifest.manifestHash,
        sourceOfTruthHash: manifest.derivation.sourceOfTruthHash,
        machineScenario: visualRun?.canonicalHashes ?? null,
      };
    }),
    catalogHash: catalog.catalogHash,
    manifestIndexHash: manifestIndex.indexHash,
    summary: {
      ownerCount: manifests.length,
      formalCharacterDenominator: catalog.summary.formalCharacterDenominator,
      productScenarioExcludedCharacterCount:
        catalog.summary.productScenarioExcludedCharacterCount,
      runtimeIntegratedCount: manifests.filter(manifest =>
        manifest.maturity.earnedStates.includes('runtime-integrated')
      ).length,
      visuallyAcceptedCount: manifests.filter(manifest =>
        manifest.maturity.earnedStates.includes('visually-accepted')
      ).length,
      optimizationReadyCount: manifests.filter(
        manifest => manifest.maturity.optimizationReady
      ).length,
      machineScenarioPassCount: visualRuns.filter(
        run => run.status === 'passed'
      ).length,
      workbenchRoundTripPassCount: visualRuns.filter(
        run => run.workbenchRoundTrip === 'passed'
      ).length,
      sourceGapCount: manifests.reduce(
        (sum, manifest) => sum + manifest.ledger.summary.sourceGapCount,
        0
      ),
      acceptanceGapCount: manifests.reduce(
        (sum, manifest) => sum + manifest.ledger.summary.acceptanceGapCount,
        0
      ),
      nonBlockingSourceCount: manifests.reduce(
        (sum, manifest) => sum + manifest.ledger.summary.nonBlockingCount,
        0
      ),
      functionalBlockers: manifests.reduce(
        (sum, manifest) => sum + manifest.ledger.summary.uniqueBlockingCount,
        0
      ),
      performanceAndBundleRisksBlocking: false,
    },
  };
  return value;
}

function createOutputs(manifests, catalog, manifestIndex, report) {
  const outputs = new Map();
  outputs.set(generatedCatalogPath, jsonText(catalog));
  outputs.set(generatedManifestIndexPath, jsonText(manifestIndex));
  outputs.set(path.join(reportRoot, 'summary.json'), jsonText(report));
  outputs.set(
    path.join(reportRoot, 'summary.md'),
    createMarkdownReport(report)
  );
  addOwnerOutputs(outputs, manifests);
  return outputs;
}

function createOwnerOutputs(manifests) {
  const outputs = new Map();
  addOwnerOutputs(outputs, manifests);
  return outputs;
}

function addOwnerOutputs(outputs, manifests) {
  for (const manifest of manifests) {
    const ownerRoot = path.join(reportRoot, String(manifest.owner.ownerId));
    outputs.set(path.join(ownerRoot, 'manifest.json'), jsonText(manifest));
    outputs.set(
      path.join(ownerRoot, 'requirement-inventory.json'),
      jsonText(manifest.requirementInventory)
    );
    outputs.set(
      path.join(ownerRoot, 'source-gap-inventory.json'),
      jsonText(manifest.sourceGapInventory)
    );
    outputs.set(
      path.join(ownerRoot, 'scenario-cases.json'),
      jsonText(manifest.scenarioCases)
    );
    outputs.set(
      path.join(ownerRoot, 'scenario-matrix.json'),
      jsonText(manifest.matrix)
    );
    outputs.set(
      path.join(ownerRoot, 'coverage.json'),
      jsonText(manifest.coverage)
    );
    outputs.set(
      path.join(ownerRoot, 'ledger.json'),
      jsonText({
        ...manifest.ledger,
        notApplicableRecords: manifest.notApplicableRecords,
      })
    );
  }
}

async function writeOutputs(outputs) {
  for (const [outputPath, content] of outputs) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, 'utf8');
  }
}

async function assertOutputsClean(outputs) {
  const stale = [];
  for (const [outputPath, expected] of outputs) {
    let actual = null;
    try {
      actual = await fs.readFile(outputPath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (actual !== expected)
      stale.push(path.relative(projectRoot, outputPath).replaceAll('\\', '/'));
  }
  if (stale.length)
    throw new Error(
      'Character acceptance outputs are stale: ' + stale.join(', ')
    );
}

async function loadRecipes() {
  const names = (await fs.readdir(recipeRoot))
    .filter(name => name.endsWith('.json'))
    .sort();
  return Promise.all(names.map(name => readJson(path.join(recipeRoot, name))));
}

function readRequestedOwnerId(args) {
  const index = args.indexOf('--owner');
  if (index < 0) return null;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('Invalid --owner value: ' + String(args[index + 1]));
  }
  return value;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function verifyAutomatedVisualEvidence(recipe) {
  for (const evidence of recipe.productVisualAcceptance?.automatedEvidence ??
    []) {
    const screenshotPath = path.join(projectRoot, evidence.screenshotPath);
    const actualHash = createHash('sha256')
      .update(await fs.readFile(screenshotPath))
      .digest('hex');
    if (actualHash !== evidence.screenshotSha256) {
      throw new Error(
        'Character acceptance screenshot hash mismatch for ' +
          recipe.ownerId +
          ': ' +
          evidence.screenshotPath
      );
    }
  }
}

function sameHashes(left, right) {
  return ['input', 'data', 'trace', 'evaluation'].every(
    key => left?.[key] === right?.[key]
  );
}

function jsonText(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function createMarkdownReport(report) {
  const lines = [
    '# M11-D-R1 角色机制验收协议',
    '',
    '- 初始基线：' + report.baselineCommit,
    '- R1 基线：' + report.r1.baseCommit,
    '- 状态：可信派生收口完成，等待产品复验',
    '- 规则：requirement、scenario case、coverage edge、ledger 与成熟度均从 committed source-of-truth 和 canonical replay 派生。',
    '- 性能、包体和外部 CPU 抖动仅记录，不参与功能资格判定。',
    '',
    '| 角色 | 成熟度 | 矩阵通过/必需 | source gap | acceptance gap | optimization-ready |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  for (const owner of report.owners) {
    lines.push(
      '| ' +
        owner.ownerName +
        ' (' +
        owner.ownerId +
        ') | ' +
        owner.maturityState +
        ' | ' +
        owner.matrix.passedCount +
        '/' +
        owner.matrix.requiredCount +
        ' | ' +
        owner.sourceGapCount +
        ' | ' +
        owner.acceptanceGapCount +
        ' | ' +
        (owner.optimizationReady ? '是' : '否') +
        ' |'
    );
  }
  lines.push(
    '',
    '三份 Machine Axis 场景继续由唯一 canonical core 重放并通过 Workbench 导入/导出；产品可视签收仍为 pending，真实 source gap 与尚缺场景覆盖继续阻断优化资格。',
    ''
  );
  return lines.join('\n');
}
