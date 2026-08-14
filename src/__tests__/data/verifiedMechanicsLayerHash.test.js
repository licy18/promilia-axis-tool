import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  BINDING_SKELETON_FIELDS,
  createDataProjection,
  createLayerHashesRecord,
  createMechanismProjection,
  computeLayerHashes,
} from '../../../scripts/verified-mechanics-layer-hash.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const packagePath = path.join(
  projectRoot,
  'src/data/generated/verified-combat-mechanics-package.json'
);
const layerHashPath = path.join(
  projectRoot,
  'src/data/generated/verified-combat-mechanics-layer-hashes.json'
);

function createMiniPackage() {
  return {
    schemaVersion: 1,
    kind: 'azpr-verified-combat-mechanics-package',
    packageId: 'mini',
    packageVersion: 1,
    status: 'ready',
    packageHash: 'x'.repeat(64),
    numericRuntime: {
      numericType: 'q16.16',
      finalIntegerization: 'floor',
    },
    policy: { uniqueSourceRequired: true },
    actionVariantGraph: { nodes: 3, edges: 2, defaultSelections: ['a'] },
    actionMappings: [
      {
        identity: 'actor|1|2|0|3|normal-attack',
        ownerKind: 'actor',
        ownerId: 1,
        actionKind: 'normal-attack',
        runtimeHitCount: 3,
        runtimeReady: true,
        extraNumericField: 42,
      },
    ],
    controlBindings: [
      {
        controlSkillId: 10101,
        runtimePolicy: 'applied',
        status: 'applied',
        confidence: 'verified',
        hits: [{ damage: 100, frame: 12 }],
        effects: [{ effectIdentity: 'e1', value: 0.05 }],
      },
    ],
    semanticEffectCatalog: {
      schemaVersion: 1,
      kind: 'catalog',
      status: 'ready',
      targetTypeContract: 'enemy',
      formulas: [{ formulaIdentity: 'f1', family: 'literal-a' }],
      semanticEffects: [
        { semanticKey: 's1', classification: 'applied', value: 1.5 },
      ],
    },
    summary: { candidateActionCount: 1 },
    sourceFiles: [{ id: 's', sha256: 'a'.repeat(64) }],
  };
}

