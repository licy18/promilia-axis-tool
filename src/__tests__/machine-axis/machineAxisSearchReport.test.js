import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  createWorkbenchDraftFromMachineAxisImport,
  createWorkbenchMachineAxisAdapter,
} from '../../machine-axis/workbenchMachineAxisAdapter';
import { createWorkbenchDraftSnapshot } from '../../domain/workbenchDraftStorage';
import { createWorkbenchProject } from '../../domain/workbenchProjectFactory';
import { resolveWorkbenchMachineAxisConfigurationProjection } from '../../machine-axis/workbenchMachineAxisProjectProjection';
import { WORKBENCH_HEADLESS_COMBAT_CORE } from '../../features/workbench/workbenchHeadlessCombatCore';

function cloneFixture() {
  return structuredClone(fixture);
}

const RESULT_REQUIRED_FIELDS = [
  'rank',
  'score',
  'team',
  'axis',
  'hashes',
  'legality',
  'criticalPolicy',
  'coverageTrust',
  'metrics',
  'causalExplanation',
];

describe('Machine Axis search report', () => {
  let service;

  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    service = createMachineAxisService();
  });

  it('produces a schema-conforming Top-N report importable into the Workbench', async () => {
    const report = await service.search(
      {
        contract: cloneFixture(),
        options: {
          beamWidth: 2,
          topN: 2,
          maxDepth: 2,
          maxActionsPerOwner: 2,
          maxKiboActions: 1,
          includeSwitch: false,
          objective: 'damage',
        },
      },
      {}
    );
    expect(report).toMatchObject({
      schemaVersion: 1,
      contractName: 'AzPrMachineAxisSearchReport',
      kind: 'azpr-machine-axis-search-report',
      objective: 'damage',
    });
    expect(report.scenario).toMatchObject({
      id: fixture.scenario.id,
      durationFrames: fixture.scenario.durationFrames,
      fps: 60,
      enemy: { enemyId: fixture.scenario.enemy.enemyId },
      critical: { policy: fixture.scenario.critical.policy },
    });
    expect(report.dataIdentity).toEqual(fixture.dataIdentity);
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.results.length).toBeLessThanOrEqual(2);

    for (const result of report.results) {
      for (const field of RESULT_REQUIRED_FIELDS) {
        expect(result).toHaveProperty(field);
      }
      expect(result.rank).toBeGreaterThanOrEqual(1);
      expect(result.team).toHaveLength(3);
      expect(result.axis.actions.length).toBeGreaterThan(0);
      expect(result.hashes).toMatchObject({
        input: expect.any(String),
        data: expect.any(String),
        trace: expect.any(String),
      });
      expect(result.legality.valid).toBe(true);
      expect(result.legality.issues).toEqual([]);
      expect(result.coverageTrust).toMatchObject({
        actionCount: expect.any(Number),
        assumptionWarningCount: expect.any(Number),
      });
      expect(result.metrics.hpDamage).toBeGreaterThanOrEqual(0);
      expect(result.causalExplanation.actionSequence).toHaveLength(
        result.axis.actions.length
      );
      expect(result.causalExplanation.endState).toMatchObject({
        currentFrame: expect.any(Number),
        activeActorId: expect.any(String),
      });
    }
    expect(report.results[0].deltaVsRank1).toBe(0);
    expect(report.results[0].score).toBeGreaterThanOrEqual(
      report.results[report.results.length - 1].score
    );

    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const imported = adapter.importContract(report.results[0].axis);
    expect(imported.canonicalRun.hashes).toEqual(report.results[0].hashes);

    const persistedDraft = JSON.parse(
      JSON.stringify(
        createWorkbenchDraftSnapshot(
          createWorkbenchDraftFromMachineAxisImport(imported),
          null
        )
      )
    );
    const rebuilt = createWorkbenchProject(persistedDraft.selection, {
      ...persistedDraft,
      ...resolveWorkbenchMachineAxisConfigurationProjection({
        configurationLibrary: persistedDraft.configurationLibrary,
        configurationSelection: persistedDraft.configurationSelection,
        projectTransport: persistedDraft.projectTransport,
      }),
      actions: persistedDraft.actionDrafts,
    });
    const rebuiltRun = WORKBENCH_HEADLESS_COMBAT_CORE.simulate(rebuilt);
    expect(rebuiltRun.hashes).toEqual(report.results[0].hashes);
  }, 180_000);

  it('rejects invalid search envelopes with stable diagnostics', async () => {
    await expect(service.search({ contract: null }, {})).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          code: 'machine-axis-search-contract-required',
        }),
      ],
    });
    await expect(
      service.search({ kind: 'not-search', contract: {} }, {})
    ).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          code: 'machine-axis-search-kind-unsupported',
        }),
      ],
    });
  });
});
