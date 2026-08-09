import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { getMachineAxisEnemySettlementContract } from '../../machine-axis/machineAxisEnemySettlementContract';
import { VERIFIED_ENEMY_DAMAGE_PACKET_SETTLEMENT_ORDER } from '../../simulation/mechanics/verifiedCombatRuntime';
import {
  ENEMY_TOUGHNESS_SETTLEMENT_EVIDENCE_RELATIVE_PATH,
  ENEMY_TOUGHNESS_SETTLEMENT_REPORT_RELATIVE_PATH,
  assertEnemyToughnessSettlementEvidenceReference,
  assertEnemyToughnessSettlementReportReference,
  readEnemyToughnessSettlementEvidenceSource,
  validateEnemyToughnessSettlementEvidence,
} from '../../../scripts/machine-axis/enemy-toughness-settlement-evidence.mjs';

const PROJECT_ROOT = path.resolve('.');
let source;
let runtimeSource;

beforeAll(async () => {
  source = await readEnemyToughnessSettlementEvidenceSource({
    sourcePath: path.join(
      PROJECT_ROOT,
      ENEMY_TOUGHNESS_SETTLEMENT_EVIDENCE_RELATIVE_PATH
    ),
    gameAssemblyPath:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll',
    il2CppDumpPath:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs',
    il2CppScriptPath:
      'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/script.json',
    captureManifestPath: path.join(
      PROJECT_ROOT,
      'src/data/generated/runtime-capture-hook-manifest.json'
    ),
    projectRoot: PROJECT_ROOT,
  });
  runtimeSource = await fs.readFile(
    path.join(
      PROJECT_ROOT,
      'src/simulation/mechanics/verifiedCombatRuntime.js'
    ),
    'utf8'
  );
}, 30_000);

