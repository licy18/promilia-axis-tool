import {
  qFromBasisPoints,
  qFromFloat,
  qMul,
  qToNumber,
} from './verifiedCombatFormulaRuntime';

export const VERIFIED_BATTLE_EFFECT_FORMULA_REGISTRY_NAME =
  'AzPrVerifiedBattleEffectFormulaRegistry';

const VERIFIED_TUNING_FUNCTION_IDS = new Set([119, 107205, 107207]);

export function classifyVerifiedBattleEffectFormula(effect = {}) {
  const commonFunctionId = Number(effect.formula?.commonFunctionId);
  const baseFunctionId = Number(effect.formula?.baseFunctionId);
  if (commonFunctionId === 1 && baseFunctionId === 5) {
    return {
      family: 'literal-a-with-common-ratio',
      status: 'applied',
      evaluator: 'q16.16-literal-a-times-g',
      applied: true,
    };
  }
  if (commonFunctionId === 1 && baseFunctionId === 11) {
    return {
      family: 'literal-a-direct',
      status: 'applied',
      evaluator: 'q16.16-direct-literal-a',
      applied: true,
    };
  }
  if (commonFunctionId === 1 && baseFunctionId === 2) {
    return {
      family: 'source-atk-ratio-heal',
      status: 'applied',
      evaluator: 'q16.16-source-atk-times-a-per-10000',
      applied: true,
    };
  }
  if (commonFunctionId === 1 && baseFunctionId === 104) {
    return {
      family: 'source-max-hp-ratio-heal',
      status: 'applied',
      evaluator: 'q16.16-source-max-hp-times-a-per-10000',
      applied: true,
    };
  }
  if (commonFunctionId === 1 && baseFunctionId === 3) {
    return {
      family: 'basis-point-property-a-with-common-ratio',
      status: 'applied',
      evaluator: 'q16.16-basis-point-a-times-g',
      applied: true,
    };
  }
  if (commonFunctionId === 1 && baseFunctionId === 2008) {
    return {
      family: 'source-tuning-ratio-with-common-ratio',
      status: 'applied',
      evaluator: 'q16.16-source-tuning-times-a-times-g',
      applied: true,
    };
  }
  if (VERIFIED_TUNING_FUNCTION_IDS.has(baseFunctionId)) {
    return {
      family: 'verified-tuning-state-formula',
      status: 'delegated',
      evaluator: 'verified-tuning-mark-runtime',
      applied: false,
    };
  }
  return {
    family: `unsupported-${commonFunctionId || 0}-${baseFunctionId || 0}`,
    status: 'unresolved',
    evaluator: null,
    applied: false,
  };
}

