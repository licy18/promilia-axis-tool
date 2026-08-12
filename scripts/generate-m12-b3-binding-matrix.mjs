import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRootDefault = path.resolve(scriptDirectory, '..');

const readJson = async (root, file) =>
  JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));

export async function createM12B3BindingMatrix({
  projectRoot = projectRootDefault,
} = {}) {
  const [
    summary,
    roster,
    bindingMatrix,
    qualificationCatalog,
    mechanicsPackage,
    equipmentCatalog,
  ] = await Promise.all([
    readJson(
      projectRoot,
      'reports/m12/m12-b3-optimization-qualification-summary.json'
    ),
    readJson(
      projectRoot,
      'reports/m12/m12-b3-optimization-qualification-roster.json'
    ),
    readJson(
      projectRoot,
      'reports/m12/m12-b3-optimization-qualification-binding-matrix.json'
    ),
    readJson(
      projectRoot,
      'src/data/generated/optimization-qualification-catalog.json'
    ),
    readJson(
      projectRoot,
      'src/data/generated/verified-combat-mechanics-package.json'
    ),
    readJson(projectRoot, 'src/data/generated/equipment.json'),
  ]);

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
    const objectiveModule = await vite.ssrLoadModule(
      '/src/machine-axis/machineAxisObjectiveContract.js'
    );
    const initialStatePolicyModule = await vite.ssrLoadModule(
      '/src/machine-axis/m12cInitialStatePolicy.js'
    );
    const policyModule = await vite.ssrLoadModule(
      '/src/optimization-scenario/optimizationScenarioPolicy.js'
    );
    const protocolModule = await vite.ssrLoadModule(
      '/src/optimization-qualification/optimizationQualificationProtocol.js'
    );
    const stageGateModule = await vite.ssrLoadModule(
      '/src/optimization-qualification/optimizationQualificationStageGate.js'
    );
    const canonicalModule = await vite.ssrLoadModule(
      '/src/simulation/headless/canonicalSerialization.js'
    );

    packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const service = serviceModule.createMachineAxisService();
    const adapter = adapterModule.createWorkbenchMachineAxisAdapter({
      service,
    });

    const checks = [];
    const addCheck = (dimension, identity, passed, detail = null) => {
      checks.push({ dimension, identity, passed, detail });
    };

    // ---------- static denominator / hash consistency ----------
    const readyCounts = summary.optimizationReadyCounts ?? {};
    addCheck(
      'static',
      'denominator-counts-9-43-62-137-12',
      readyCounts.character === 9 &&
        readyCounts.kibo === 43 &&
        readyCounts['soul-essence'] === 62 &&
        readyCounts.equipment === 137 &&
        readyCounts['set-skill'] === 12,
      { readyCounts }
    );
    addCheck(
      'static',
      'zero-blocking-gaps',
      summary.gapCounts?.blockingUniqueGapCount === 0,
      { gapCounts: summary.gapCounts }
    );
    addCheck('static', 'm12c-unlocked', summary.m12cLocked === false, {
      m12cLocked: summary.m12cLocked,
    });
    const admissionCharacters =
      qualificationCatalog.admission?.characters ?? [];
    addCheck(
      'static',
      'character-admission-closed',
      admissionCharacters.length === 9 &&
        admissionCharacters.includes('112001') &&
        admissionCharacters.includes('STARBORN'),
      { admissionCharacters }
    );
    const matrixSummary = bindingMatrix.summary ?? {};
    addCheck(
      'static',
      'binding-matrix-fully-qualified',
      matrixSummary.actorKiboEdgeCount ===
        matrixSummary.actorKiboQualifiedEdgeCount &&
        matrixSummary.actorSoulEssenceCompatibleEdgeCount ===
          matrixSummary.actorSoulEssenceQualifiedEdgeCount &&
        matrixSummary.actorEquipmentEdgeCount ===
          matrixSummary.actorEquipmentQualifiedEdgeCount &&
        matrixSummary.setSkillThresholdCount ===
          matrixSummary.setSkillThresholdQualifiedCount,
      { matrixSummary }
    );
    addCheck(
      'static',
      'starborn-alias-hash-equal',
      roster.starborn?.aliasHashesEqual === true,
      { starborn: roster.starborn }
    );
    addCheck(
      'static',
      'artifact-hash-consistency',
      summary.rosterHash === roster.rosterHash &&
        summary.bindingMatrixHash === bindingMatrix.bindingMatrixHash &&
        summary.catalogHash === qualificationCatalog.catalogHash,
      {
        rosterHash: summary.rosterHash,
        bindingMatrixHash: summary.bindingMatrixHash,
        catalogHash: summary.catalogHash,
      }
    );

    // ---------- strict axis builders ----------
    const sourceProfileFor = characterId =>
      qualificationCatalog.cultivation.character.profiles.find(
        entry => Number(entry.characterId) === characterId
      );
    const createCultivationProfile = ({
      bondLevel = 1,
      actorLevel = 80,
    } = {}) => ({
      schemaVersion: 1,
      contractName: 'AzPrOptimizationCultivationProfile',
      profileId: 'm12-b3-e22-binding-matrix',
      actors: [101010, 103002, 102001].map((characterId, index) => {
        const sourceProfile = sourceProfileFor(characterId);
        const sourceRank = sourceProfile?.starGiftRanks.find(
          entry => Number(entry.rank) === 7
        );
        return {
          slotId: `slot-${index + 1}`,
          character: {
            level: actorLevel,
            starGiftRank: 7,
            starGiftNodeIds: (sourceRank?.nodes ?? []).map(node =>
              Number(node.runeId)
            ),
          },
          kibo: {
            level: 80,
            talents: [1, 3, 4, 5].map(attributeId => ({
              attributeId,
              level: 10,
            })),
            dnaFactors: [],
            bondLevel,
          },
          soulEssence: { level: 80, rank: 6, star: 1 },
          equipment: Object.fromEntries(
            ['weapon', 'top', 'bottom', 'earring', 'ring'].map(slot => [
              slot,
              {
                rarity: 4,
                enhancementLevel: 9,
                tuningScore: 110,
                instanceTier: 'starborn',
                maxValue: 110,
              },
            ])
          ),
        };
      }),
    });
    const equipmentRecords = equipmentCatalog.items.filter(
      record => record.rarity === '4星'
    );
    const equipmentTypeBySlot = {
      weapon: '武器',
      top: '上装',
      bottom: '下装',
      earring: '耳环',
      ring: '戒指',
    };
    const createAxis = ({
      profile = createCultivationProfile(),
      mode = 'research',
      soulId = 10001,
      ringSlot = null,
      actions = [],
      catalog = qualificationCatalog,
    } = {}) => {
      const axis = {
        schemaVersion: 1,
        contractName: 'AzPrMachineAxis',
        dataIdentity: {
          verifiedMechanicsPackageId: mechanicsPackage.packageId,
          verifiedMechanicsPackageHash: mechanicsPackage.packageHash,
          mechanicsProfileId: 'azpr-three-value-verified-tc-20260718',
          mechanicsProfileVersion: 1,
        },
        scenario: {
          id: 'm12-b3-e22-binding-matrix',
          name: 'M12 B3 E22 Binding Matrix',
          fps: 60,
          durationFrames: 600,
          team: [101010, 103002, 102001].map((characterId, index) => ({
            slotId: `slot-${index + 1}`,
            characterId,
            level: 80,
            initialSp: 0,
            loadout: {
              kiboId: 500001,
              soulessenceId: soulId,
              equipment: Object.fromEntries(
                ['weapon', 'top', 'bottom', 'earring', 'ring'].map(slot => [
                  slot,
                  ringSlot && slot === 'ring'
                    ? ringSlot
                    : Number(
                        equipmentRecords.find(
                          record => record.type === equipmentTypeBySlot[slot]
                        ).id
                      ),
                ])
              ),
            },
          })),
          enemy: { enemyId: 300032 },
          objectiveContract: objectiveModule.createMachineAxisObjectiveContract(
            'cycle-dps-no-toughness'
          ),
          target: structuredClone(
            policyModule.getOptimizationScenarioPolicy().assumptions
              .targetPolicy
          ),
          initialRuntimeState: {},
          projectile: { targetDistance: 0, defaultWillHit: true },
          critical: { policy: 'expected', seed: null },
          optimizationScenarioPolicy:
            policyModule.createOptimizationScenarioPolicyBinding(),
          optimizationQualification: {
            mode,
            catalogHash: catalog.catalogHash,
          },
          cultivationProfile: profile,
        },
        actions,
      };
      if (mode === 'formal') {
        const initialActor = axis.scenario.team[0];
        axis.scenario.initialRuntimeState = {
          controlledActor: {
            actorId: `actor-${initialActor.characterId}`,
            characterId: initialActor.characterId,
          },
        };
        axis.scenario.initialStatePreset =
          initialStatePolicyModule.createM12cInitialStatePresetBinding({
            presetId: 'm12-b3-e22-binding-matrix-cold-start-v1',
            objectiveId: axis.scenario.objectiveContract.objectiveId,
            team: axis.scenario.team,
            initialRuntimeState: axis.scenario.initialRuntimeState,
            mechanicsPackage,
          });
      }
      return axis;
    };
    const createFormalAxisForCatalog = catalog => {
      const axis = createAxis({ mode: 'formal', catalog });
      for (const slot of axis.scenario.team) {
        const actorObjectId = String(slot.characterId);
        const compatibleSoul = catalog.bindingMatrix.actorSoulEssence.find(
          edge =>
            String(edge.actorObjectId) === actorObjectId &&
            edge.compatible === true &&
            edge.qualificationReady === true
        );
        if (compatibleSoul) {
          slot.loadout.soulessenceId = Number(compatibleSoul.soulEssenceId);
        }
      }
      return axis;
    };

    // ---------- B1 装配→角色 ----------
    const legalPrepared = service.prepare(createAxis({}));
    addCheck(
      'loadout-to-character',
      'legal-strict-loadout-prepares',
      legalPrepared.valid === true,
      { issues: (legalPrepared.issues ?? []).slice(0, 3) }
    );
    const illegalSoulPrepared = service.prepare(
      createAxis({ mode: 'formal', soulId: 10001 })
    );
    const illegalSoulCodes = (illegalSoulPrepared.issues ?? []).map(
      issue => issue.code
    );
    addCheck(
      'loadout-to-character',
      'profession-mismatch-soul-rejected',
      illegalSoulPrepared.valid === false &&
        illegalSoulCodes.includes(
          'machine-axis-optimization-binding-not-qualified'
        ),
      { codes: illegalSoulCodes.slice(0, 6) }
    );
    const weaponId = equipmentRecords.find(record => record.type === '武器').id;
    const illegalEquipmentPrepared = service.prepare(
      createAxis({ ringSlot: weaponId })
    );
    const illegalEquipmentCodes = (illegalEquipmentPrepared.issues ?? []).map(
      issue => issue.code
    );
    addCheck(
      'loadout-to-character',
      'equipment-slot-mismatch-rejected',
      illegalEquipmentPrepared.valid === false &&
        illegalEquipmentCodes.includes(
          'machine-axis-cultivation-equipment-slot-mismatch'
        ),
      { codes: illegalEquipmentCodes.slice(0, 6) }
    );

    // ---------- B2 角色→奇波继承 ----------
    const readKiboAtk = compiled => {
      const actor = (
        compiled.canonicalCompilation?.scenario?.actors ?? []
      ).find(entry => entry.characterId === 101010);
      return actor?.verifiedStaticKiboProperties?.attributes?.find(
        attribute => attribute.key === 'ATK'
      )?.runtimeValue;
    };
    const bond1 = service.compile(
      createAxis({ profile: createCultivationProfile({ bondLevel: 1 }) })
    );
    const bond10 = service.compile(
      createAxis({ profile: createCultivationProfile({ bondLevel: 10 }) })
    );
    const bond1Atk = readKiboAtk(bond1);
    const bond10Atk = readKiboAtk(bond10);
    addCheck(
      'character-to-kibo-inheritance',
      'bond-level-changes-kibo-inherited-stats',
      Number.isFinite(bond1Atk) &&
        Number.isFinite(bond10Atk) &&
        bond1Atk !== bond10Atk,
      { bond1Atk, bond10Atk }
    );
    const level80 = service.compile(
      createAxis({ profile: createCultivationProfile({ actorLevel: 80 }) })
    );
    const level40 = service.compile(
      createAxis({ profile: createCultivationProfile({ actorLevel: 40 }) })
    );
    const attack80 = level80.canonicalCompilation?.scenario?.actors?.find(
      entry => entry.characterId === 101010
    )?.stats?.attack;
    const attack40 = level40.canonicalCompilation?.scenario?.actors?.find(
      entry => entry.characterId === 101010
    )?.stats?.attack;
    addCheck(
      'character-to-kibo-inheritance',
      'character-level-changes-actor-and-inherited-stats',
      attack80 !== attack40,
      { attack80, attack40 }
    );

    // ---------- B3 来源/目标 ----------
    const threeActorFixture = await readJson(
      projectRoot,
      'fixtures/machine-axis/m11-b-three-actor-authority.json'
    );
    threeActorFixture.dataIdentity.verifiedMechanicsPackageHash =
      mechanicsPackage.packageHash;
    const threeActorSim = service.simulate(threeActorFixture);
    const sourceTargetEvents = (
      threeActorSim.trace?.effects?.events ?? []
    ).filter(
      event =>
        (event.after?.effectAdderActorId ?? event.sourceActorId) &&
        (event.after?.targetId ?? event.targetId)
    );
    addCheck(
      'effect-source-target',
      'landed-effects-carry-source-and-target',
      sourceTargetEvents.length > 0,
      { sourceTargetEventCount: sourceTargetEvents.length }
    );

    // ---------- B4 前后台/切人 ----------
    const switchFixture = await readJson(
      projectRoot,
      'fixtures/character-acceptance/107001-switch-star-carry.json'
    );
    switchFixture.dataIdentity.verifiedMechanicsPackageHash =
      mechanicsPackage.packageHash;
    const switchPrepared = service.prepare(switchFixture);
    const switchSim = service.simulate(switchFixture);
    const switchPlanIds = (switchSim.trace?.executionPlan?.actions ?? []).map(
      action => action.actionId ?? action.id ?? ''
    );
    const switchActionExecuted = switchPlanIds.some(id =>
      /switch|star-carry|enter|exit/i.test(String(id))
    );
    addCheck(
      'foreground-background-switch',
      'switch-scenario-executes-and-replays-stable',
      switchPrepared.valid === true &&
        switchActionExecuted &&
        JSON.stringify(service.simulate(switchFixture).hashes) ===
          JSON.stringify(switchSim.hashes),
      { switchPlanIds: switchPlanIds.slice(0, 8) }
    );

    // ---------- B5 同名奇波跨 owner 隔离 ----------
    const sharedKiboFixture = structuredClone(threeActorFixture);
    sharedKiboFixture.scenario.team = sharedKiboFixture.scenario.team.map(
      member => ({
        ...member,
        loadout: { ...(member.loadout ?? {}), kiboId: 500001 },
      })
    );
    const sharedPrepared = service.prepare(sharedKiboFixture);
    const sharedSim = service.simulate(sharedKiboFixture);
    const kiboResourceActorIds = [
      ...new Set(
        (sharedSim.trace?.resources?.kibos ?? []).map(
          row => row.actorId ?? row.payload?.actorId ?? null
        )
      ),
    ].filter(Boolean);
    const matrixPolicy = bindingMatrix.policy ?? {};
    addCheck(
      'cross-owner-kibo-isolation',
      'same-name-kibo-keeps-per-actor-resources',
      sharedPrepared.valid === true && kiboResourceActorIds.length >= 3,
      { kiboResourceActorIds }
    );
    addCheck(
      'cross-owner-kibo-isolation',
      'duplicate-species-policy-and-owner-identity',
      matrixPolicy.duplicateKiboSpeciesAcrossDifferentActors === 'allowed' &&
        matrixPolicy.kiboCooldownOwnerIdentity === 'actorSlotId+kiboId',
      { matrixPolicy }
    );

    // ---------- B6 同帧顺序 ----------
    const orderingFixture = await readJson(
      projectRoot,
      'fixtures/character-acceptance/107001-wind-expiry-boundary.json'
    );
    orderingFixture.dataIdentity.verifiedMechanicsPackageHash =
      mechanicsPackage.packageHash;
    const orderingPrepared = service.prepare(orderingFixture);
    const orderingFirst = service.simulate(orderingFixture);
    const orderingSecond = service.simulate(orderingFixture);
    addCheck(
      'same-frame-ordering',
      'same-frame-scenario-deterministic',
      orderingPrepared.valid === true &&
        JSON.stringify(orderingFirst.hashes) ===
          JSON.stringify(orderingSecond.hashes) &&
        (orderingFirst.trace?.effects?.events ?? []).length > 0,
      {
        traceHash: orderingFirst.hashes?.trace,
        effectEventCount: (orderingFirst.trace?.effects?.events ?? []).length,
      }
    );

    // ---------- B7 保存重放 ----------
    const cycleFixture = await readJson(
      projectRoot,
      'fixtures/machine-axis/m12-cycle-dps-example.json'
    );
    const replay = adapter.importContract(cycleFixture.contract);
    const exported = adapter.exportProject(replay.project);
    const replayHashes = service.simulate(exported).hashes;
    const directHashes = service.simulate(cycleFixture.contract).hashes;
    const jsonRoundTrip = service.simulate(
      JSON.parse(JSON.stringify(exported))
    ).hashes;
    addCheck(
      'save-replay',
      'adapter-roundtrip-hash-identical',
      JSON.stringify(replayHashes) === JSON.stringify(directHashes),
      { replayHashes, directHashes }
    );
    addCheck(
      'save-replay',
      'json-carrier-roundtrip-hash-identical',
      JSON.stringify(jsonRoundTrip) === JSON.stringify(directHashes),
      { jsonHashes: jsonRoundTrip }
    );

    // ---------- B8 连续循环 ----------
    const cycleEnvelope = structuredClone(cycleFixture);
    cycleEnvelope.contract.dataIdentity.verifiedMechanicsPackageHash =
      mechanicsPackage.packageHash;
    cycleEnvelope.contract.scenario.team =
      cycleEnvelope.contract.scenario.team.map((member, index) => ({
        ...member,
        slotId: `slot-${index + 1}`,
      }));
    cycleEnvelope.contract.scenario.initialRuntimeState = {
      ...(cycleEnvelope.contract.scenario.initialRuntimeState ?? {}),
      kiboEnergyBySlot: [],
    };
    const cycleResult = service.evaluateCycle(cycleEnvelope);
    addCheck(
      'continuous-cycle',
      'cycle-closed-with-stable-hashes',
      cycleResult?.valid === true &&
        cycleResult?.status === 'closed' &&
        Boolean(cycleResult?.hashes?.cycle),
      {
        status: cycleResult?.status,
        cycleHash: cycleResult?.hashes?.cycle,
        traceHash: cycleResult?.hashes?.trace,
      }
    );

    // ---------- re-lock ----------
    const tamperedCatalog = structuredClone(qualificationCatalog);
    const giseleRecord = tamperedCatalog.records.find(
      record =>
        record.objectKind === 'character' && record.objectId === '112001'
    );
    if (giseleRecord) {
      giseleRecord.optimizationReady = false;
      giseleRecord.maturityState = 'runtime-integrated';
      giseleRecord.blockerCodes = ['synthetic-revoked-112001'];
    }
    tamperedCatalog.admission = {
      ...tamperedCatalog.admission,
      characters: (tamperedCatalog.admission?.characters ?? []).filter(
        id => String(id) !== '112001'
      ),
    };
    const tamperedFormalAxis = createFormalAxisForCatalog(tamperedCatalog);
    const relockIssues =
      protocolModule.createOptimizationQualificationIssuesForContract(
        tamperedFormalAxis,
        { catalog: tamperedCatalog }
      );
    const relockCodes = (relockIssues ?? []).map(issue => issue.code);
    const stageGate =
      stageGateModule.deriveOptimizationQualificationStageGate(tamperedCatalog);
    addCheck(
      're-lock',
      'revoking-one-object-re-locks-formal-admission',
      relockCodes.includes('optimization-qualification-stage-locked'),
      { relockCodes: relockCodes.slice(0, 6) }
    );
    addCheck(
      're-lock',
      'stage-gate-not-unlocked-after-revocation',
      stageGate?.formalOptimizationUnlocked !== true,
      { stageGateSummary: stageGate?.summary ?? null }
    );

    const blocked = checks.filter(check => !check.passed);
    const report = {
      schemaVersion: 1,
      contractName: 'AzPrM12B3BindingMatrix',
      kind: 'azpr-m12-b3-binding-matrix',
      phase: 'M12-B3-E22',
      generatedAt: new Date().toISOString(),
      denominators: summary.denominators,
      hashes: {
        rosterHash: summary.rosterHash,
        manifestsHash: summary.manifestsHash,
        ledgerHash: summary.ledgerHash,
        bindingMatrixHash: summary.bindingMatrixHash,
        qualificationCatalogHash: summary.catalogHash,
        verifiedMechanicsPackageHash: mechanicsPackage.packageHash,
      },
      staticMatrix: {
        status: blocked.some(check => check.dimension === 'static')
          ? 'blocked'
          : 'passed',
        checks: checks.filter(check => check.dimension === 'static'),
      },
      scenarioMatrix: Object.fromEntries(
        [
          'loadout-to-character',
          'character-to-kibo-inheritance',
          'effect-source-target',
          'foreground-background-switch',
          'cross-owner-kibo-isolation',
          'same-frame-ordering',
          'save-replay',
          'continuous-cycle',
        ].map(dimension => [
          dimension,
          {
            status: blocked.some(check => check.dimension === dimension)
              ? 'blocked'
              : 'passed',
            checks: checks.filter(check => check.dimension === dimension),
          },
        ])
      ),
      reLock: {
        status: blocked.some(check => check.dimension === 're-lock')
          ? 'blocked'
          : 'passed',
        checks: checks.filter(check => check.dimension === 're-lock'),
      },
      summary: {
        checkCount: checks.length,
        passedCount: checks.length - blocked.length,
        blockedCount: blocked.length,
        allPassed: blocked.length === 0,
      },
    };
    const { generatedAt: _generatedAt, ...hashPayload } = report;
    report.bindingMatrixHash = canonicalModule.hashCanonicalValue({
      ...hashPayload,
      bindingMatrixHash: null,
    });
    return { report, checks, blocked };
  } finally {
    await vite.close();
  }
}

