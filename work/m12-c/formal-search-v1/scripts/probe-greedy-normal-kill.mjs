import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

import {
  assertGreedyNormalSynthesisAvailable,
  classifyGreedyKillProbe,
  deriveGreedyNormalCadence,
  synthesizeGreedyNormalAxis,
} from './greedy-normal-axis.mjs';

assertGreedyNormalSynthesisAvailable();

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
);
const sourceConfigIdentity =
  readArgument('--source-config') ??
  'm12c-source-v1:107002=107002+109001=109001+112001=112001';
const maximumActions = Number(readArgument('--max-actions') ?? 400);
const config = JSON.parse(
  await fs.readFile(
    path.join(
      projectRoot,
      'work',
      'm12-c',
      'formal-search-v1',
      'config',
      'round3.fastest-kill.depth16-ring.json'
    ),
    'utf8'
  )
);
const contractTemplate = JSON.parse(
  await fs.readFile(path.join(projectRoot, config.contractTemplate), 'utf8')
);
const mechanicsPackage = JSON.parse(
  await fs.readFile(
    path.join(
      projectRoot,
      'src',
      'data',
      'generated',
      'verified-combat-mechanics-package.json'
    ),
    'utf8'
  )
);

const vite = await createServer({
  root: projectRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const [
    packageModule,
    serviceModule,
    outerBuildModule,
    outerSearchModule,
    generatorModule,
    searchStateModule,
    killModule,
  ] = await Promise.all([
    vite.ssrLoadModule('/src/data/verifiedCombatMechanicsPackage.js'),
    vite.ssrLoadModule('/src/machine-axis/machineAxisService.js'),
    vite.ssrLoadModule('/src/machine-axis/m12cOuterBuildService.js'),
    vite.ssrLoadModule('/src/machine-axis/m12cOuterSearchService.js'),
    vite.ssrLoadModule('/src/machine-axis/machineAxisSearchGenerator.js'),
    vite.ssrLoadModule('/src/machine-axis/machineAxisSearchState.js'),
    vite.ssrLoadModule('/src/machine-axis/machineAxisKillEvaluator.js'),
  ]);
  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const service = serviceModule.createMachineAxisService();
  const outerBuildService = outerBuildModule.createM12cOuterBuildService();
  const outerSearchService = outerSearchModule.createM12cOuterSearchService({
    machineAxisService: service,
    outerBuildService,
  });
  const pool = outerBuildService.pool();
  const sourceConfig = pool.teamCatalog.sourceConfigs.find(
    row => row.sourceConfigIdentity === sourceConfigIdentity
  );
  if (!sourceConfig) throw new Error('Requested source config was not found');
  const planResult = outerBuildService.plan({
    sourceConfigIdentity,
    constraints: { perActor: config.buildConstraints },
  });
  if (!planResult.valid || !planResult.plan) {
    throw new Error(`Build plan failed: ${JSON.stringify(planResult.issues)}`);
  }
  const [build] = [
    ...outerBuildService.iterate(planResult.plan, { maxCandidates: 1 }),
  ];
  if (!build) throw new Error('Build iterator produced no candidate');
  const binding = await outerSearchService.bind({
    contract: contractTemplate,
    build,
    objective: 'fastest-kill',
    initialFrontOptimizationObjectId: '112001',
    initialState: materializeInitialState(config.presetSpec, sourceConfig),
  });
  const baseAxis = binding.contract;
  const generator = generatorModule.createMachineAxisSearchGenerator({
    service,
  });
  const firstRun = service.simulate(baseAxis);
  const first = requireSingleNormalCandidate(
    generator,
    baseAxis,
    firstRun,
    generatorModule,
    searchStateModule
  );
  const oneActionAxis = {
    ...structuredClone(baseAxis),
    actions: [structuredClone(first.action)],
  };
  const secondRun = service.simulate(oneActionAxis);
  const second = requireSingleNormalCandidate(
    generator,
    oneActionAxis,
    secondRun,
    generatorModule,
    searchStateModule
  );
  const cadence = deriveGreedyNormalCadence(first.action, second.action);
  process.stdout.write(
    `${JSON.stringify({
      event: 'cadence-derived',
      sourceConfigIdentity,
      buildHash: build.buildHash,
      initialFront: binding.initialFront,
      cadenceHash: cadence.cadenceHash,
      cadenceFrames: cadence.cadenceFrames,
      publicActionId: cadence.publicActionId,
    })}\n`
  );

  const probeCache = new Map();
  const runProbe = actionCount => {
    if (probeCache.has(actionCount)) return probeCache.get(actionCount);
    const axis = synthesizeGreedyNormalAxis({
      baseAxis,
      cadence,
      actionCount,
    });
    const startedAt = Date.now();
    try {
      const simulation = service.simulate(axis);
      const proof = killModule.createFastestKillProof(simulation, axis, {
        objectiveContract: axis.scenario.objectiveContract,
      });
      const classification = classifyGreedyKillProbe({ proof });
      const enemy = simulation.trace?.state?.final?.enemy ?? {};
      const row = {
        event: 'probe',
        actionCount,
        wallTimeMs: Date.now() - startedAt,
        classification,
        enemyHp: enemy.hp ?? null,
        enemyMaxHp: enemy.maxHp ?? null,
        legalityPassed: simulation.actionLegalityProof?.passed === true,
        inputHash: simulation.hashes?.input ?? null,
        traceHash: simulation.hashes?.trace ?? null,
        axis,
        simulation,
        proof,
      };
      probeCache.set(actionCount, row);
      process.stdout.write(`${JSON.stringify(projectProbe(row))}\n`);
      return row;
    } catch (error) {
      const row = {
        event: 'probe',
        actionCount,
        wallTimeMs: Date.now() - startedAt,
        classification: classifyGreedyKillProbe({ error }),
        error,
      };
      probeCache.set(actionCount, row);
      process.stdout.write(`${JSON.stringify(projectProbe(row))}\n`);
      return row;
    }
  };

  let lower = 0;
  let upper = null;
  let killed = null;
  for (const actionCount of createProbeCounts(maximumActions)) {
    const row = runProbe(actionCount);
    if (row.classification.status === 'valid-not-killed') {
      lower = actionCount;
      continue;
    }
    upper = actionCount;
    if (row.classification.status === 'killed-valid') killed = row;
    break;
  }
  if (upper != null) {
    while (upper - lower > 1) {
      const middle = Math.floor((lower + upper) / 2);
      const row = runProbe(middle);
      if (row.classification.status === 'valid-not-killed') {
        lower = middle;
      } else {
        upper = middle;
        if (row.classification.status === 'killed-valid') killed = row;
      }
    }
    const boundary = runProbe(upper);
    if (boundary.classification.status === 'killed-valid') killed = boundary;
  }
  process.stdout.write(
    `${JSON.stringify({
      event: 'probe-finished',
      sourceConfigIdentity,
      validNotKilledLowerBound: lower,
      firstNonUnkilledUpperBound: upper,
      killedCandidateActionCount: killed?.actionCount ?? null,
      killedFormalScore: killed?.classification?.formalScore ?? null,
      killedInputHash: killed?.simulation?.hashes?.input ?? null,
      killedTraceHash: killed?.simulation?.hashes?.trace ?? null,
    })}\n`
  );
  if (!killed) {
    process.exitCode = 2;
  }
} finally {
  await vite.close();
}

function requireSingleNormalCandidate(
  generator,
  axis,
  run,
  generatorModule,
  searchStateModule
) {
  const candidates = generator.generateNextActions({
    axis,
    run,
    nextStartFrameByActor: generatorModule.deriveNextStartFrameByActor(run),
    options: {
      activeActorId: searchStateModule.deriveActiveActorId(run.trace),
      includeKibo: false,
      includeSwitch: false,
      includeNormalAttacks: true,
      maxActionsPerOwner: 6,
      maxKiboActions: 1,
      requireFormalLegality: true,
      actionFilter: {
        character: entry => entry.actionKind === 'normal-attack',
        kibo: () => false,
      },
    },
  });
  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one verified Hero normal candidate, got ${candidates.length}`
    );
  }
  return candidates[0];
}

function materializeInitialState(presetSpec, sourceConfig) {
  const objectIds = sourceConfig.actors
    .map(actor => String(actor.optimizationObjectId))
    .sort();
  const actorSpByOptimizationObjectId = Object.fromEntries(
    objectIds.map(objectId => [objectId, 100])
  );
  const kiboSpByOptimizationObjectId = Object.fromEntries(
    objectIds.map(objectId => [objectId, 100])
  );
  const specialResources = objectIds.includes('103002')
    ? [
        {
          optimizationObjectId: '103002',
          resourceIdentity: 'actor:103002:element:103002047',
          currentValue: Number(presetSpec.rubyAmmo),
          maxValue: 12,
          inputStep: 1,
          scenarioConfigurable: true,
          activeStates: [],
        },
      ]
    : [];
  return {
    presetId: presetSpec.presetId,
    actorSpByOptimizationObjectId,
    kiboSpByOptimizationObjectId,
    tuningMarks: [],
    specialResources,
  };
}

function createProbeCounts(maximum) {
  const values = [];
  for (let count = 16; count < maximum; count *= 2) values.push(count);
  values.push(maximum);
  return [...new Set(values)];
}

function projectProbe(row) {
  return {
    event: row.event,
    actionCount: row.actionCount,
    wallTimeMs: row.wallTimeMs,
    classification: row.classification,
    enemyHp: row.enemyHp ?? null,
    enemyMaxHp: row.enemyMaxHp ?? null,
    legalityPassed: row.legalityPassed ?? null,
    inputHash: row.inputHash ?? null,
    traceHash: row.traceHash ?? null,
  };
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}