export function evaluateVerifiedBattleEffectFormula({
  effect = {},
  level = 1,
  sourceActor = null,
} = {}) {
  const contract = classifyVerifiedBattleEffectFormula(effect);
  const formulaIdentity =
    effect.formula?.formulaIdentity ??
    effect.formulaIdentity ??
    effect.sourceIdentity ??
    effect.sourceIdentities ??
    null;
  if (!contract.applied) {
    return {
      ...contract,
      value: null,
      raw: null,
      trace: [],
      formulaIdentity,
      sourceRawA: null,
      evaluatedValue: null,
      evaluatedRaw: null,
      reason:
        contract.status === 'delegated'
          ? 'formula-delegated-to-verified-tuning-runtime'
          : 'formula-family-not-verified-for-battle-effect-runtime',
    };
  }
  const params = resolveFormulaParams(effect, level);
  const a = finiteNumberOrNull(params?.[0]);
  const g = finiteNumberOrNull(params?.[6]);
  if (a == null || g == null) {
    return {
      ...contract,
      status: 'unresolved',
      applied: false,
      value: null,
      raw: null,
      trace: [],
      formulaIdentity,
      sourceRawA: a,
      evaluatedValue: null,
      evaluatedRaw: null,
      reason: 'formula-parameters-a-or-g-missing',
    };
  }
  if (contract.family === 'source-tuning-ratio-with-common-ratio') {
    const sourceTuning = finiteNumberOrNull(
      sourceActor?.stats?.tuningStrength
    );
    if (sourceTuning == null) {
      return {
        ...contract,
        status: 'unresolved',
        applied: false,
        value: null,
        raw: null,
        trace: [],
        reason: 'source-actor-tuning-strength-missing',
      };
    }
    const sourceRaw = qFromFloat(sourceTuning);
    const ratioRaw = qFromBasisPoints(a);
    const commonRaw = qFromBasisPoints(g);
    const resultRaw = qMul(qMul(sourceRaw, ratioRaw), commonRaw);
    const trace = [
      {
        step: 'source-actor-tuning-strength',
        input: sourceTuning,
        raw: sourceRaw.toString(),
      },
      {
        step: 'base-function-2008-a-per-10000',
        input: a,
        raw: ratioRaw.toString(),
      },
      {
        step: 'common-function-1-g-per-10000',
        input: g,
        raw: commonRaw.toString(),
      },
      { step: 'q16.16-multiply', raw: resultRaw.toString() },
    ];
    return {
      ...contract,
      value: qToNumber(resultRaw),
      raw: resultRaw.toString(),
      trace,
      q16Trace: trace,
      formulaIdentity,
      sourceRawA: a,
      evaluatedValue: qToNumber(resultRaw),
      evaluatedRaw: resultRaw.toString(),
      sourceIdentity:
        effect.sourceIdentity ?? effect.sourceIdentities ?? null,
      reason: null,
    };
  }
  if (contract.family === 'source-atk-ratio-heal') {
    const attack = finiteNumberOrNull(sourceActor?.stats?.attack);
    if (attack == null) {
      return {
        ...contract,
        status: 'unresolved',
        applied: false,
        value: null,
        raw: null,
        trace: [],
        formulaIdentity,
        sourceRawA: a,
        evaluatedValue: null,
        evaluatedRaw: null,
        reason: 'source-actor-attack-missing',
      };
    }
    const attackRaw = qFromFloat(attack);
    const ratioRaw = qFromBasisPoints(a);
    const commonRaw = qFromBasisPoints(g);
    const resultRaw = qMul(qMul(attackRaw, ratioRaw), commonRaw);
    const trace = [
      {
        step: 'source-actor-attack',
        input: attack,
        raw: attackRaw.toString(),
      },
      {
        step: 'base-function-2-a-per-10000',
        input: a,
        raw: ratioRaw.toString(),
      },
      {
        step: 'common-function-1-g-per-10000',
        input: g,
        raw: commonRaw.toString(),
      },
      { step: 'q16.16-multiply', raw: resultRaw.toString() },
    ];
    return {
      ...contract,
      value: qToNumber(resultRaw),
      raw: resultRaw.toString(),
      trace,
      q16Trace: trace,
      formulaIdentity,
      sourceRawA: a,
      evaluatedValue: qToNumber(resultRaw),
      evaluatedRaw: resultRaw.toString(),
      sourceIdentity:
        effect.sourceIdentity ?? effect.sourceIdentities ?? null,
      reason: null,
    };
  }
  if (contract.family === 'source-max-hp-ratio-heal') {
    const sourceMaximumHp = finiteNumberOrNull(sourceActor?.stats?.maxHp);
    if (sourceMaximumHp == null) {
      return {
        ...contract,
        status: 'unresolved',
        applied: false,
        value: null,
        raw: null,
        trace: [],
        formulaIdentity,
        sourceRawA: a,
        evaluatedValue: null,
        evaluatedRaw: null,
        reason: 'source-actor-maximum-hp-missing',
      };
    }
    const sourceRaw = qFromFloat(sourceMaximumHp);
    const ratioRaw = qFromBasisPoints(a);
    const commonRaw = qFromBasisPoints(g);
    const resultRaw = qMul(qMul(sourceRaw, ratioRaw), commonRaw);
    const trace = [
      {
        step: 'source-actor-maximum-hp',
        input: sourceMaximumHp,
        raw: sourceRaw.toString(),
      },
      {
        step: 'base-function-104-a-per-10000',
        input: a,
        raw: ratioRaw.toString(),
      },
      {
        step: 'common-function-1-g-per-10000',
        input: g,
        raw: commonRaw.toString(),
      },
      { step: 'q16.16-multiply', raw: resultRaw.toString() },
    ];
    return {
      ...contract,
      value: qToNumber(resultRaw),
      raw: resultRaw.toString(),
      trace,
      q16Trace: trace,
      formulaIdentity,
      sourceRawA: a,
      sourceMaximumHp,
      evaluatedValue: qToNumber(resultRaw),
      evaluatedRaw: resultRaw.toString(),
      sourceIdentity:
        effect.sourceIdentity ?? effect.sourceIdentities ?? null,
      reason: null,
    };
  }
  const commonRaw = qFromBasisPoints(g);
  const sourceBaseRaw = qFromFloat(a);
  const evaluatedBaseRaw =
    contract.family === 'basis-point-property-a-with-common-ratio'
      ? qFromSourceBasisPoints(a)
      : sourceBaseRaw;
  const evaluatedResultRaw = qMul(evaluatedBaseRaw, commonRaw);
  const outputUsesEvaluatedValue =
    contract.family === 'basis-point-property-a-with-common-ratio' &&
    (resolveEffectPropertyBucket(effect) === 'dynamicExtra' ||
      // 直接回能/治疗/护盾（500368/500369/500370 等）：valueByLevel 为
      // 基点（Lv1=31000 → 3.1 SP），必须换算后输出，否则 runtime 会把
      // 31000 当绝对 SP 注入导致溢出。注意字段可能是 false 占位，
      // 必须用真值判断（false != null 会误判）。
      Boolean(effect.directSp) ||
      Boolean(effect.heal) ||
      Boolean(effect.shield));
  const outputRaw = outputUsesEvaluatedValue
    ? evaluatedResultRaw
    : qMul(sourceBaseRaw, commonRaw);
  const trace = [
    {
      step:
        contract.family ===
        'basis-point-property-a-with-common-ratio'
          ? 'base-function-3-a-per-10000'
          : contract.family === 'literal-a-direct'
            ? 'base-function-11-a'
            : 'base-function-5-a',
      input: a,
      raw: evaluatedBaseRaw.toString(),
      sourceRaw: sourceBaseRaw.toString(),
    },
    {
      step: 'common-function-1-g-per-10000',
      input: g,
      raw: commonRaw.toString(),
    },
    {
      step: 'q16.16-multiply',
      raw: evaluatedResultRaw.toString(),
      outputRaw: outputRaw.toString(),
    },
  ];
  return {
    ...contract,
    value: qToNumber(outputRaw),
    raw: outputRaw.toString(),
    trace,
    q16Trace: trace,
    formulaIdentity,
    sourceRawA: a,
    evaluatedValue: qToNumber(evaluatedResultRaw),
    evaluatedRaw: evaluatedResultRaw.toString(),
    sourceIdentity: effect.sourceIdentity ?? effect.sourceIdentities ?? null,
    reason: null,
  };
}

