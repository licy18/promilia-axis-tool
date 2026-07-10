import { describe, expect, it } from 'vitest';
import {
  getAzprCharacterAttributePanelByCharacterId,
  getAzprCharacterAttributePanels,
  getAzprCharacters,
  getAzprCombatFormulaEvidence,
  getAzprElements,
  getAzprEnemies,
  getAzprEquipment,
  getAzprGeneratedManifest,
  getAzprKibos,
  getAzprSkillAssetEvidence,
  getAzprSkillLogicIndex,
  getAzprSkillLevelCrossCheck,
  getAzprSkills,
  getAzprSoulessences,
  getAzprValidationReport,
  getAzprValueParamIndex,
  getAzprWorkbenchSeed,
} from '../../data/azprGenerated';

describe('generated AzPr data', () => {
  it('loads real local AzPr datasets instead of prototype placeholders', () => {
    const characters = getAzprCharacters();
    const elements = getAzprElements();
    const skills = getAzprSkills();

    expect(characters).toHaveLength(20);
    expect(elements).toHaveLength(10);
    expect(skills.length).toBeGreaterThanOrEqual(100);
    expect(getAzprEnemies().length).toBeGreaterThanOrEqual(200);
    expect(getAzprKibos()).toHaveLength(122);
    expect(getAzprEquipment()).toHaveLength(137);
    expect(getAzprSoulessences()).toHaveLength(62);

    const names = characters.map(character => character.name);
    expect(names).toContain('末音');
    expect(names).not.toContain('钟离');
    expect(names).not.toContain('甘雨');
  });

  it('marks skill timing as missing until authoritative runtime data exists', () => {
    const skills = getAzprSkills();

    expect(skills.every(skill => skill.needsTimingData)).toBe(true);
    expect(new Set(skills.map(skill => skill.timingSource))).toEqual(
      new Set(['missing-skill-asset-or-runtime-capture'])
    );
  });

  it('keeps the Workbench production projection aligned with full catalogs', () => {
    const seed = getAzprWorkbenchSeed();
    const enemies = getAzprEnemies();
    const elements = getAzprElements();
    const equipment = getAzprEquipment();
    const kibos = getAzprKibos();
    const soulessences = getAzprSoulessences();
    const enemyAttributeKeys = new Set([
      'ATK',
      'MAXHP',
      'DEF',
      'MDEF',
      'WEAKNESS_POINT_MAX',
      'NORMAL_DEFENSE',
      'FIRE_DEFENSE',
      'WIND_DEFENSE',
      'EARTH_DEFENSE',
      'WOOD_DEFENSE',
      'ICE_DEFENSE',
      'WATER_DEFENSE',
      'ELEC_DEFENSE',
      'LIGHT_DEFENSE',
      'DARK_DEFENSE',
    ]);

    expect(seed.schemaVersion).toBe(2);
    expect(seed.counts).toMatchObject({
      enemies: enemies.length,
      elements: elements.length,
      equipment: equipment.length,
      kibos: kibos.length,
      soulessences: soulessences.length,
    });
    expect(seed.gameData.enemies.map(item => item.id)).toEqual(
      enemies.map(item => item.id)
    );
    expect(seed.gameData.elements).toEqual(
      elements.map(({ id, name, abbrName, color }) => ({
        id,
        name,
        abbrName,
        color,
      }))
    );
    expect(seed.gameData.equipment).toEqual(
      equipment.map(({ id, name, type, rarity }) => ({
        id,
        name,
        type,
        rarity,
      }))
    );
    expect(seed.gameData.kibos).toEqual(
      kibos.map(({ id, name, element, stage }) => ({
        id,
        name,
        element,
        stage,
      }))
    );
    expect(seed.gameData.soulessences).toEqual(
      soulessences.map(({ id, name, rarity }) => ({ id, name, rarity }))
    );

    const defaultEnemy = enemies.find(
      enemy => enemy.id === seed.defaults.enemyId
    );
    const projectedDefaultEnemy = seed.gameData.enemies.find(
      enemy => enemy.id === seed.defaults.enemyId
    );
    expect(projectedDefaultEnemy.property.baseAttributes).toEqual(
      defaultEnemy.property.baseAttributes.filter(attribute =>
        enemyAttributeKeys.has(attribute.key)
      )
    );
  });

  it('keeps validation findings explicit for the next reconstruction stage', () => {
    const report = getAzprValidationReport();
    const timingWarning = report.warnings.find(
      warning => warning.code === 'skill-timing-missing'
    );
    const crossCheckWarning = report.warnings.find(
      warning => warning.code === 'skill-level-crosscheck-mismatch'
    );
    const logicMismatchInfo = report.warnings.find(
      warning => warning.code === 'skill-display-logic-timing-mismatch'
    );
    const valueParamInfo = report.warnings.find(
      warning => warning.code === 'skill-value-param-semantic-unresolved'
    );
    const combatFormulaInfo = report.warnings.find(
      warning => warning.code === 'combat-formula-evidence-direct-link-missing'
    );
    const skillAssetInfo = report.warnings.find(
      warning => warning.code === 'skill-asset-effect-node-unmapped'
    );
    const placeholderWarning = report.warnings.find(
      warning => warning.code === 'non-azpr-placeholder-character'
    );

    expect(report.counts.characters).toBe(20);
    expect(report.counts.skillLevelCrossCheck).toBe(120);
    expect(report.counts.skillLogicIndex).toBe(120);
    expect(report.counts.valueParamIndex).toBe(2);
    expect(report.counts.combatFormulaEvidence).toBe(152);
    expect(report.counts.skillAssetEvidence).toBe(116);
    expect(report.counts.characterAttributePanels).toBe(20);
    expect(timingWarning.count).toBe(report.counts.skills);
    expect(crossCheckWarning).toMatchObject({
      severity: 'warning',
      count: 4,
      summary: {
        matchedSkills: 118,
        missingSkills: 0,
        mismatchedSkills: 2,
        matchedLevels: 998,
        missingLevels: 0,
        mismatchedLevels: 2,
      },
    });
    expect(logicMismatchInfo).toMatchObject({
      severity: 'info',
      count: 44,
      summary: {
        mappedSkills: 76,
        missingSkills: 0,
        mismatchedSkills: 44,
        subSkillIds: 120,
        missingLogicRows: 0,
        displayLogicMismatchSubSkills: 44,
        levelRows: 1000,
        elementValueRows: 2808,
        levelsMissingElementValues: 100,
        logicRowsWithNonZeroTiming: 60,
      },
    });
    expect(valueParamInfo).toMatchObject({
      severity: 'info',
      count: 2,
      ids: [1, 7],
      summary: {
        parameterIds: 2,
        observedParameterPairs: 5616,
        observedElementValueRows: 2808,
        observedSkills: 75,
        unresolvedParameterIds: [1, 7],
        constantParameterIds: [7],
      },
    });
    expect(combatFormulaInfo).toMatchObject({
      severity: 'info',
      count: 0,
      summary: {
        enemyCount: 208,
        enemiesWithProperty: 199,
        enemiesWithBaseDefense: 198,
        enemiesWithElementDefense: 198,
        enemiesWithWeakPointDamage: 198,
        elementFormulaRows: 152,
        directAllElementFormulaIdMatches: 0,
        directCurrentElementFormulaIdMatches: 0,
        relationStatus: 'no-direct-elementId-to-element_formula-id-match',
      },
    });
    expect(skillAssetInfo).toMatchObject({
      severity: 'info',
      count: 4,
      summary: {
        skillTableRows: 3200,
        currentSkillCount: 120,
        currentSkillsWithSkillTableRow: 120,
        currentSkillsWithExtractedSkillControl: 116,
        currentSkillsMissingExtractedSkillControl: 4,
        uniqueSkillBytesPaths: 682,
        existingSkillBytesPathsInAzPrAssets: 0,
        extractedSkillControlDirectories: 4134,
        effectLaneCandidateSkills: {
          hpDamage: 7,
          toughnessDamage: 7,
          selfEnergyChange: 1,
          elementEffect: 3,
          timingControl: 8,
          presentation: 8,
        },
        hpDamageCandidateSkills: 7,
        toughnessCandidateSkills: 7,
        selfEnergyCandidateSkills: 1,
        behaviorReferenceResolvedSkills: 9,
        hpDamageBehaviorReferenceResolvedSkills: 7,
        externalElementBaseReferenceSkills: 9,
        resourceMapMatchedElementBaseReferenceSkills: 9,
        resourceMapUnmatchedElementBaseReferenceSkills: 0,
        relationStatus: 'skill-control-assets-found-in-azpr-extractor',
      },
    });
    expect(
      report.warnings.find(
        warning => warning.code === 'character-attribute-panel-missing'
      )
    ).toMatchObject({
      severity: 'ok',
      count: 0,
      summary: {
        characters: 20,
        attributesPerCharacter: 29,
        panelRows: 580,
        level: 80,
        currentRank: 7,
      },
    });
    expect(placeholderWarning.severity).toBe('ok');
  });

  it('loads current-rank character attribute panels from the BWiki spreadsheet formula lineage', () => {
    const manifest = getAzprGeneratedManifest();
    const panels = getAzprCharacterAttributePanels();
    const mayoi = getAzprCharacterAttributePanelByCharacterId(109001);

    expect(manifest.files.characterAttributePanels).toBe(
      'character-attribute-panels.json'
    );
    expect(panels.summary).toMatchObject({
      characters: 20,
      attributesPerCharacter: 29,
      panelRows: 580,
      level: 80,
      currentRank: 7,
    });
    expect(panels.policy).toMatchObject({
      level: 80,
      currentRank: 7,
      currentRankRunes: 'all-selected',
      rankBonusIncludedThrough: 6,
    });
    expect(panels.source.referenceWorkbook).toContain(
      'role-attribute-dynamic-current-rank.xlsx'
    );
    expect(mayoi.core.attack).toMatchObject({
      name: '攻击',
      effectiveValue: 1920,
      displayText: '1920',
      formulaRaw: 1920.2092,
    });
    expect(mayoi.core.maxHp).toMatchObject({
      name: '生命',
      effectiveValue: 10748,
      displayText: '10748',
    });
    expect(mayoi.core.critRate).toMatchObject({
      name: '暴击率',
      effectiveValue: 0.061,
      displayText: '6.1%',
    });
  });

  it('indexes valueParam parameter slots without claiming combat semantics', () => {
    const manifest = getAzprGeneratedManifest();
    const valueParams = getAzprValueParamIndex();

    expect(manifest.files.valueParamIndex).toBe('value-param-index.json');
    expect(valueParams.summary).toMatchObject({
      parameterIds: 2,
      observedParameterPairs: 5616,
      observedElementValueRows: 2808,
      observedSkills: 75,
      formulaRows: 152,
      unresolvedParameterIds: [1, 7],
      constantParameterIds: [7],
    });
    expect(
      valueParams.params.map(param => [
        param.id,
        param.variable,
        param.semanticStatus,
        param.category,
      ])
    ).toEqual([
      [1, 'A', 'unresolved', 'varying-formula-slot'],
      [7, 'G', 'unresolved', 'constant-formula-slot'],
    ]);
    expect(valueParams.params[0]).toMatchObject({
      label: '参数 1 / A',
      isConstant: false,
      minValue: 200,
      maxValue: 408450,
      rowCount: 2808,
      skillCount: 75,
    });
    expect(valueParams.params[1]).toMatchObject({
      label: '参数 7 / G',
      isConstant: true,
      minValue: 10000,
      maxValue: 10000,
      sampleValues: [10000],
    });
  });

  it('indexes combat formula evidence without applying unconfirmed layers', () => {
    const manifest = getAzprGeneratedManifest();
    const evidence = getAzprCombatFormulaEvidence();

    expect(manifest.files.combatFormulaEvidence).toBe(
      'combat-formula-evidence.json'
    );
    expect(evidence.summary).toMatchObject({
      enemyCount: 208,
      enemiesWithProperty: 199,
      enemiesWithBaseDefense: 198,
      enemiesWithElementDefense: 198,
      enemiesWithWeakPointDamage: 198,
      allElementValueRows: 13118,
      currentSkillElementValueRows: 2808,
      allUniqueElementIds: 1800,
      currentSkillUniqueElementIds: 234,
      elementFormulaRows: 152,
      directAllElementFormulaIdMatches: 0,
      directCurrentElementFormulaIdMatches: 0,
      relationStatus: 'no-direct-elementId-to-element_formula-id-match',
    });
    expect(evidence.enemyAttributeEvidence).toMatchObject({
      status: 'enemy-property-attributes-found',
      sampleEnemy: {
        id: 300032,
        name: '迅狼',
        propertyId: 300032,
        baseAttributeId: 300032,
        baseDefenseValues: {
          DEF: 9000,
          MDEF: 9000,
        },
        elementDefenseValues: {
          FIRE_DEFENSE: 0,
          WIND_DEFENSE: 0,
          WATER_DEFENSE: 0,
        },
        weakPointDamageValues: {
          WDM_FIRE: 10000,
          WDM_WATER: 10000,
          WDM_DARK: 10000,
        },
      },
    });
    expect(evidence.formulaEvidence.attackFormulaRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 2,
          functionOutput: '(self.ATK[0]*A)/10000',
        }),
        expect.objectContaining({
          id: 101,
          functionOutput: '(self.ATK[0]*A)/10000',
        }),
      ])
    );
    expect(evidence.formulaEvidence.selfDefenseFormulaRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 23,
          functionOutput: '(self.DEF[0]*A)/10000',
        }),
      ])
    );
    expect(evidence.elementValueEvidence).toMatchObject({
      status: 'element-values-have-params-but-no-direct-formula-id-link',
      directElementFormulaIdMatches: [],
    });
  });

  it('indexes AzPr Extractor skill control assets as effect-node candidates', () => {
    const manifest = getAzprGeneratedManifest();
    const evidence = getAzprSkillAssetEvidence();
    const mayoiAttack = evidence.currentSkillControlEvidence.find(
      item => item.skillId === 10900101
    );
    const hanyouyouAttack = evidence.currentSkillControlEvidence.find(
      item => item.skillId === 10100301
    );
    const hanyouyouUltimate = evidence.currentSkillControlEvidence.find(
      item => item.skillId === 10100313
    );

    expect(manifest.files.skillAssetEvidence).toBe('skill-asset-evidence.json');
    expect(evidence.probes).toMatchObject({
      azprSkillRoot: {
        exists: false,
      },
      azprSkillPreloadRoot: {
        exists: false,
      },
      extractorSkillListRoot: {
        exists: true,
      },
    });
    expect(evidence.summary).toMatchObject({
      currentSkillCount: 120,
      currentSkillsWithExtractedSkillControl: 116,
      currentSkillsMissingExtractedSkillControl: 4,
      existingSkillBytesPathsInAzPrAssets: 0,
      effectLaneCandidateSkills: {
        hpDamage: 7,
        toughnessDamage: 7,
        selfEnergyChange: 1,
        elementEffect: 3,
        timingControl: 8,
        presentation: 8,
      },
      hpDamageCandidateSkills: 7,
      toughnessCandidateSkills: 7,
      selfEnergyCandidateSkills: 1,
      behaviorReferenceResolvedSkills: 9,
      hpDamageBehaviorReferenceResolvedSkills: 7,
      externalElementBaseReferenceSkills: 9,
      resourceMapMatchedElementBaseReferenceSkills: 9,
      resourceMapUnmatchedElementBaseReferenceSkills: 0,
      scriptTypeCandidateSkills: 8,
      elementTypeCatalogCandidates: 3,
      externalElementObjectResolvedSkills: 18,
      externalElementObjectResolvedRefs: 97,
      externalElementObjectUnresolvedRefs: 0,
      summonTargetSkillCount: 2,
      summonTargetDamageElementObjects: 4,
      damageElementFieldMappedSkills: 15,
      damageElementFieldMappedObjects: 33,
      hpDamageFieldCandidateRefs: 33,
      toughnessDamageFieldCandidateRefs: 33,
      selfEnergyFieldCandidateRefs: 33,
      damageElementSkillLogicBridgeMatches: 15,
      relationStatus: 'skill-control-assets-found-in-azpr-extractor',
    });
    expect(evidence.elementTypeCatalogEvidence).toMatchObject({
      status: 'il2cpp-element-type-candidates-found',
      elementTypes: expect.arrayContaining([
        expect.objectContaining({
          className: 'TSpElementParams',
          label: '能量',
          evidenceKind: 'config-element-params',
          fields: expect.arrayContaining(['recoverType', 'shareType']),
        }),
        expect.objectContaining({
          className: 'DamageElement',
          evidenceKind: 'runtime-element',
          fields: expect.arrayContaining([
            'm_recoverSP',
            'm_petRecoverSP',
            'outputDamageData',
          ]),
        }),
        expect.objectContaining({
          className: 'TSummonElementParams',
          label: '召唤',
          evidenceKind: 'config-element-params',
          runtimeType: 'Lens.Gameplay.Modules.BigWorld.SummonElement',
          fields: expect.arrayContaining([
            'summonUnitId',
            'summonLifeTime',
            'summonCount',
            'summonTotalMaxCount',
          ]),
        }),
      ]),
    });
    expect(evidence.externalElementObjectEvidence).toMatchObject({
      status: 'element-objects-resolved',
      summary: {
        skillCount: 18,
        resolvedSkills: 18,
        requestedPathIds: 97,
        resolvedPathIds: 97,
        unresolvedPathIds: 0,
        formulaParamBuffReferenceObjects: 15,
        formulaParamBuffReferences: 15,
        formulaParamBuffReferenceResolvedObjects: 1,
        unknownScriptBuffReferenceObjects: 6,
        sourceSkillCount: 9,
        targetSkillCount: 9,
      },
      skills: expect.arrayContaining([
        expect.objectContaining({
          skillId: 10900101,
          status: 'element-objects-resolved',
          skillControlBundle: expect.objectContaining({
            bundleIndex: 75402,
            logicalName:
              'd_assets_resourcesassets_config_battle_skilllist_skill_control_10900101',
            packName: 'ypm6fu6ccxdszvz7zhuinq',
          }),
          elementAssetsBundle: expect.objectContaining({
            bundleIndex: 74227,
            logicalName:
              'd_assets_resourcesassets_config_battle_element_assets',
          }),
          scriptClassCounts: {
            TDamageElementParams: 3,
            TFxElementParams: 2,
            TFreezeFrameElementParams: 2,
            TBuffElementParams: 1,
          },
          objects: expect.arrayContaining([
            expect.objectContaining({
              pathId: '-5633710717881758712',
              status: 'resolved-in-element-assets-bundle',
              containerPath:
                'Assets/ResourcesAssets/Config/Battle/Element/Assets/ast_109001251.asset',
              elementConfigId: 109001251,
              scriptTypeCandidate: expect.objectContaining({
                className: 'TDamageElementParams',
                typeDefIndex: 9720,
              }),
              formulaParams: expect.objectContaining({
                function_1: 1,
                function_2: 2,
                formulaParamValues: expect.arrayContaining([3000, 8500]),
              }),
              damageFields: expect.objectContaining({
                weakBreakDamageRate: 7000,
                recoverSP: 5899,
                petRecoverSP: 22999,
                recoverInterval: 9999,
              }),
              mediaPackNames: ['11_109001_133'],
            }),
          ]),
        }),
        expect.objectContaining({
          skillId: 10100304,
          status: 'element-objects-resolved',
          scriptClassCounts: expect.objectContaining({
            TSummonElementParams: 1,
          }),
          objects: expect.arrayContaining([
            expect.objectContaining({
              elementConfigId: 101003180,
              scriptPathId: '5576338162890961044',
              scriptTypeCandidate: expect.objectContaining({
                className: 'TSummonElementParams',
                typeDefIndex: 9758,
                role: 'summon-unit-or-trigger-bridge',
              }),
              summonFields: expect.objectContaining({
                summonUnitId: 480059,
                summonLifeTime: 2500,
                summonCount: 1,
                summonTotalMaxCount: 5,
              }),
              summonTargetSkillEvidence: expect.objectContaining({
                status: 'summon-target-damage-elements-found',
                summonUnitId: 480059,
                targetSkillIds: [48005901],
                damageElementConfigIds: [101003156, 101003182],
                applied: false,
              }),
            }),
          ]),
        }),
        expect.objectContaining({
          skillId: 10100305,
          status: 'element-objects-resolved',
          scriptClassCounts: expect.objectContaining({
            TSummonElementParams: 1,
          }),
          objects: expect.arrayContaining([
            expect.objectContaining({
              elementConfigId: 101003181,
              scriptPathId: '5576338162890961044',
              scriptTypeCandidate: expect.objectContaining({
                className: 'TSummonElementParams',
                typeDefIndex: 9758,
                role: 'summon-unit-or-trigger-bridge',
              }),
              summonFields: expect.objectContaining({
                summonUnitId: 480060,
                summonLifeTime: 2500,
                summonCount: 1,
                summonTotalMaxCount: 5,
              }),
              summonTargetSkillEvidence: expect.objectContaining({
                status: 'summon-target-damage-elements-found',
                summonUnitId: 480060,
                targetSkillIds: [48006001],
                damageElementConfigIds: [101003157, 101003179],
                applied: false,
              }),
              formulaParamBridgeCandidate: expect.objectContaining({
                status: 'formula-param-buff-reference-found',
                scriptTypeCandidateStatus: 'script-type-candidate-found',
                scriptTypeClassName: 'TSummonElementParams',
                inferredRole: 'summon-element-buff-trigger-bridge-candidate',
                confidence: 'medium',
                referencedBuffIds: [101003079],
                summonFields: expect.objectContaining({
                  summonUnitId: 480060,
                  summonLifeTime: 2500,
                }),
              }),
              formulaParamReferenceEvidence: expect.objectContaining({
                status: 'formula-param-buff-references-found',
                buffReferenceIds: [101003079],
                references: [
                  expect.objectContaining({
                    buffId: 101003079,
                    formulaParamSlots: [2, 13],
                    status: 'buff-info-and-buff-element-object-found',
                    buffInfo: expect.objectContaining({
                      name: '焰火',
                      description: '受到特定伤害时触发爆炸',
                      type: 2,
                      tips: '焰火',
                    }),
                    buffElementObject: expect.objectContaining({
                      elementConfigId: 101003079,
                      scriptTypeCandidate: expect.objectContaining({
                        className: 'TBuffElementParams',
                      }),
                      timingFields: expect.objectContaining({
                        time: 10000,
                        frequency: 1,
                      }),
                    }),
                  }),
                ],
              }),
            }),
          ]),
        }),
      ]),
    });
    expect(evidence.summonTargetSkillEvidence).toMatchObject({
      status: 'summon-target-damage-elements-found',
      summary: {
        summonSourceObjectCount: 2,
        summonUnitCount: 2,
        targetSkillCount: 2,
        resolvedTargetSkillCount: 2,
        targetSkillControlStubOnlySkillCount: 0,
        requestedPathIds: 4,
        resolvedPathIds: 4,
        unresolvedPathIds: 0,
        damageElementObjectCount: 4,
        damageElementFieldMappingCount: 4,
      },
      targets: expect.arrayContaining([
        expect.objectContaining({
          summonUnitId: 480059,
          status: 'summon-target-damage-elements-found',
          targetSkillIds: [48005901],
          battlefieldItem: expect.objectContaining({
            id: 480059,
            skillList: '1#48005901',
            skillBytesPath:
              'Config/Battle/Skill/Item/480059.asset,Config/Battle/SkillPreload/Item/480059.asset',
          }),
          damageElementConfigIds: [101003156, 101003182],
          targetSkills: [
            expect.objectContaining({
              skillId: 48005901,
              skillRow: expect.objectContaining({
                parentSkill: 10100301,
                skillModuleTag: 2,
              }),
              skillControlDirectory: expect.objectContaining({
                status: 'skill-control-json-readable',
                jsonFileCount: 13,
                stubOnlyJsonFiles: 0,
                parsedReadableJsonFiles: 13,
                timelineControlSampleCount: 6,
                behaviorNodeSampleCount: 13,
                frameCandidateSampleCount: 13,
                startFrameCandidates: [0, 1, 4, 25, 34, 43],
                frameRange: {
                  minStartFrame: 0,
                  maxEndFrame: 112,
                },
                triggerFrameCandidateSummary: expect.objectContaining({
                  status:
                    'skill-control-trigger-frame-candidates-found-unconfirmed',
                  candidateStartFrames: [0, 1, 4, 25, 34, 43],
                  applied: false,
                }),
                behaviorReferenceSummary: expect.objectContaining({
                  behaviorListRefs: 6,
                  resolvedBehaviorListRefs: 6,
                  externalElementBaseRefs: 4,
                  resourceMapMatchedElementBaseRefs: 4,
                }),
                hpBehaviorChainCount: 4,
              }),
              damageElementConfigIds: [101003156, 101003182],
              skillElementValueSummaries: expect.arrayContaining([
                expect.objectContaining({
                  elementId: 101003156,
                  firstLevel: expect.objectContaining({
                    valueParam: '1#3500|7#10000',
                  }),
                  lastLevel: expect.objectContaining({
                    valueParam: '1#7350|7#10000',
                  }),
                }),
                expect.objectContaining({
                  elementId: 101003182,
                  firstLevel: expect.objectContaining({
                    valueParam: '1#1500|7#10000',
                  }),
                  lastLevel: expect.objectContaining({
                    valueParam: '1#3150|7#10000',
                  }),
                }),
              ]),
            }),
          ],
        }),
        expect.objectContaining({
          summonUnitId: 480060,
          status: 'summon-target-damage-elements-found',
          targetSkillIds: [48006001],
          battlefieldItem: expect.objectContaining({
            id: 480060,
            skillList: '1#48006001',
            skillBytesPath:
              'Config/Battle/Skill/Item/480060.asset,Config/Battle/SkillPreload/Item/480060.asset',
          }),
          damageElementConfigIds: [101003157, 101003179],
          targetSkills: [
            expect.objectContaining({
              skillId: 48006001,
              skillRow: expect.objectContaining({
                parentSkill: 10100301,
                skillModuleTag: 2,
              }),
              skillControlDirectory: expect.objectContaining({
                status: 'skill-control-json-readable',
                jsonFileCount: 13,
                stubOnlyJsonFiles: 0,
                parsedReadableJsonFiles: 13,
                timelineControlSampleCount: 6,
                behaviorNodeSampleCount: 13,
                frameCandidateSampleCount: 13,
                startFrameCandidates: [0, 1, 5, 20, 29, 38],
                frameRange: {
                  minStartFrame: 0,
                  maxEndFrame: 105,
                },
                triggerFrameCandidateSummary: expect.objectContaining({
                  status:
                    'skill-control-trigger-frame-candidates-found-unconfirmed',
                  candidateStartFrames: [0, 1, 5, 20, 29, 38],
                  applied: false,
                }),
                behaviorReferenceSummary: expect.objectContaining({
                  behaviorListRefs: 6,
                  resolvedBehaviorListRefs: 6,
                  externalElementBaseRefs: 4,
                  resourceMapMatchedElementBaseRefs: 4,
                }),
                hpBehaviorChainCount: 4,
              }),
              damageElementConfigIds: [101003157, 101003179],
              skillElementValueSummaries: expect.arrayContaining([
                expect.objectContaining({
                  elementId: 101003157,
                  firstLevel: expect.objectContaining({
                    valueParam: '1#5000|7#10000',
                  }),
                  lastLevel: expect.objectContaining({
                    valueParam: '1#10500|7#10000',
                  }),
                }),
                expect.objectContaining({
                  elementId: 101003179,
                  firstLevel: expect.objectContaining({
                    valueParam: '1#3000|7#10000',
                  }),
                  lastLevel: expect.objectContaining({
                    valueParam: '1#6300|7#10000',
                  }),
                }),
              ]),
            }),
          ],
        }),
      ]),
      damageElementFieldMappingEvidence: expect.objectContaining({
        summary: expect.objectContaining({
          mappedSkills: 2,
          damageElementObjects: 4,
          hpDamageCandidateRefs: 4,
          toughnessDamageCandidateRefs: 4,
          selfEnergyCandidateRefs: 4,
          formulaFunctionMatchedRefs: 8,
        }),
      }),
    });
    expect(evidence.damageElementFieldMappingEvidence).toMatchObject({
      status: 'damage-element-field-candidates-found',
      summary: {
        skillCount: 18,
        mappedSkills: 15,
        damageElementObjects: 33,
        hpDamageCandidateRefs: 33,
        toughnessDamageCandidateRefs: 33,
        selfEnergyCandidateRefs: 33,
        skillsubElementBridgeMatchedObjects: 15,
        skillsubElementBridgeMissingObjects: 3,
        skillsubElementBridgeLevelRows: 180,
        valueParamFormulaSlotDirectMatchObjects: 15,
        valueParamFormulaSlotOverrideCandidateObjects: 15,
        valueParamFormulaSlotUnresolvedObjects: 15,
        formulaFunctionCheckedObjects: 33,
        formulaFunctionDirectElementFormulaObjects: 33,
        formulaFunctionRefs: 66,
        formulaFunctionMatchedRefs: 66,
        formulaFunctionUnmatchedRefs: 0,
        formulaFunctionUniqueIds: [1, 2, 101, 107205],
      },
      skills: expect.arrayContaining([
        expect.objectContaining({
          skillId: 10900101,
          status: 'damage-element-field-candidates-found',
          damageElementCount: 3,
          fieldMappings: expect.arrayContaining([
            expect.objectContaining({
              elementConfigId: 109001251,
              hpDamage: expect.objectContaining({
                status: 'candidate-from-TDamageElementParams-formulaParams',
                formulaFunctionIds: {
                  function_1: 1,
                  function_2: 2,
                },
                formulaFunctionEvidence: expect.objectContaining({
                  status: 'direct-element-formula-id-candidates-found',
                  relationStatus:
                    'function-id-matches-element_formula-id-candidate',
                  applied: false,
                  matchedFunctionIds: [1, 2],
                  unmatchedFunctionIds: [],
                  functionRefs: expect.arrayContaining([
                    expect.objectContaining({
                      field: 'function_1',
                      functionId: 1,
                      status: 'element_formula-row-found',
                      elementFormulaRow: expect.objectContaining({
                        id: 1,
                        functionOutput: 'G/10000',
                        variables: ['G'],
                      }),
                      variableInputs: [
                        {
                          variable: 'G',
                          paramId: 7,
                          formulaParamSlot: 7,
                          formulaParamValue: 10000,
                          slotStatus: 'formula-param-slot-found',
                        },
                      ],
                      applied: false,
                    }),
                    expect.objectContaining({
                      field: 'function_2',
                      functionId: 2,
                      status: 'element_formula-row-found',
                      elementFormulaRow: expect.objectContaining({
                        id: 2,
                        functionOutput: '(self.ATK[0]*A)/10000',
                        variables: ['A'],
                      }),
                      variableInputs: [
                        {
                          variable: 'A',
                          paramId: 1,
                          formulaParamSlot: 1,
                          formulaParamValue: 1000,
                          slotStatus: 'formula-param-slot-found',
                        },
                      ],
                      applied: false,
                    }),
                  ]),
                  runtimeEvidence: expect.arrayContaining([
                    expect.objectContaining({
                      className: 'FormulaParams',
                      fields: [
                        'function_1',
                        'function_2',
                        'formulaParamValues',
                      ],
                    }),
                    expect.objectContaining({
                      className: 'DamageElement',
                    }),
                    expect.objectContaining({
                      className: 'BattleConfigManager',
                      properties: ['elementFormulaConfig'],
                    }),
                  ]),
                }),
                formulaSlotCandidates: expect.arrayContaining([
                  {
                    slot: 2,
                    variable: 'B',
                    rawValue: 3000,
                    roleStatus: 'unconfirmed-formula-input',
                  },
                  {
                    slot: 6,
                    variable: 'F',
                    rawValue: 8500,
                    roleStatus: 'unconfirmed-formula-input',
                  },
                ]),
              }),
              toughnessDamage: expect.objectContaining({
                weakBreakDamageRate: 7000,
                hitType: 0,
                knockBackId: 4,
                knockBackForce: 3,
              }),
              selfEnergyChange: expect.objectContaining({
                recoverSP: 5899,
                petRecoverSP: 22999,
                recoverInterval: 9999,
              }),
              skillLevelBridge: expect.objectContaining({
                status: 'skillsub-element-level-bridge-missing',
                elementConfigId: 109001251,
                levelRows: 0,
              }),
            }),
            expect.objectContaining({
              elementConfigId: 109001081,
              hpDamage: expect.objectContaining({
                formulaSlotCandidates: expect.arrayContaining([
                  expect.objectContaining({
                    slot: 2,
                    rawValue: 1900,
                  }),
                ]),
              }),
              skillLevelBridge: expect.objectContaining({
                status: 'skillsub-element-level-bridge-found',
                levelRows: 12,
                parameterIds: [1, 7],
                varyingParameterIds: [1],
                firstLevel: expect.objectContaining({
                  valueParam: '1#1600|7#10000',
                }),
                lastLevel: expect.objectContaining({
                  valueParam: '1#3360|7#10000',
                }),
                formulaParamAlignment: expect.objectContaining({
                  status: 'same-element-id-found-slot-alignment-unverified',
                  conclusion: 'slot-override-candidate-unconfirmed',
                  directSlotMatchParamIds: [7],
                  overrideCandidateParamIds: [1],
                  missingFormulaSlotParamIds: [],
                  parameterSummaries: [
                    expect.objectContaining({
                      id: 1,
                      variable: 'A',
                      formulaParamValue: 1000,
                      levelRows: 12,
                      minValue: 1600,
                      maxValue: 3360,
                      firstLevelValue: 1600,
                      lastLevelValue: 3360,
                      isConstantAcrossLevels: false,
                      directSlotMatchLevels: [],
                      mismatchLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                      directSlotMatchCount: 0,
                      mismatchCount: 12,
                      progression: {
                        status: 'arithmetic-progression',
                        step: 160,
                        uniqueDeltas: [160],
                        isArithmetic: true,
                      },
                      relationStatus: 'level-scaling-override-candidate',
                    }),
                    expect.objectContaining({
                      id: 7,
                      variable: 'G',
                      formulaParamValue: 10000,
                      levelRows: 12,
                      minValue: 10000,
                      maxValue: 10000,
                      isConstantAcrossLevels: true,
                      directSlotMatchLevels: [
                        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
                      ],
                      mismatchLevels: [],
                      directSlotMatchCount: 12,
                      mismatchCount: 0,
                      progression: {
                        status: 'arithmetic-progression',
                        step: 0,
                        uniqueDeltas: [0],
                        isArithmetic: true,
                      },
                      relationStatus: 'constant-direct-slot-match',
                    }),
                  ],
                  firstLevelDirectSlotMatches: [7],
                  firstLevelMismatches: [
                    {
                      id: 1,
                      variable: 'A',
                      skillsubValue: 1600,
                      formulaParamValue: 1000,
                    },
                  ],
                }),
              }),
            }),
          ]),
        }),
      ]),
    });
    expect(
      evidence.currentSkillControlEvidence
        .filter(item => item.status === 'missing')
        .map(item => item.skillId)
    ).toEqual([10101062, 10700262, 10800562, 11200262]);
    expect(mayoiAttack).toMatchObject({
      status: 'found',
      jsonFileCount: 97,
      frameRange: {
        minStartFrame: 0,
        maxEndFrame: 300,
      },
      effectLaneCandidateSummary: {
        hpDamage: {
          count: 5,
        },
        toughnessDamage: {
          count: 0,
        },
        selfEnergyChange: {
          count: 0,
        },
      },
    });
    expect(mayoiAttack.skillResourceMapEvidence).toMatchObject({
      status: 'root-skillResourceMaps-found',
      resourceMapCount: 2,
      elementRefCount: 8,
      resourceMaps: [
        expect.objectContaining({
          subSkillIds: [10900101],
          stateNames: ['Skill0_1'],
          hitEffects: ['11_109001_116'],
        }),
        expect.objectContaining({
          subSkillIds: [109001011],
          stateNames: ['Skill0_6'],
          hitEffects: ['11_109001_133', '11_109001_005'],
        }),
      ],
    });
    expect(mayoiAttack.behaviorReferenceSummary).toMatchObject({
      behaviorListRefs: 44,
      resolvedBehaviorListRefs: 44,
      unresolvedBehaviorListRefs: 0,
      externalElementBaseRefs: 14,
      resourceMapMatchedElementBaseRefs: 14,
      resourceMapUnmatchedElementBaseRefs: 0,
      scriptTypeCandidateBehaviorRefs: 12,
      resolvedBehaviorRefsByLane: {
        hpDamage: 5,
        toughnessDamage: 0,
        selfEnergyChange: 0,
        elementEffect: 6,
        timingControl: 8,
        presentation: 25,
      },
    });
    expect(hanyouyouUltimate).toMatchObject({
      status: 'found',
      skillId: 10100313,
      skillName: '沐星雨',
      jsonFileCount: 177,
      effectLaneCandidateSummary: {
        hpDamage: {
          count: 7,
        },
        toughnessDamage: {
          count: 1,
        },
      },
      behaviorReferenceSummary: {
        behaviorListRefs: 28,
        resolvedBehaviorListRefs: 28,
        externalElementBaseRefs: 7,
        resourceMapMatchedElementBaseRefs: 7,
        resolvedBehaviorRefsByLane: {
          hpDamage: 7,
          toughnessDamage: 1,
        },
      },
      stateTimingEvidence: {
        status: 'state-timing-evidence-found-action-binding-unconfirmed',
        animationStateNames: ['Skill1', 'Skill1_Tps'],
        animationStateControlCount: 2,
      },
    });
    const hanyouyouHitChain =
      hanyouyouAttack.stateTimingEvidence.eventBridgeTargetSkillControlEvidence
        .normalAttackHitChainCandidate;
    expect(hanyouyouHitChain).toMatchObject({
      status: 'normal-attack-hit-chain-candidates-found-unconfirmed',
      candidateHitGroupCount: 4,
      coverageStatus: 'description-hit-count-missing',
      damageElementFieldMappingStatus:
        'partial-hit-groups-have-damage-element-field-mappings',
      damageElementMappedHitGroupCount: 2,
      damageElementFieldMappingCount: 2,
      damageElementElementConfigIds: [101003037, 101003046],
      formulaParamBuffReferenceHitGroupCount: 1,
      formulaParamBuffReferenceIds: [101003079],
    });
    expect(hanyouyouHitChain.hitGroups).toEqual([
      expect.objectContaining({
        hitIndex: 2,
        skillId: 10100302,
        candidateSource: 'event-bridge-child-skill-control-resource-map',
        hpTimelineCandidateCount: 0,
        resourceMapElementRefCount: 2,
        damageElementFieldMappingStatus: 'damage-element-field-mappings-found',
        damageElementFieldMappingCount: 1,
        damageElementElementConfigIds: [101003046],
      }),
      expect.objectContaining({
        hitIndex: 3,
        skillId: 10100303,
        candidateSource: 'event-bridge-child-skill-control-resource-map',
        hpTimelineCandidateCount: 0,
        resourceMapElementRefCount: 1,
        damageElementFieldMappingStatus: 'damage-element-field-mappings-found',
        damageElementFieldMappingCount: 1,
        damageElementElementConfigIds: [101003037],
      }),
      expect.objectContaining({
        hitIndex: 4,
        skillId: 10100304,
        candidateSource: 'event-bridge-child-skill-control-resource-map',
        hpTimelineCandidateCount: 0,
        resourceMapElementRefCount: 2,
        damageElementFieldMappingStatus:
          'resource-map-element-refs-found-damage-element-fields-missing',
        damageElementFieldMappingCount: 0,
        externalElementObjectReferenceCount: 2,
        externalElementObjectReferences: expect.arrayContaining([
          expect.objectContaining({
            elementConfigId: 101003180,
            scriptTypeClassName: 'TSummonElementParams',
            summonFields: expect.objectContaining({
              summonUnitId: 480059,
              summonLifeTime: 2500,
            }),
            summonTargetSkillEvidence: expect.objectContaining({
              targetSkillIds: [48005901],
              damageElementConfigIds: [101003156, 101003182],
              applied: false,
            }),
          }),
        ]),
      }),
      expect.objectContaining({
        hitIndex: 5,
        skillId: 10100305,
        candidateSource: 'event-bridge-child-skill-control-resource-map',
        hpTimelineCandidateCount: 0,
        resourceMapElementRefCount: 3,
        damageElementFieldMappingStatus:
          'resource-map-element-buff-reference-found-damage-element-fields-missing',
        damageElementFieldMappingCount: 0,
        externalElementObjectReferenceCount: 3,
        externalElementObjectReferences: expect.arrayContaining([
          expect.objectContaining({
            elementConfigId: 101003181,
            scriptTypeClassName: 'TSummonElementParams',
            formulaParamBuffReferenceIds: [101003079],
            summonFields: expect.objectContaining({
              summonUnitId: 480060,
              summonLifeTime: 2500,
            }),
            summonTargetSkillEvidence: expect.objectContaining({
              targetSkillIds: [48006001],
              damageElementConfigIds: [101003157, 101003179],
              applied: false,
            }),
          }),
        ]),
        formulaParamBuffReferenceCount: 1,
        formulaParamBuffReferenceIds: [101003079],
        formulaParamBuffReferences: [
          expect.objectContaining({
            sourceElementConfigId: 101003181,
            buffId: 101003079,
            formulaParamSlots: [2, 13],
            buffInfo: expect.objectContaining({
              name: '焰火',
              description: '受到特定伤害时触发爆炸',
            }),
          }),
        ],
      }),
    ]);
    expect(evidence.damageElementFieldMappingEvidence.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: 10100313,
          damageElementCount: 2,
          fieldMappings: expect.arrayContaining([
            expect.objectContaining({
              elementConfigId: 101003118,
              hpDamage: expect.objectContaining({
                status: 'candidate-from-TDamageElementParams-formulaParams',
              }),
              toughnessDamage: expect.objectContaining({
                weakBreakDamageRate: 7000,
              }),
            }),
            expect.objectContaining({
              elementConfigId: 101003122,
              hpDamage: expect.objectContaining({
                status: 'candidate-from-TDamageElementParams-formulaParams',
              }),
              toughnessDamage: expect.objectContaining({
                weakBreakDamageRate: 7000,
              }),
            }),
          ]),
        }),
      ])
    );
    expect(mayoiAttack.effectLaneCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          laneHints: ['hpDamage'],
          name: '攻击碰撞',
          startFrame: 19,
          endFrame: 20,
        }),
      ])
    );
    expect(mayoiAttack.effectLaneCandidatesByLane.hpDamage).toHaveLength(5);
    expect(
      mayoiAttack.effectLaneCandidatesByLane.hpDamage.map(item => [
        item.name,
        item.startFrame,
        item.endFrame,
      ])
    ).toEqual([
      ['攻击碰撞', 19, 20],
      ['普通-攻击碰撞', 13, 14],
      ['攻击碰撞', 16, 17],
      ['攻击碰撞', 13, 14],
      ['普通-攻击碰撞', 12, 13],
    ]);
    expect(mayoiAttack.effectLaneBehaviorChainsByLane.hpDamage).toHaveLength(5);
    expect(
      mayoiAttack.effectLaneBehaviorChainsByLane.hpDamage.map(item => [
        item.sourceName,
        item.sourceStartFrame,
        item.resolvedBehaviors[0].resourceBindings?.stateNames?.[0] ??
          item.resolvedBehaviors[0].elementBaseDataRefs?.[0]
            ?.resourceMapMatches?.[0]?.stateNames?.[0],
      ])
    ).toEqual([
      ['攻击碰撞', 19, 'Skill0_6'],
      ['普通-攻击碰撞', 13, 'Skill0_1'],
      ['攻击碰撞', 16, 'Skill0_6'],
      ['攻击碰撞', 13, 'Skill0_6'],
      ['普通-攻击碰撞', 12, 'Skill0_1'],
    ]);
    expect(mayoiAttack.stateTimingEvidence).toMatchObject({
      status: 'state-timing-evidence-found-action-binding-unconfirmed',
      scope: 'skill-level-action-state-candidates',
      hpStateWindowCount: 5,
      timingControlChainCount: 8,
      animationStateControlCount: 2,
      eventBridgeControlCount: 6,
      hpStateNames: ['Skill0_1', 'Skill0_6'],
      animationStateNames: ['Skill0_1', 'Skill0_6'],
      eventBridgeSkillIds: [0, 80102, 10900102],
      bindingStatus: 'state-timing-evidence-candidates-unconfirmed',
      applied: false,
    });
    expect(
      mayoiAttack.stateTimingEvidence.normalAttackDescriptionEvidence
    ).toMatchObject({
      status: 'normal-attack-hit-count-found',
      sourceKind: 'azpr-skill-description-normal-attack-hit-count',
      sectionTitle: '普通攻击',
      expectedHitCount: 5,
      applied: false,
    });
    expect(
      mayoiAttack.stateTimingEvidence.eventBridgeTargetSkillControlEvidence
    ).toMatchObject({
      status: 'event-bridge-target-skill-controls-indexed',
      directTargetSkillIds: [80102, 10900102],
      targetSkillIds: [80102, 10900102, 10900103, 10900104, 10900105],
      targetSkillControlCount: 5,
      foundTargetSkillControlCount: 4,
      missingTargetSkillControlCount: 1,
      childSkillTargetIds: [10900102, 10900103, 10900104, 10900105],
      chainDepthMax: 4,
      targetAnimationStateNames: [
        'Skill0_2',
        'Skill0_3',
        'Skill0_4',
        'Skill0_5',
      ],
      targetHpTrackNames: [
        '上挑hit-攻击框',
        '左转圈hit -攻击框',
        '攻击碰撞1',
        '无属性-攻击碰撞2',
        '普攻-攻击碰撞',
        '最后1hit-攻击碰撞',
        '最后大hit-攻击框',
      ],
      normalAttackChainCandidate: {
        status: 'normal-attack-child-skill-chain-candidate-unconfirmed',
        chainSkillIds: [10900102, 10900103, 10900104, 10900105],
        chainLength: 4,
        animationStateNames: ['Skill0_2', 'Skill0_3', 'Skill0_4', 'Skill0_5'],
        hpTimelineCandidateCount: 30,
        bridgeTargetSkillIds: [0, 10900103, 10900104, 10900105],
        applied: false,
      },
      normalAttackHitChainCandidate: expect.objectContaining({
        status: 'normal-attack-hit-chain-candidates-found-unconfirmed',
        bindingStatus: 'normal-attack-hit-chain-candidates-unconfirmed',
        expectedHitCount: 5,
        expectedHitCountSource:
          'azpr-skill-description-normal-attack-hit-count',
        descriptionSectionTitle: '普通攻击',
        candidateHitGroupCount: 5,
        coverageStatus: 'matches-description-hit-count',
        chainSkillIds: [10900102, 10900103, 10900104, 10900105],
        animationStateNames: [
          'Skill0_1',
          'Skill0_2',
          'Skill0_3',
          'Skill0_4',
          'Skill0_5',
        ],
        hpTimelineCandidateCount: 32,
        damageElementFieldMappingStatus:
          'all-hit-groups-have-damage-element-field-mappings',
        damageElementMappedHitGroupCount: 5,
        damageElementFieldMappingCount: 12,
        damageElementElementConfigIds: [
          109001018, 109001021, 109001081, 109001117, 109001134, 109001135,
          109001137, 109001280, 109001285, 109001306, 109001313, 109001328,
        ],
        applied: false,
      }),
      applied: false,
    });
    expect(
      mayoiAttack.stateTimingEvidence.eventBridgeTargetSkillControlEvidence
        .normalAttackHitChainCandidate.hitGroups
    ).toEqual([
      expect.objectContaining({
        hitIndex: 1,
        skillId: 10900101,
        discoveryDepth: 0,
        animationStateNames: ['Skill0_1'],
        hpTimelineCandidateCount: 2,
        hpFrameStartFrames: [12, 13],
        subSkillIds: [10900101],
        hitEffects: ['11_109001_116'],
        behaviorChainCandidateCount: 2,
        resolvedBehaviorCount: 2,
        externalElementBaseRefCount: 4,
        resourceMapMatchedElementBaseRefCount: 4,
        resourceMapUnmatchedElementBaseRefCount: 0,
        damageElementFieldMappingStatus: 'damage-element-field-mappings-found',
        damageElementFieldMappingCount: 2,
        damageElementElementConfigIds: [109001081, 109001306],
        bindingStatus: 'normal-attack-hit-candidate-unconfirmed',
        applied: false,
      }),
      expect.objectContaining({
        hitIndex: 2,
        skillId: 10900102,
        discoveryDepth: 1,
        animationStateNames: ['Skill0_2'],
        hpTimelineCandidateCount: 4,
        hpFrameStartFrames: [6, 10, 14, 26],
        behaviorChainCandidateCount: 4,
        damageElementFieldMappingCount: 2,
        damageElementElementConfigIds: [109001018, 109001137],
      }),
      expect.objectContaining({
        hitIndex: 3,
        skillId: 10900103,
        discoveryDepth: 2,
        animationStateNames: ['Skill0_3'],
        hpTimelineCandidateCount: 9,
        hpFrameStartFrames: [12, 18, 24, 30, 36, 42, 48, 54, 60],
        behaviorChainCandidateCount: 9,
        damageElementFieldMappingCount: 2,
        damageElementElementConfigIds: [109001134, 109001280],
      }),
      expect.objectContaining({
        hitIndex: 4,
        skillId: 10900104,
        discoveryDepth: 3,
        animationStateNames: ['Skill0_4'],
        hpTimelineCandidateCount: 7,
        hpFrameStartFrames: [7, 11, 15, 29, 45, 49, 53],
        behaviorChainCandidateCount: 7,
        damageElementFieldMappingCount: 3,
        damageElementElementConfigIds: [109001021, 109001135, 109001328],
      }),
      expect.objectContaining({
        hitIndex: 5,
        skillId: 10900105,
        discoveryDepth: 4,
        animationStateNames: ['Skill0_5'],
        hpTimelineCandidateCount: 10,
        hpFrameStartFrames: [4, 8, 12, 16, 20, 47, 56, 61, 66, 71],
        behaviorChainCandidateCount: 10,
        damageElementFieldMappingCount: 3,
        damageElementElementConfigIds: [109001117, 109001285, 109001313],
      }),
    ]);
    expect(
      mayoiAttack.stateTimingEvidence.eventBridgeTargetSkillControlEvidence
        .targetSkillControls
    ).toEqual([
      expect.objectContaining({
        skillId: 10900102,
        status: 'found',
        skillTableStatus: 'found',
        parentSkill: 10900101,
        relationToSourceSkill: 'child-skill-of-source',
        discoveryDepth: 1,
        discoveredFromSkillId: 10900101,
        animationStateControlCount: 3,
        animationStateNames: ['Skill0_2'],
        hpTimelineCandidateCount: 4,
        eventBridgeSkillIds: [0, 10900103],
        hpTimelineCandidates: expect.arrayContaining([
          expect.objectContaining({
            name: '攻击第1段',
            trackName: '普攻-攻击碰撞',
            startFrame: 6,
            endFrame: 7,
          }),
        ]),
      }),
      expect.objectContaining({
        skillId: 10900103,
        status: 'found',
        relationToSourceSkill: 'child-skill-of-source',
        discoveryDepth: 2,
        discoveredFromSkillId: 10900102,
        animationStateControlCount: 1,
        animationStateNames: ['Skill0_3'],
        hpTimelineCandidateCount: 9,
        eventBridgeSkillIds: [0, 10900104],
      }),
      expect.objectContaining({
        skillId: 10900104,
        status: 'found',
        relationToSourceSkill: 'child-skill-of-source',
        discoveryDepth: 3,
        discoveredFromSkillId: 10900103,
        animationStateControlCount: 3,
        animationStateNames: ['Skill0_4'],
        hpTimelineCandidateCount: 7,
        eventBridgeSkillIds: [0, 10900105],
      }),
      expect.objectContaining({
        skillId: 10900105,
        status: 'found',
        relationToSourceSkill: 'child-skill-of-source',
        discoveryDepth: 4,
        discoveredFromSkillId: 10900104,
        animationStateControlCount: 1,
        animationStateNames: ['Skill0_5'],
        hpTimelineCandidateCount: 10,
        eventBridgeSkillIds: [0],
      }),
      expect.objectContaining({
        skillId: 80102,
        status: 'missing-skill-control-directory',
        skillTableStatus: 'missing-skill-table-row',
        relationToSourceSkill: 'unknown-target-not-in-skill-table',
        discoveryDepth: 1,
        discoveredFromSkillId: 10900101,
      }),
    ]);
    expect(mayoiAttack.stateTimingEvidence.animationStateControls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          selectedStateName: 'Skill0_1',
          aniLength: 300,
          aniStartFrame: 0,
          aniEndFrame: 300,
          scriptTypeCandidate: expect.objectContaining({
            className: 'AnimationBehaviorData',
          }),
        }),
        expect.objectContaining({
          selectedStateName: 'Skill0_6',
          aniLength: 230,
          aniStartFrame: 0,
          aniEndFrame: 21,
          scriptTypeCandidate: expect.objectContaining({
            className: 'AnimationBehaviorData',
          }),
        }),
      ])
    );
    expect(mayoiAttack.stateTimingEvidence.eventBridgeControls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceName: '连击桥接',
          sourceStartFrame: 0,
          sourceEndFrame: 29,
          skillId: 80102,
          frameIndex: 8,
          allowedInputs: expect.arrayContaining(['jump', 'dodge']),
          scriptTypeCandidate: expect.objectContaining({
            className: 'EventBridgeBehaviorData',
          }),
        }),
        expect.objectContaining({
          sourceName: '立即跳转',
          sourceStartFrame: 16,
          sourceEndFrame: 43,
          skillId: 10900102,
          type: 1,
        }),
      ])
    );
    expect(mayoiAttack.stateTimingEvidence.stateFindings).toEqual([
      expect.objectContaining({
        stateName: 'Skill0_1',
        status: 'hp-state-has-animation-control-candidate',
        hpWindowCount: 2,
        hpStartFrames: [12, 13],
        subSkillIds: [10900101],
        animationControlCount: 1,
        overlappingEventBridgeCount: 2,
        overlappingEventBridgeNames: expect.arrayContaining([
          '前摇打断',
          '连击桥接',
        ]),
      }),
      expect.objectContaining({
        stateName: 'Skill0_6',
        status: 'hp-state-has-animation-control-candidate',
        hpWindowCount: 3,
        hpStartFrames: [13, 16, 19],
        subSkillIds: [109001011],
        animationControlCount: 1,
        overlappingEventBridgeCount: 3,
        overlappingEventBridgeNames: expect.arrayContaining([
          '前摇打断',
          '立即跳转',
          '连击桥接',
        ]),
      }),
    ]);
    expect(mayoiAttack.effectLaneBehaviorChains).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          laneHints: ['hpDamage'],
          sourceName: '攻击碰撞',
          sourceStartFrame: 19,
          sourceEndFrame: 20,
          behaviorRefs: [
            expect.objectContaining({
              pathId: '1081335820946113461',
              targetFile:
                'MonoBehaviour_1081335820946113461__1081335820946113461.json',
              status: 'resolved-local-monoBehaviour',
            }),
          ],
          resolvedBehaviors: [
            expect.objectContaining({
              pathId: '1081335820946113461',
              scriptPathId: '8289252000250858251',
              scriptTypeCandidate: expect.objectContaining({
                status: 'field-signature-matched',
                confidence: 'medium',
                className: 'InjectToTargetKeyFrameBehaviorData',
                typeDefIndex: 7239,
                matchedFields: expect.arrayContaining([
                  'elementBaseDatas',
                  'toOwnElementBaseDatas',
                  'damageEffectId',
                ]),
              }),
              startFrame: 19,
              frameCount: 1,
              collisionLayer: 5,
              elementalType: 1023,
              targetType: 1,
              externalElementBaseRefCount: 3,
              resourceMapMatchedElementBaseRefCount: 3,
              elementBaseDataRefs: [
                expect.objectContaining({
                  pathId: '-5633710717881758712',
                  resourceMapMatchCount: 1,
                  resourceMapMatches: [
                    expect.objectContaining({
                      subSkillIds: [109001011],
                      stateNames: ['Skill0_6'],
                      hitEffects: ['11_109001_133', '11_109001_005'],
                    }),
                  ],
                }),
                expect.objectContaining({
                  pathId: '7848597992417622553',
                  resourceMapMatchCount: 1,
                }),
                expect.objectContaining({
                  pathId: '2740651767650299388',
                  resourceMapMatchCount: 1,
                }),
              ],
            }),
          ],
        }),
      ])
    );
    expect(evidence.nextTraceTargets[0]).toMatchObject({
      skillId: 10900101,
      frameRange: {
        minStartFrame: 0,
        maxEndFrame: 300,
      },
    });
  });

  it('cross-checks generated skill multipliers against NewTable skill_level rows', () => {
    const manifest = getAzprGeneratedManifest();
    const crossCheck = getAzprSkillLevelCrossCheck();
    const mayoiAttack = crossCheck.items.find(
      item => item.skillId === 10900101
    );
    const mismatches = crossCheck.items.filter(
      item => item.status !== 'matched'
    );

    expect(manifest.files.skillLevelCrossCheck).toBe(
      'skill-level-crosscheck.json'
    );
    expect(crossCheck.count).toBe(120);
    expect(crossCheck.summary).toMatchObject({
      matchedSkills: 118,
      missingSkills: 0,
      mismatchedSkills: 2,
      matchedLevels: 998,
      missingLevels: 0,
      mismatchedLevels: 2,
    });
    expect(mayoiAttack.levels[0]).toMatchObject({
      rowId: 1657,
      status: 'matched',
      labels: ['普攻', '重击', '闪击', '跃击'],
      values: ['649%', '190%', '40%', '136%'],
      labelIds: [
        '7116760813568',
        '7116760813569',
        '7116760813570',
        '7116760813571',
      ],
      valueIds: [
        '7116760813824',
        '7116760813825',
        '7116760813826',
        '7116760813827',
      ],
      matches: {
        labels: true,
        values: true,
      },
    });
    expect(mismatches.map(item => item.skillId)).toEqual([10800562, 19900361]);
  });

  it('maps skill_level subSkillId rows to skillsub_logic and skillsub_ele_value', () => {
    const manifest = getAzprGeneratedManifest();
    const logicIndex = getAzprSkillLogicIndex();
    const mayoiAttack = logicIndex.items.find(
      item => item.skillId === 10900101
    );
    const timingMismatch = logicIndex.items.find(
      item => item.skillId === 10100712
    );

    expect(manifest.files.skillLogicIndex).toBe('skill-logic-index.json');
    expect(logicIndex.count).toBe(120);
    expect(logicIndex.summary).toMatchObject({
      mappedSkills: 76,
      missingSkills: 0,
      mismatchedSkills: 44,
      subSkillIds: 120,
      missingLogicRows: 0,
      displayLogicMismatchSubSkills: 44,
      levelRows: 1000,
      elementValueRows: 2808,
      levelsMissingElementValues: 100,
      logicRowsWithNonZeroTiming: 60,
    });
    expect(mayoiAttack).toMatchObject({
      status: 'mapped',
      subSkillIds: [10900101],
      subSkills: [
        {
          subSkillId: 10900101,
          logic: {
            cooldownMs: 0,
            spCost: 0,
            selfCooldownMs: 0,
            gcdMs: 0,
          },
          displayMatchesLogic: true,
        },
      ],
    });
    expect(mayoiAttack.levels[0]).toMatchObject({
      skillLevelRowId: 1657,
      subSkillId: 10900101,
      display: {
        cooldownMs: 0,
        spCost: 0,
      },
      elementValues: [
        {
          rowId: 973,
          elementId: 109001081,
          valueParam: '1#1600|7#10000',
        },
        {
          rowId: 985,
          elementId: 109001306,
          valueParam: '1#1600|7#10000',
        },
      ],
    });
    expect(timingMismatch.subSkills[0]).toMatchObject({
      subSkillId: 10100712,
      logic: {
        cooldownMs: 20000,
        spCost: 0,
      },
      displayPairs: [
        {
          cooldownMs: 13000,
          spCost: 0,
        },
      ],
      displayMatchesLogic: false,
    });
  });
});
