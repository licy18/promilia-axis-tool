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
          hpDamage: 1,
          toughnessDamage: 0,
          selfEnergyChange: 1,
          elementEffect: 3,
          timingControl: 4,
          presentation: 4,
        },
        hpDamageCandidateSkills: 1,
        toughnessCandidateSkills: 0,
        selfEnergyCandidateSkills: 1,
        behaviorReferenceResolvedSkills: 5,
        hpDamageBehaviorReferenceResolvedSkills: 1,
        externalElementBaseReferenceSkills: 1,
        resourceMapMatchedElementBaseReferenceSkills: 1,
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
        hpDamage: 1,
        toughnessDamage: 0,
        selfEnergyChange: 1,
        elementEffect: 3,
        timingControl: 4,
        presentation: 4,
      },
      hpDamageCandidateSkills: 1,
      toughnessCandidateSkills: 0,
      selfEnergyCandidateSkills: 1,
      behaviorReferenceResolvedSkills: 5,
      hpDamageBehaviorReferenceResolvedSkills: 1,
      externalElementBaseReferenceSkills: 1,
      resourceMapMatchedElementBaseReferenceSkills: 1,
      resourceMapUnmatchedElementBaseReferenceSkills: 0,
      relationStatus: 'skill-control-assets-found-in-azpr-extractor',
    });
    expect(
      evidence.currentSkillControlEvidence
        .filter(item => item.status === 'missing')
        .map(item => item.skillId)
    ).toEqual([10101062, 10700262, 10800562, 11200262]);
    expect(mayoiAttack).toMatchObject({
      status: 'found',
      jsonFileCount: 193,
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
      behaviorListRefs: 36,
      resolvedBehaviorListRefs: 36,
      unresolvedBehaviorListRefs: 0,
      externalElementBaseRefs: 13,
      resourceMapMatchedElementBaseRefs: 13,
      resourceMapUnmatchedElementBaseRefs: 0,
      resolvedBehaviorRefsByLane: {
        hpDamage: 5,
        toughnessDamage: 0,
        selfEnergyChange: 0,
        elementEffect: 6,
        timingControl: 5,
        presentation: 20,
      },
    });
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