function readRealPackage() {
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

describe('verified mechanics layer hash (Step 1 分层)', () => {
  it('数值字段变更只改变 dataVersionHash，不改 mechanismHash', () => {
    const base = createMiniPackage();
    const baseHashes = computeLayerHashes(base);

    const mutated = createMiniPackage();
    mutated.controlBindings[0].hits[0].damage = 999; // 数值侧
    const mutatedHashes = computeLayerHashes(mutated);

    expect(mutatedHashes.mechanismHash).toBe(baseHashes.mechanismHash);
    expect(mutatedHashes.dataVersionHash).not.toBe(baseHashes.dataVersionHash);
  });

  it('机制字段变更只改变 mechanismHash，不改 dataVersionHash', () => {
    const base = createMiniPackage();
    const baseHashes = computeLayerHashes(base);

    const mutated = createMiniPackage();
    mutated.numericRuntime.finalIntegerization = 'round'; // 机制侧
    const mutatedHashes = computeLayerHashes(mutated);

    expect(mutatedHashes.mechanismHash).not.toBe(baseHashes.mechanismHash);
    expect(mutatedHashes.dataVersionHash).toBe(baseHashes.dataVersionHash);
  });

  it('绑定骨架字段变更只改变 mechanismHash，不改 dataVersionHash', () => {
    const base = createMiniPackage();
    const baseHashes = computeLayerHashes(base);

    const mutated = createMiniPackage();
    mutated.controlBindings[0].runtimePolicy = 'changed'; // 骨架字段
    const mutatedHashes = computeLayerHashes(mutated);

    expect(mutatedHashes.mechanismHash).not.toBe(baseHashes.mechanismHash);
    expect(mutatedHashes.dataVersionHash).toBe(baseHashes.dataVersionHash);
  });

  it('机制/数据投影互为补充：骨架字段在机制侧，其余在数据侧', () => {
    const base = createMiniPackage();
    const mechanism = createMechanismProjection(base);
    const data = createDataProjection(base);

    // 骨架字段出现在机制侧
    expect(mechanism.controlBindings[0].runtimePolicy).toBe('applied');
    expect(mechanism.actionMappings[0].identity).toBe(
      'actor|1|2|0|3|normal-attack'
    );
    // hits/effects 内容出现在数据侧
    expect(data.controlBindings[0].hits[0].damage).toBe(100);
    expect(data.controlBindings[0].effects[0].value).toBe(0.05);
    // 非骨架字段（extraNumericField）出现在数据侧
    expect(data.actionMappings[0].extraNumericField).toBe(42);
    // 机制侧不携带非骨架字段
    expect(mechanism.actionMappings[0].extraNumericField).toBeUndefined();
    // semanticEffectCatalog 拆分
    expect(mechanism.semanticEffectCatalog.formulas).toBeDefined();
    expect(mechanism.semanticEffectCatalog.semanticEffects).toBeUndefined();
    expect(data.semanticEffectCatalog.semanticEffects).toBeDefined();
    expect(data.semanticEffectCatalog.formulas).toBeUndefined();
  });

  it('绑定数组元素 = 机制骨架 ∪ 数据侧（partition 完备）', () => {
    const base = createMiniPackage();
    const mechanism = createMechanismProjection(base);
    const data = createDataProjection(base);
    for (const arrayKey of [
      'actionMappings',
      'controlBindings',
      'actionBindings',
      'actionVariantControlBindings',
    ]) {
      const mechEntries = mechanism[arrayKey] ?? [];
      const dataEntries = data[arrayKey] ?? [];
      expect(mechEntries.length).toBe(dataEntries.length);
      for (let i = 0; i < mechEntries.length; i += 1) {
        const union = { ...mechEntries[i], ...dataEntries[i] };
        expect(Object.keys(union).sort()).toEqual(
          Object.keys(base[arrayKey][i]).sort()
        );
      }
    }
  });

  it('真实包：分层 hash 记录与当前 package 自洽（自检）', () => {
    if (!fs.existsSync(layerHashPath)) {
      // 未生成小文件时跳过真实包自检
      expect(fs.existsSync(layerHashPath)).toBe(true);
      return;
    }
    const pkg = readRealPackage();
    const record = JSON.parse(fs.readFileSync(layerHashPath, 'utf8'));
    const computed = computeLayerHashes(pkg);
    expect(record.packageId).toBe(pkg.packageId);
    expect(record.packageHash).toBe(pkg.packageHash);
    expect(computed.mechanismHash).toBe(record.mechanismHash);
    expect(computed.dataVersionHash).toBe(record.dataVersionHash);
    expect(record.mechanismHash).toMatch(/^[a-f0-9]{64}$/);
    expect(record.dataVersionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('真实包：数值投影/机制投影均为非空且覆盖主要清单', () => {
    const pkg = readRealPackage();
    const mechanism = createMechanismProjection(pkg);
    const data = createDataProjection(pkg);
    expect(mechanism.numericRuntime).toBeDefined();
    expect(mechanism.actionVariantGraph).toBeDefined();
    expect(mechanism.switchTriggerCatalog).toBeDefined();
    expect(mechanism.battleEffectCatalog).toBeDefined();
    expect(mechanism.semanticEffectCatalog.formulas.length).toBeGreaterThan(0);
    expect(mechanism.actionMappings.length).toBeGreaterThan(0);
    expect(mechanism.controlBindings.length).toBeGreaterThan(0);
    expect(data.sourceFiles.length).toBeGreaterThan(0);
    expect(data.characterCombatProfileCatalog.profiles.length).toBeGreaterThan(
      0
    );
    expect(data.semanticEffectCatalog.semanticEffects.length).toBeGreaterThan(
      0
    );
    // 骨架字段引用完整性：真实包骨架清单字段必须存在（防止清单漂移）
    const firstMapping = pkg.actionMappings[0];
    for (const field of BINDING_SKELETON_FIELDS.actionMappings) {
      expect(firstMapping).toHaveProperty(field);
    }
  });
});