function createMarkdown(report) {
  const rows = [
    ['static', '静态分母/哈希'],
    ['loadout-to-character', '装配→角色'],
    ['character-to-kibo-inheritance', '角色→奇波继承'],
    ['effect-source-target', '效果来源/目标'],
    ['foreground-background-switch', '前后台/切人'],
    ['cross-owner-kibo-isolation', '同名奇波跨 owner 隔离'],
    ['same-frame-ordering', '同帧顺序'],
    ['save-replay', '保存重放'],
    ['continuous-cycle', '连续循环'],
    ['re-lock', '撤销资格重锁'],
  ];
  return (
    '# M12-B3-E22 绑定矩阵与正式准入\n\n' +
    `- bindingMatrixHash: \`${report.bindingMatrixHash}\`\n` +
    `- 检查总数: ${report.summary.checkCount}，通过: ${report.summary.passedCount}，阻断: ${report.summary.blockedCount}\n` +
    `- 分母: ${JSON.stringify(report.denominators)}\n` +
    `- 包哈希: \`${report.hashes.verifiedMechanicsPackageHash}\`\n\n` +
    '| 维度 | 状态 | 检查 |\n' +
    '| --- | --- | --- |\n' +
    rows
      .map(([key, label]) => {
        const group =
          key === 'static'
            ? report.staticMatrix
            : key === 're-lock'
              ? report.reLock
              : report.scenarioMatrix[key];
        return `| ${label} | ${group?.status ?? 'missing'} | ${group?.checks?.length ?? 0} |`;
      })
      .join('\n') +
    '\n'
  );
}

