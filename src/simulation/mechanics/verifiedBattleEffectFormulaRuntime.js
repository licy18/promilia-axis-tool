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
} = {}) {
  const contract = classifyVerifiedBattleEffectFormula(effect);
  if (!contract.applied) {
    return {
      ...contract,
      value: null,
      raw: null,
      trace: [],
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
      reason: 'formula-parameters-a-or-g-missing',
    };
  }
  const baseRaw = qFromFloat(a);
  const commonRaw = qFromBasisPoints(g);
  const resultRaw = qMul(baseRaw, commonRaw);
  return {
    ...contract,
    value: qToNumber(resultRaw),
    raw: resultRaw.toString(),
    trace: [
      { step: 'base-function-5-a', input: a, raw: baseRaw.toString() },
      {
        step: 'common-function-1-g-per-10000',
        input: g,
        raw: commonRaw.toString(),
      },
      { step: 'q16.16-multiply', raw: resultRaw.toString() },
    ],
    sourceIdentity: effect.sourceIdentity ?? effect.sourceIdentities ?? null,
    reason: null,
  };
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
    effect.shield?.valueByLevel?.[normalizedLevel];
  return fallback == null ? null : [fallback, 0, 0, 0, 0, 0, 10_000];
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