function resolveEffectPropertyBucket(effect) {
  return effect?.property?.bucket ?? effect?.bucket ?? null;
}

function qFromSourceBasisPoints(value) {
  return Number.isInteger(value)
    ? qFromBasisPoints(value)
    : qFromFloat(value / 10_000);
}

function resolveFormulaParams(effect, level) {
  const normalizedLevel = Math.min(
    12,
    Math.max(1, Math.trunc(Number(level) || 1))
  );
  const params =
    effect.formula?.paramsByLevel?.[normalizedLevel] ??
    effect.formula?.paramsByLevel?.[String(normalizedLevel)];
  if (Array.isArray(params)) return params;
  const setIndex =
    effect.formula?.levelParameterSetIndices?.[normalizedLevel - 1];
  const parameterSet = effect.formula?.parameterSets?.[setIndex];
  if (Array.isArray(parameterSet)) return parameterSet;
  const fallback =
    effect.propertyChange?.valueByLevel?.[normalizedLevel] ??
    effect.directSp?.valueByLevel?.[normalizedLevel] ??
    effect.heal?.valueByLevel?.[normalizedLevel] ??
    effect.shield?.valueByLevel?.[normalizedLevel] ??
    effect.cooldownReduction?.valueByLevel?.[normalizedLevel];
  return fallback == null ? null : [fallback, 0, 0, 0, 0, 0, 10_000];
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
