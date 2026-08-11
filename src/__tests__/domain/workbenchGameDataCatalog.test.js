import { describe, expect, it } from 'vitest';
import {
  createDefaultWorkbenchDraftState,
  parseWorkbenchProjectFile,
} from '../../domain/workbenchDraftStorage';
import { reconcileWorkbenchConfigurationState } from '../../domain/workbenchConfigurationLibrary';
import {
  createWorkbenchGameDataCompatibilityReport,
  createWorkbenchGameDataReferenceContract,
  DEFAULT_WORKBENCH_GAME_DATA_CATALOG,
  getWorkbenchGameDataCompatibilityReport,
} from '../../domain/workbenchGameDataCatalog';
import {
  createWorkbenchProject,
  getWorkbenchGameData,
  getWorkbenchLoadoutOptions,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';

describe('Workbench game data catalog', () => {
  it('exposes the generated AzPr tables as one trusted versioned catalog', () => {
    expect(DEFAULT_WORKBENCH_GAME_DATA_CATALOG).toMatchObject({
      contractName: 'AzPrWorkbenchGameDataCatalog',
      contractVersion: 1,
      catalogId: 'azpr-workbench-game-data',
      catalogVersion: 1,
      dataVersion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
      status: 'workbench-game-data-catalog-ready',
      ready: true,
      summary: {
        recordCount: 669,
        counts: {
          characters: 20,
          skills: 120,
          enemies: 208,
          equipment: 137,
          kibos: 122,
          soulessences: 62,
        },
        issueCount: 0,
      },
    });
    expect(DEFAULT_WORKBENCH_GAME_DATA_CATALOG.sources.characters).toContain(
      'hero-modules'
    );
    expect(DEFAULT_WORKBENCH_GAME_DATA_CATALOG.sources.skills).toContain(
      'hero-modules'
    );
    expect(DEFAULT_WORKBENCH_GAME_DATA_CATALOG.sources.enemies).toContain(
      'enemy.json'
    );
  });

  it('resolves active character, enemy, equipment, kibo, and soulessence records', () => {
    const state = createConfiguredState();
    const report = createWorkbenchGameDataCompatibilityReport(state);
    const reference = createWorkbenchGameDataReferenceContract(state);

    expect(report).toMatchObject({
      status: 'workbench-game-data-compatibility-exact',
      importAllowed: true,
      binding: { status: 'exact', compatible: true },
      summary: { missingCount: 0, invalidCount: 0 },
    });
    expect(reference).toMatchObject({
      schemaVersion: 2,
      contractName: 'AzPrWorkbenchGameDataReference',
      contractVersion: 2,
      status: 'workbench-game-data-reference-ready',
      ready: true,
      referenceIdentity: expect.stringMatching(/^azpr-game-data-v1-/u),
      actors: expect.arrayContaining([
        expect.objectContaining({
          character: expect.objectContaining({
            status: 'exact',
            source: expect.stringContaining('hero-modules'),
            record: expect.objectContaining({
              id: state.actorConfigs[0].characterId,
            }),
          }),
          loadout: expect.objectContaining({
            ready: true,
            appliedToCalculators: false,
            references: expect.objectContaining({
              kibo: expect.objectContaining({
                status: 'exact',
                record: expect.objectContaining({ name: expect.any(String) }),
              }),
              weapon: expect.objectContaining({
                status: 'exact',
                expectedType: '武器',
                record: expect.objectContaining({ type: '武器' }),
              }),
              soulessence: expect.objectContaining({
                status: 'exact',
                record: expect.objectContaining({ rarity: expect.any(String) }),
              }),
            }),
          }),
        }),
      ]),
      actions: expect.arrayContaining([
        expect.objectContaining({
          actionId: state.actionDrafts[0].id,
          skillId: state.actionDrafts[0].skillId,
          actorCharacterId: state.actionDrafts[0].actorCharacterId,
          actionVariantIndex: state.actionDrafts[0].actionVariantIndex,
          referenceIdentity: expect.stringMatching(/^azpr-action-skill-v1-/u),
          skillVariantReferenceIdentity: expect.stringMatching(
            /^azpr-skill-variant-v1-/u
          ),
          ready: true,
          skill: expect.objectContaining({
            status: 'exact',
            failureReason: null,
            record: expect.objectContaining({
              id: state.actionDrafts[0].skillId,
              characterId: state.actionDrafts[0].actorCharacterId,
            }),
            variant: expect.objectContaining({
              index: state.actionDrafts[0].actionVariantIndex,
              label: expect.any(String),
              rawValue: expect.any(String),
              multiplier: expect.any(Number),
            }),
          }),
        }),
      ]),
      enemy: expect.objectContaining({
        status: 'exact',
        source: expect.stringContaining('enemy.json'),
        record: expect.objectContaining({ id: state.selection.enemyId }),
      }),
      policy: {
        resolvedCatalogRecordsOnly: true,
        loadoutEffectsAppliedToCalculators: false,
      },
    });
  });

  it('rejects missing references and wrong equipment slot types across scenarios', () => {
    const state = createConfiguredState();
    const incompatibleScenario = JSON.parse(
      JSON.stringify(state.scenarioWorkspace.scenarios[0])
    );
    incompatibleScenario.id = 'scenario-incompatible';
    incompatibleScenario.name = '数据缺口方案';
    incompatibleScenario.draft.actorConfigs[0].loadout.kiboId = 999999999;
    incompatibleScenario.draft.actorConfigs[0].loadout.equipment.top =
      getWorkbenchLoadoutOptions().equipment.weapon[0].id;
    state.scenarioWorkspace.scenarios.push(incompatibleScenario);
    const report = createWorkbenchGameDataCompatibilityReport(state);

    expect(report).toMatchObject({
      status: 'workbench-game-data-compatibility-invalid',
      importAllowed: false,
      scenarios: expect.arrayContaining([
        expect.objectContaining({
          status: 'invalid',
          compatible: false,
          summary: expect.objectContaining({
            missingCount: 1,
            invalidCount: 1,
          }),
        }),
      ]),
    });
    const incompatibleReport = report.scenarios.find(
      scenario => scenario.scenarioId === 'scenario-incompatible'
    );
    expect(incompatibleReport.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'actorConfigs[0].loadout.kiboId',
          status: 'missing',
          requestedId: 999999999,
        }),
        expect.objectContaining({
          path: 'actorConfigs[0].loadout.equipment.top',
          status: 'invalid',
          expectedType: '上装',
          resolvedType: '武器',
        }),
      ])
    );
  });

  it('allows a resolvable legacy project but rejects a stale persisted data version', () => {
    const legacy = createDefaultWorkbenchDraftState();
    delete legacy.gameDataBinding;
    const stale = createDefaultWorkbenchDraftState();
    stale.gameDataBinding.dataVersion = '2026-01-01T00:00:00.000Z';

    expect(createWorkbenchGameDataCompatibilityReport(legacy)).toMatchObject({
      status: 'workbench-game-data-compatibility-legacy',
      importAllowed: true,
      binding: {
        status: 'legacy',
        reason: 'legacy-project-without-game-data-binding',
      },
    });
    expect(createWorkbenchGameDataCompatibilityReport(stale)).toMatchObject({
      status: 'workbench-game-data-compatibility-stale',
      importAllowed: false,
      binding: {
        status: 'stale',
        reason: 'game-data-version-changed',
      },
    });
  });

  it('rejects missing skills, actor ownership mismatches, and invalid action variants', () => {
    const missing = createDefaultWorkbenchDraftState();
    missing.actionDrafts[0].skillId = 999999999;
    const mismatched = createDefaultWorkbenchDraftState();
    mismatched.actionDrafts[0].actorCharacterId =
      mismatched.selection.secondaryCharacterId;
    const invalidVariant = createDefaultWorkbenchDraftState();
    invalidVariant.actionDrafts[0].actionVariantIndex = 999;
    invalidVariant.actionDrafts[0].damageSegmentIndex = 999;
    const outsideTeam = createDefaultWorkbenchDraftState();
    const teamIds = new Set(
      outsideTeam.teamSlots.map(slot => Number(slot.characterId))
    );
    const outsideCharacter = getWorkbenchGameData().characters.find(
      character => !teamIds.has(Number(character.id))
    );
    const outsideSkill = getWorkbenchGameData().skills.find(
      skill => Number(skill.characterId) === Number(outsideCharacter.id)
    );
    outsideTeam.actionDrafts[0].actorCharacterId = outsideCharacter.id;
    outsideTeam.actionDrafts[0].skillId = outsideSkill.id;
    const missingActor = createDefaultWorkbenchDraftState();
    missingActor.actionDrafts[0].actorCharacterId = null;

    expectActionSkillIssue(
      createWorkbenchGameDataCompatibilityReport(missing),
      'missing',
      'skill-not-found'
    );
    expectActionSkillIssue(
      createWorkbenchGameDataCompatibilityReport(mismatched),
      'invalid',
      'skill-actor-character-mismatch'
    );
    expectActionSkillIssue(
      createWorkbenchGameDataCompatibilityReport(invalidVariant),
      'invalid',
      'skill-action-variant-invalid'
    );
    expectActionSkillIssue(
      createWorkbenchGameDataCompatibilityReport(outsideTeam),
      'invalid',
      'skill-actor-character-not-in-team'
    );
    expectActionSkillIssue(
      createWorkbenchGameDataCompatibilityReport(missingActor),
      'invalid',
      'skill-actor-character-missing'
    );
  });

  it('retains raw import incompatibility after normalizers remove an unknown loadout id', () => {
    const raw = JSON.parse(JSON.stringify(createDefaultWorkbenchDraftState()));
    raw.actorConfigs[0].loadout.kiboId = 999999999;
    const parsed = parseWorkbenchProjectFile(raw);

    expect(parsed.actorConfigs[0].loadout.kiboId).toBeNull();
    expect(getWorkbenchGameDataCompatibilityReport(parsed)).toMatchObject({
      status: 'workbench-game-data-compatibility-missing',
      importAllowed: false,
      summary: { missingCount: 1 },
    });
    parsed.actorConfigs[0].loadout.kiboId = 888888888;
    expect(
      getWorkbenchGameDataCompatibilityReport(parsed).scenarios[0].references
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestedId: 888888888,
          status: 'missing',
        }),
      ])
    );
  });

  it('retains an unavailable raw skill before action normalization falls back', () => {
    const raw = JSON.parse(JSON.stringify(createDefaultWorkbenchDraftState()));
    const originalSkillId = raw.actionDrafts[0].skillId;
    raw.actionDrafts[0].skillId = 999999999;
    const parsed = parseWorkbenchProjectFile(raw);

    expect(parsed.actionDrafts[0].skillId).toBe(originalSkillId);
    expectActionSkillIssue(
      getWorkbenchGameDataCompatibilityReport(parsed),
      'missing',
      'skill-not-found'
    );
  });

  it('carries resolved records into compiler and runtime binding without applying loadout effects', () => {
    const state = createConfiguredState();
    const compatibility = createWorkbenchGameDataCompatibilityReport(state);
    const project = createWorkbenchProject(state.selection, {
      ...state,
      actions: state.actionDrafts,
      initialRuntimeState: {
        controlledActor: {
          actorId: `actor-${state.actorConfigs[0].characterId}`,
          characterId: state.actorConfigs[0].characterId,
        },
        kiboVitalsBySlot: [
          {
            slotId: state.teamSlots[0].slotId,
            actorId: `actor-${state.actorConfigs[0].characterId}`,
            kiboId: state.actorConfigs[0].loadout.kiboId,
            currentValue: 0,
            maxValue: 100,
          },
        ],
      },
      gameDataCompatibilityReport: compatibility,
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    const actorSource = scenario.mechanismConfiguration.actors[0];
    const compiledSkillAction = scenario.actions.find(
      action => action.type === 'skill'
    );
    const simulation = simulateScenario(scenario);
    const generatedSkillAction =
      simulation.threeValueGenerationLayer.actions.find(
        action => action.actionId === compiledSkillAction.id
      );
    const generatedHpDelta = simulation.threeValueGenerationLayer.deltas.find(
      delta =>
        delta.actionId === compiledSkillAction.id &&
        delta.trackKey === 'enemyHpDamage' &&
        delta.applied
    );
    const runtimeHpDelta =
      simulation.threeValueRuntimeProjection.runtimeAppliedDeltas.find(
        delta => delta.sourceDeltaId === generatedHpDelta.id
      );

    expect(scenario).toMatchObject({
      gameDataCatalog: {
        catalogId: 'azpr-workbench-game-data',
        dataVersion: state.gameDataBinding.dataVersion,
        status: 'workbench-game-data-reference-ready',
        referenceIdentity: expect.stringMatching(/^azpr-game-data-v1-/u),
      },
      gameDataCompatibility: {
        status: 'workbench-game-data-compatibility-exact',
        compatible: true,
        importAllowed: true,
      },
      mechanismConfiguration: {
        schemaVersion: 3,
        ready: true,
        gameDataReferenceContract: {
          ready: true,
          policy: { loadoutEffectsAppliedToCalculators: false },
        },
        runtimeBinding: {
          schemaVersion: 2,
          gameData: {
            catalogId: 'azpr-workbench-game-data',
            dataVersion: state.gameDataBinding.dataVersion,
            ready: true,
            replaceable: true,
          },
        },
      },
    });
    expect(actorSource.gameDataReference.record.id).toBe(
      state.actorConfigs[0].characterId
    );
    expect(actorSource.loadout.gameDataReferences.kibo.record.id).toBe(
      state.actorConfigs[0].loadout.kiboId
    );
    expect(actorSource.application.loadout.appliedToCalculators).toBe(false);
    expect(
      scenario.mechanismConfiguration.enemy.gameDataReference.record.id
    ).toBe(state.selection.enemyId);
    expect(compiledSkillAction).toMatchObject({
      gameDataReference: {
        ready: true,
        referenceIdentity: expect.stringMatching(/^azpr-action-skill-v1-/u),
        skillVariantReferenceIdentity: expect.stringMatching(
          /^azpr-skill-variant-v1-/u
        ),
        skill: {
          status: 'exact',
          record: { id: compiledSkillAction.skillId },
          variant: {
            index: compiledSkillAction.actionVariantIndex,
            label: expect.any(String),
            multiplier: compiledSkillAction.selectedDamageSegment.multiplier,
          },
        },
      },
      hpOperandSourceBinding: {
        contractName: 'AzPrHpOperandSourceBinding',
        contractVersion: 1,
        status: 'hp-operand-source-binding-ready',
        ready: true,
        skillVariantReference: {
          identity:
            compiledSkillAction.gameDataReference.skillVariantReferenceIdentity,
          multiplier: compiledSkillAction.selectedDamageSegment.multiplier,
        },
      },
      source: {
        skill: { id: compiledSkillAction.skillId },
      },
    });
    expect(generatedSkillAction).toMatchObject({
      skillReferenceRequired: true,
      skillReferenceReady: true,
      gameDataReference: compiledSkillAction.gameDataReference,
    });
    expect(generatedHpDelta).toMatchObject({
      skillReferenceRequired: true,
      skillReferenceReady: true,
      hpOperandSourceBindingRequired: true,
      hpOperandSourceBindingReady: true,
      hpOperandSourceBindingStatus: 'hp-operand-source-binding-valid',
      gameDataReference: compiledSkillAction.gameDataReference,
      mechanismContext: {
        schemaVersion: 4,
        gameDataReference: compiledSkillAction.gameDataReference,
        action: {
          skillReferenceReady: true,
          gameDataReference: compiledSkillAction.gameDataReference,
        },
      },
      mechanicsAdapterRequest: {
        sourceValue: {
          operands: {
            contractVersion: 3,
            sourceBindingRequired: true,
            sourceBindingReady: true,
            sourceBinding: compiledSkillAction.hpOperandSourceBinding,
            sourceBindingValidation: {
              ready: true,
              issueCodes: [],
            },
          },
        },
      },
    });
    expect(runtimeHpDelta.runtimeCalculatorInvocation).toMatchObject({
      schemaVersion: 11,
      mechanicsEvaluation: {
        contractVersion: 5,
        operandSourceBindingRequired: true,
        operandSourceBindingReady: true,
        operandSourceBindingValidation: {
          ready: true,
          issueCodes: [],
        },
      },
      validation: {
        operandSourceBindingReady: true,
        valid: true,
      },
    });
    expect(simulation.threeValueGenerationLayer.summary).toMatchObject({
      skillReferenceActionCount: 1,
      skillReferenceReadyActionCount: 1,
      skillReferenceMissingActionCount: 0,
      hpOperandSourceBindingRequiredDeltaCount: 1,
      hpOperandSourceBindingReadyDeltaCount: 1,
      hpOperandSourceBindingInvalidDeltaCount: 0,
    });
  });
});