describe('Machine Axis native enemy toughness settlement evidence', () => {
  it('recomputes binary ranges, callsites and a fail-closed static report', async () => {
    const generated = JSON.parse(
      await fs.readFile(
        path.join(
          PROJECT_ROOT,
          ENEMY_TOUGHNESS_SETTLEMENT_REPORT_RELATIVE_PATH
        ),
        'utf8'
      )
    );

    expect(source.report).toEqual(generated);
    expect(source.report).toMatchObject({
      phase: 'M12-B3-OPT-T2',
      reportHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      conclusion: {
        status: 'static-partial-controlled-capture-required',
        formalReady: false,
        blockerCode: 'machine-axis-enemy-settlement-client-order-open',
        closes: expect.arrayContaining([
          'single-packet-break-multiplier-reads-pre-change-weak-state',
          'single-packet-toughness-change-dispatch-precedes-change-hp',
          'local-controlled-break-and-recovery-timers-advance-by-per-update-delta-not-fixed-100ms',
        ]),
        leavesOpen: expect.arrayContaining([
          'same-frame-damage-element-queue-order-and-immediate-weak-state-visibility',
          'finite-hp-lethal-packet-and-post-death-tail-packet-disposition',
          'authoritative-local-versus-remote-network-path-for-the-zero-distance-passive-boss-scenario',
        ]),
        runtimeComparison: {
          settlementOrder: VERIFIED_ENEMY_DAMAGE_PACKET_SETTLEMENT_ORDER,
          matches: expect.arrayContaining([
            'ordinary-hit-and-tuning-packet-mutate-toughness-and-break-before-hp-settlement',
          ]),
          corrected: [
            'ordinary-hit-runtime-single-packet-mutation-order-now-matches-client-static-dispatch-order',
            'tuning-runtime-single-packet-mutation-order-now-matches-client-static-dispatch-order',
          ],
          differs: [
            'native-local-state-machine-uses-per-update-delta-while-m12-enemy-settlement-runtime-v2-uses-fixed-100ms-ticks',
          ],
          pendingControlledCapture: expect.any(Array),
          correctionStatus:
            'single-packet-runtime-order-corrected-controlled-capture-required-for-open-cross-packet-frame-lethal-and-authoritative-path-boundaries',
        },
      },
    });
    expect(
      source.report.conclusion.runtimeComparison.pendingControlledCapture
    ).toEqual(source.report.conclusion.leavesOpen);
  });

  it('binds ordinary hit and tuning mutation paths to the executable shared settlement', () => {
    for (const [start, end] of [
      [
        'function applyTuningCombatDescriptor({',
        'function applyTuningPeriodicHeal({',
      ],
      ['function applyHitDescriptor({', 'function createVerifiedCombatHitKey('],
    ]) {
      const body = extractRuntimeFunction(runtimeSource, start, end);
      expect(body.match(/settleVerifiedEnemyDamagePacket\(\{/g)).toHaveLength(
        1
      );
      expect(body).not.toMatch(/enemy\.(?:hp|toughness)\s*=/);
    }
  });

  it.each([
    [
      'binary identity',
      (value, observations) => {
        observations.binaryIdentity.sha256 = '0'.repeat(64);
      },
      'binary-drift',
    ],
    [
      'method RVA',
      value => {
        value.dumpBindings.methods[0].rva = '0x0';
      },
      'method-binding-drift',
    ],
    [
      'binary range',
      (value, observations) => {
        observations.rangeHashes[
          'damage-pre-break-read-and-toughness-dispatch'
        ].sha256 = 'f'.repeat(64);
      },
      'range-drift',
    ],
    [
      'direct callsite',
      (value, observations) => {
        observations.callsites['damage-read-current-weak-state'].targetRva =
          '0x0';
      },
      'callsite-drift',
    ],
    [
      'state enum',
      value => {
        value.dumpBindings.enums[1].declaration =
          'public const EWeakBreakState WeakBreaking = 2;';
      },
      'enum-binding-drift',
    ],
    [
      'packet-order conclusion',
      value => {
        value.conclusion.closes[0] = 'breaking-packet-post-break';
      },
      'conclusion-drift',
    ],
    [
      'runtime comparison',
      value => {
        value.conclusion.runtimeComparison.corrected = [];
      },
      'runtime-comparison-drift',
    ],
    [
      'capture manifest',
      (value, observations) => {
        observations.captureManifest.manifestId = 'tampered';
      },
      'capture-manifest-drift',
    ],
  ])('rejects tampered %s evidence', (_name, mutate, code) => {
    const value = structuredClone(source.value);
    const observations = cloneObservations(source.observations);
    mutate(value, observations);
    expect(() =>
      validateEnemyToughnessSettlementEvidence(value, observations)
    ).toThrow(code);
  });

  it.each(['path', 'bytes', 'sha256', 'binarySha256'])(
    'rejects tampered report reference field %s',
    field => {
      const reference = createEvidenceReference(source);
      reference[field] = field === 'bytes' ? reference[field] + 1 : 'tampered';
      expect(() =>
        assertEnemyToughnessSettlementEvidenceReference(reference, source)
      ).toThrow('report-reference-drift');
    }
  );

  it.each(['identity', 'bytes', 'sha256', 'reportHash'])(
    'rejects tampered generated report binding field %s',
    async field => {
      const reportPath = path.join(
        PROJECT_ROOT,
        ENEMY_TOUGHNESS_SETTLEMENT_REPORT_RELATIVE_PATH
      );
      const bytes = await fs.readFile(reportPath);
      const value = JSON.parse(bytes.toString('utf8'));
      const contract = getMachineAxisEnemySettlementContract();
      const reference = structuredClone(
        contract.evidence.sources.find(
          row => row.kind === 'client-static-evidence-report'
        )
      );
      const observed = {
        path: ENEMY_TOUGHNESS_SETTLEMENT_REPORT_RELATIVE_PATH,
        bytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        value,
      };
      expect(() =>
        assertEnemyToughnessSettlementReportReference(reference, observed)
      ).not.toThrow();
      reference[field] =
        field === 'bytes' ? Number(reference[field]) + 1 : 'tampered';
      expect(() =>
        assertEnemyToughnessSettlementReportReference(reference, observed)
      ).toThrow('generated-report-reference-drift');
    }
  );
});

function cloneObservations(observations) {
  return {
    ...observations,
    binaryIdentity: { ...observations.binaryIdentity },
    dumpIdentity: { ...observations.dumpIdentity },
    scriptIdentity: { ...observations.scriptIdentity },
    rangeHashes: structuredClone(observations.rangeHashes),
    callsites: structuredClone(observations.callsites),
    captureManifest: structuredClone(observations.captureManifest),
    captureManifestReference: { ...observations.captureManifestReference },
  };
}

function createEvidenceReference(value) {
  return {
    path: value.path,
    bytes: value.bytes,
    sha256: value.sha256,
    binaryPath: value.value.reviewedBinary.path,
    binaryBytes: value.value.reviewedBinary.bytes,
    binarySha256: value.value.reviewedBinary.sha256,
    il2CppDumpPath: value.value.reviewedIl2CppDump.path,
    il2CppDumpBytes: value.value.reviewedIl2CppDump.bytes,
    il2CppDumpSha256: value.value.reviewedIl2CppDump.sha256,
    il2CppScriptPath: value.value.reviewedIl2CppScript.path,
    il2CppScriptBytes: value.value.reviewedIl2CppScript.bytes,
    il2CppScriptSha256: value.value.reviewedIl2CppScript.sha256,
  };
}

function extractRuntimeFunction(sourceText, startMarker, endMarker) {
  const start = sourceText.indexOf(startMarker);
  const end = sourceText.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sourceText.slice(start, end);
}