const writeMode = process.argv.includes('--write');
const assertClean = process.argv.includes('--assert-clean');
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { report } = await createM12B3BindingMatrix();
  const jsonPath = path.join(
    projectRootDefault,
    'reports',
    'm12',
    'm12-b3-binding-matrix.json'
  );
  const mdPath = path.join(
    projectRootDefault,
    'reports',
    'm12',
    'm12-b3-binding-matrix.md'
  );
  const jsonContent = `${JSON.stringify(report, null, 2)}\n`;
  const mdContent = createMarkdown(report);
  const canonicalJson = value => {
    const copy = structuredClone(value);
    copy.generatedAt = null;
    return JSON.stringify(copy);
  };
  if (writeMode) {
    await fs.writeFile(jsonPath, jsonContent, 'utf8');
    await fs.writeFile(mdPath, mdContent, 'utf8');
  }
  if (assertClean) {
    const drift = [];
    for (const [filePath, expected, jsonMode] of [
      [jsonPath, canonicalJson(report), true],
      [mdPath, mdContent, false],
    ]) {
      let actual = null;
      try {
        actual = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      const actualNormalized = jsonMode
        ? canonicalJson(JSON.parse(actual))
        : actual;
      if (actualNormalized !== expected) {
        drift.push(
          path.relative(projectRootDefault, filePath).replaceAll('\\', '/')
        );
      }
    }
    if (drift.length) {
      throw new Error(`m12-b3-binding-matrix-drift:${drift.join(',')}`);
    }
  }
  process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`);
}