function expectActionSkillIssue(report, status, failureReason) {
  expect(report.importAllowed).toBe(false);
  expect(report.scenarios[0].references).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        tableName: 'skills',
        status,
        failureReason,
      }),
    ])
  );
}

function createConfiguredState() {
  const state = createDefaultWorkbenchDraftState();
  const options = getWorkbenchLoadoutOptions();
  state.actorConfigs[0].loadout = {
    kiboId: options.kibos[0].id,
    equipment: {
      weapon: options.equipment.weapon[0].id,
      top: options.equipment.top[0].id,
      bottom: options.equipment.bottom[0].id,
      earring: options.equipment.earring[0].id,
      ring: options.equipment.ring[0].id,
    },
    soulessenceId: options.soulessences[0].id,
  };
  state.scenarioWorkspace.scenarios[0].draft.actorConfigs = JSON.parse(
    JSON.stringify(state.actorConfigs)
  );
  const configuration = reconcileWorkbenchConfigurationState({
    ...state,
    syncSelectedValues: true,
  });
  state.configurationLibrary = configuration.configurationLibrary;
  state.configurationSelection = configuration.configurationSelection;
  state.actorConfigs = configuration.actorConfigs;
  state.enemyConfig = configuration.enemyConfig;
  state.scenarioWorkspace.scenarios[0].draft.actorConfigs = JSON.parse(
    JSON.stringify(state.actorConfigs)
  );
  return state;
}
