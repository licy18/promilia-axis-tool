const THREE_VALUE_DELTA_FIELD_BY_TRACK_KEY = {
  enemyHpDamage: 'hpDelta',
  enemyToughnessDamage: 'toughnessDelta',
  selfEnergyChange: 'energyDelta',
};

export const THREE_VALUE_CALCULATOR_DEFINITIONS = {
  enemyHpDamage: {
    key: 'azpr-hp-delta-calculator',
    version: 3,
    outputField: 'hpDelta',
    valueUnit: 'raw-damage',
    contractStatus: 'raw-preview-until-final-hp-formula-confirmed',
    kindByLayer: {
      applied: 'raw-result-preview',
      candidate: 'damage-element-candidate-preview',
      sampled: 'runtime-sample-preview',
      placeholder: 'placeholder',
    },
    defaultStatusByLayer: {
      applied: 'raw-hp-projection-applied-final-azpr-formula-unconfirmed',
      candidate: 'formula-candidate-preview-unapplied',
      sampled: 'runtime-sample-hp-delta-unconfirmed',
      placeholder: 'hp-delta-placeholder-waiting-confirmed-formula',
    },
  },
  enemyToughnessDamage: {
    key: 'azpr-toughness-delta-calculator',
    version: 3,
    outputField: 'toughnessDelta',
    valueUnit: 'raw-field',
    contractStatus:
      'weak-break-preview-until-final-toughness-formula-confirmed',
    kindByLayer: {
      applied: 'weak-break-result-preview',
      candidate: 'weak-break-field-candidate-preview',
      sampled: 'runtime-sample-preview',
      placeholder: 'placeholder',
    },
    defaultStatusByLayer: {
      applied: 'zero-placeholder-until-toughness-formula-confirmed',
      candidate: 'weak-break-field-candidate-unapplied',
      sampled: 'runtime-sample-toughness-delta-unconfirmed',
      placeholder: 'toughness-delta-placeholder-waiting-confirmed-formula',
    },
  },
  selfEnergyChange: {
    key: 'azpr-self-energy-delta-calculator',
    version: 3,
    outputField: 'energyDelta',
    valueUnit: 'sp',
    contractStatus:
      'resource-preview-until-final-self-energy-formula-confirmed',
    kindByLayer: {
      applied: 'explicit-resource-event-or-cost-preview',
      candidate: 'recover-sp-candidate-preview',
      sampled: 'recover-sp-runtime-sample',
      placeholder: 'placeholder',
    },
    defaultStatusByLayer: {
      applied: 'resource-delta-applied-recover-sp-candidate-unapplied',
      candidate: 'recover-sp-runtime-probe-candidate-unapplied',
      sampled: 'recover-sp-runtime-sample-unapplied',
      placeholder: 'self-energy-placeholder-waiting-confirmed-formula',
    },
  },
};

export function getThreeValueCalculatorKeys() {
  return Object.values(THREE_VALUE_CALCULATOR_DEFINITIONS).map(
    calculator => calculator.key
  );
}

export function createThreeValueCalculatorResult({
  trackKey,
  layerKey,
  point,
  layer,
  delta,
  deltaFields,
  sourceKind,
  sourceIds,
  confidence,
  sourceStatus,
  resultStatus,
  applied,
  mechanismContext,
}) {
  const definition =
    THREE_VALUE_CALCULATOR_DEFINITIONS[trackKey] ??
    createFallbackThreeValueCalculatorDefinition(trackKey);
  const status =
    point.calculationStatus ??
    resultStatus ??
    sourceStatus ??
    definition.defaultStatusByLayer?.[layerKey] ??
    definition.contractStatus;
  const kind =
    point.calculationKind ??
    definition.kindByLayer?.[layerKey] ??
    `${layerKey ?? 'unknown'}-calculator`;

  return {
    key: definition.key,
    version: definition.version,
    trackKey,
    outputField: definition.outputField,
    kind,
    status,
    delta,
    deltaFieldValue: deltaFields[definition.outputField] ?? null,
    valueUnit: layer.valueUnit ?? definition.valueUnit,
    sourceKind,
    sourceIds,
    confidence,
    mechanismContext,
    mechanismContextStatus: mechanismContext?.status ?? null,
    mechanismContextReady: mechanismContext?.ready === true,
    mechanismConfigurationStatus:
      mechanismContext?.configuration?.status ?? null,
    mechanismConfigurationReady:
      mechanismContext?.configuration?.ready === true,
    mechanismConfigurationSourceKind:
      mechanismContext?.configuration?.sourceKind ?? null,
    configurationInstanceIds: uniqueStrings([
      mechanismContext?.configuration?.sourceActor?.configurationInstanceId,
      mechanismContext?.configuration?.targetEnemy?.configurationInstanceId,
    ]),
    replaceable: isThreeValueCalculatorOutputReplaceable(status),
    appliedToRuntime: applied,
    unresolved: createThreeValueCalculatorUnresolved(trackKey, status),
  };
}

export function summarizeThreeValueCalculators(deltas) {
  const records = (deltas ?? [])
    .map(delta => ({
      delta,
      calculator: delta?.calculator,
    }))
    .filter(record => record.calculator?.key);
  const calculators = records.map(record => record.calculator);
  const calculatorKeys = uniqueStrings(calculators.map(item => item.key));
  return {
    contractName: 'ThreeValueDeltaCalculator',
    contractVersion: 3,
    outputCount: records.length,
    calculatorCount: calculatorKeys.length,
    calculatorKeys,
    calculatorReplaceableDeltaCount: calculators.filter(
      calculator => calculator.replaceable
    ).length,
    statuses: uniqueStrings(calculators.map(item => item.status)),
    outputFields: uniqueStrings(calculators.map(item => item.outputField)),
    confidenceLevels: uniqueStrings(calculators.map(item => item.confidence)),
    appliedToRuntimeCount: calculators.filter(item => item.appliedToRuntime)
      .length,
    mechanismContextReadyCount: calculators.filter(
      item => item.mechanismContextReady
    ).length,
    mechanismContextMissingCount: calculators.filter(
      item => !item.mechanismContextReady
    ).length,
    mechanismContextStatuses: uniqueStrings(
      calculators.map(item => item.mechanismContextStatus)
    ),
    mechanismConfigurationReadyCount: calculators.filter(
      item => item.mechanismConfigurationReady
    ).length,
    mechanismConfigurationMissingCount: calculators.filter(
      item => !item.mechanismConfigurationReady
    ).length,
    mechanismConfigurationStatuses: uniqueStrings(
      calculators.map(item => item.mechanismConfigurationStatus)
    ),
    mechanismConfigurationSourceKinds: uniqueStrings(
      calculators.map(item => item.mechanismConfigurationSourceKind)
    ),
    configurationInstanceIds: uniqueStrings(
      calculators.flatMap(item => item.configurationInstanceIds ?? [])
    ),
    calculatorKeyCounts: countCalculatorRecordsBy(records, {
      keyField: 'key',
      valueName: 'key',
      decorate: (items, key) => ({
        trackKeys: uniqueStrings(items.map(item => item.calculator.trackKey)),
        kinds: uniqueStrings(items.map(item => item.calculator.kind)),
        statuses: uniqueStrings(items.map(item => item.calculator.status)),
        outputFields: uniqueStrings(
          items.map(item => item.calculator.outputField)
        ),
        unresolvedItems: uniqueStrings(
          items.flatMap(item => item.calculator.unresolved ?? [])
        ),
        replaceableCount: items.filter(item => item.calculator.replaceable)
          .length,
        appliedToRuntimeCount: items.filter(
          item => item.calculator.appliedToRuntime
        ).length,
        key,
      }),
    }),
    kindCounts: countCalculatorRecordsBy(records, {
      keyField: 'kind',
      valueName: 'kind',
    }),
    statusCounts: countCalculatorRecordsBy(records, {
      keyField: 'status',
      valueName: 'status',
    }),
    unresolvedItemCounts: countCalculatorUnresolvedItems(records),
    layerCounts: countCalculatorRecordsBy(records, {
      keyGetter: item => item.delta.layerKey,
      valueName: 'layerKey',
    }),
    trackCounts: countCalculatorRecordsBy(records, {
      keyGetter: item => item.delta.trackKey,
      valueName: 'trackKey',
    }),
  };
}

export function createThreeValueCalculatorDisplayRows(point, simLogRow) {
  const runtimePoint = point ?? {};
  const logRow = simLogRow ?? {};
  const calculator = runtimePoint.calculator ?? logRow.calculator ?? null;
  const calculatorKey =
    runtimePoint.calculatorKey ??
    calculator?.key ??
    logRow.calculatorKey ??
    logRow.calculator?.key ??
    null;
  const kind =
    runtimePoint.calculationKind ??
    calculator?.kind ??
    logRow.calculationKind ??
    logRow.calculator?.kind ??
    null;
  const status =
    runtimePoint.calculationStatus ??
    calculator?.status ??
    logRow.calculationStatus ??
    logRow.calculator?.status ??
    null;
  const replaceable =
    runtimePoint.calculationReplaceable ??
    calculator?.replaceable ??
    logRow.calculationReplaceable ??
    logRow.calculator?.replaceable ??
    null;
  const unresolved = normalizeList(calculator?.unresolved);

  return [
    {
      key: 'calculator',
      label: '适配器',
      value: formatThreeValueCalculatorKey(
        calculatorKey,
        runtimePoint.trackKey
      ),
      rawValue: calculatorKey,
    },
    {
      key: 'kind',
      label: '来源',
      value: formatThreeValueCalculationKind(kind, runtimePoint.trackKey),
      rawValue: kind,
    },
    {
      key: 'replaceable',
      label: '替换',
      value: replaceable === false ? '已固定' : '可替换',
      rawValue: replaceable,
    },
    {
      key: 'status',
      label: '公式',
      value: formatThreeValueCalculationStatus(status),
      rawValue: status,
    },
    {
      key: 'unresolved',
      label: '缺口',
      value: formatThreeValueUnresolvedItems(unresolved),
      rawValue: unresolved,
    },
  ];
}

export function formatThreeValueCalculatorKey(calculatorKey, trackKey) {
  if (calculatorKey === 'azpr-hp-delta-calculator') {
    return 'HP适配器';
  }
  if (calculatorKey === 'azpr-toughness-delta-calculator') {
    return '削韧适配器';
  }
  if (calculatorKey === 'azpr-self-energy-delta-calculator') {
    return '能量适配器';
  }
  if (trackKey === 'enemyHpDamage') {
    return 'HP适配器';
  }
  if (trackKey === 'enemyToughnessDamage') {
    return '削韧适配器';
  }
  if (trackKey === 'selfEnergyChange') {
    return '能量适配器';
  }
  return calculatorKey ?? '未知适配器';
}

export function formatThreeValueCalculationKind(kind, trackKey) {
  if (kind === 'recover-sp-runtime-sample-confirmed') {
    return '能量实测';
  }
  if (kind === 'toughness-runtime-sample-confirmed') {
    return '削韧实测';
  }
  if (kind === 'raw-result-preview') {
    return 'HP预览';
  }
  if (kind === 'damage-element-candidate-preview') {
    return 'HP候选';
  }
  if (kind === 'weak-break-result-preview') {
    return '削韧预览';
  }
  if (kind === 'weak-break-field-candidate-preview') {
    return '削韧候选';
  }
  if (kind === 'explicit-resource-event-or-cost-preview') {
    return '能量事件';
  }
  if (kind === 'recover-sp-candidate-preview') {
    return '能量候选';
  }
  if (kind === 'recover-sp-runtime-sample') {
    return '能量采样';
  }
  if (kind === 'placeholder') {
    return '占位';
  }
  if (trackKey === 'enemyHpDamage') {
    return 'HP预览';
  }
  if (trackKey === 'enemyToughnessDamage') {
    return '削韧候选';
  }
  if (trackKey === 'selfEnergyChange') {
    return '能量候选';
  }
  return kind ?? '未知来源';
}

export function formatThreeValueCalculationStatus(status) {
  if (!status) {
    return '待确认';
  }
  if (String(status).includes('runtime-final-confirmed')) {
    return '采样已应用';
  }
  if (String(status).includes('raw-hp-projection')) {
    return '公式未确认';
  }
  if (String(status).includes('explicit-cost-applied')) {
    return '消耗已应用';
  }
  if (String(status).includes('recover-sp-runtime-sample')) {
    return '采样未应用';
  }
  if (String(status).includes('recover-sp')) {
    return '充能未确认';
  }
  if (String(status).includes('toughness')) {
    return '削韧未确认';
  }
  if (String(status).includes('placeholder')) {
    return '占位待确认';
  }
  if (String(status).includes('candidate')) {
    return '候选未确认';
  }
  return status;
}

export function formatThreeValueUnresolvedItems(items) {
  const mapped = normalizeList(items).map(formatUnresolvedItem).filter(Boolean);
  return mapped.length > 0 ? mapped.join('、') : '无';
}

function createFallbackThreeValueCalculatorDefinition(trackKey) {
  return {
    key: `unknown-${trackKey ?? 'track'}-delta-calculator`,
    version: 1,
    outputField: THREE_VALUE_DELTA_FIELD_BY_TRACK_KEY[trackKey] ?? 'delta',
    valueUnit: 'unknown',
    contractStatus: 'calculator-contract-missing',
    kindByLayer: {},
    defaultStatusByLayer: {},
  };
}

function isThreeValueCalculatorOutputReplaceable(status) {
  const statusText = String(status ?? '');
  return ![
    'final-formula-confirmed',
    'runtime-final-confirmed',
    'non-replaceable',
  ].some(marker => statusText.includes(marker));
}

function createThreeValueCalculatorUnresolved(trackKey, status) {
  if (String(status ?? '').includes('runtime-final-confirmed')) {
    return [];
  }
  const common = ['final-azpr-formula-confirmation'];
  if (trackKey === 'enemyHpDamage') {
    return uniqueStrings([
      ...common,
      'enemy-defense-resistance-critical-order',
      'hit-to-damage-element-binding',
    ]);
  }
  if (trackKey === 'enemyToughnessDamage') {
    return uniqueStrings([
      ...common,
      'weak-break-damage-rate-unit-scale',
      'target-toughness-state-baseline',
    ]);
  }
  if (trackKey === 'selfEnergyChange') {
    return uniqueStrings([
      ...common,
      'initial-current-sp-baseline',
      'recover-sp-owner-share-and-throttle',
    ]);
  }
  return uniqueStrings([...common, status]);
}

function formatUnresolvedItem(item) {
  const key = String(item ?? '');
  if (key === 'final-azpr-formula-confirmation') {
    return '最终公式';
  }
  if (key === 'enemy-defense-resistance-critical-order') {
    return '防御抗性顺序';
  }
  if (key === 'hit-to-damage-element-binding') {
    return '命中绑定';
  }
  if (key === 'weak-break-damage-rate-unit-scale') {
    return '削韧倍率单位';
  }
  if (key === 'target-toughness-state-baseline') {
    return '韧性基线';
  }
  if (key === 'initial-current-sp-baseline') {
    return '初始能量';
  }
  if (key === 'recover-sp-owner-share-and-throttle') {
    return '能量归属/共享';
  }
  return key;
}

function normalizeList(values) {
  return Array.isArray(values) ? values.filter(value => value != null) : [];
}

function countCalculatorRecordsBy(
  records,
  { keyField, keyGetter, valueName, decorate }
) {
  const groups = new Map();
  for (const record of records) {
    const key = keyGetter
      ? keyGetter(record)
      : (record.calculator?.[keyField] ?? null);
    if (key == null || String(key).trim() === '') {
      continue;
    }
    const normalizedKey = String(key);
    if (!groups.has(normalizedKey)) {
      groups.set(normalizedKey, []);
    }
    groups.get(normalizedKey).push(record);
  }

  return [...groups.entries()]
    .map(([key, items]) => ({
      [valueName]: key,
      count: items.length,
      ...(decorate ? decorate(items, key) : {}),
    }))
    .sort(compareCountRows);
}

function countCalculatorUnresolvedItems(records) {
  const rows = countCalculatorRecordsBy(
    records.flatMap(record =>
      (record.calculator.unresolved ?? []).map(item => ({
        ...record,
        unresolvedItem: item,
      }))
    ),
    {
      keyGetter: item => item.unresolvedItem,
      valueName: 'item',
    }
  );
  return rows;
}

function compareCountRows(left, right) {
  const countOrder = right.count - left.count;
  if (countOrder !== 0) {
    return countOrder;
  }
  return getCountRowSortKey(left).localeCompare(getCountRowSortKey(right));
}

function getCountRowSortKey(row) {
  if (row.item) {
    return `${getUnresolvedSortOrder(row.item)}:${row.item}`;
  }
  return String(
    row.key ?? row.kind ?? row.status ?? row.layerKey ?? row.trackKey ?? ''
  );
}

function getUnresolvedSortOrder(item) {
  const order = [
    'final-azpr-formula-confirmation',
    'enemy-defense-resistance-critical-order',
    'hit-to-damage-element-binding',
    'weak-break-damage-rate-unit-scale',
    'target-toughness-state-baseline',
    'initial-current-sp-baseline',
    'recover-sp-owner-share-and-throttle',
  ].indexOf(String(item ?? ''));
  return order >= 0 ? String(order).padStart(2, '0') : '99';
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .filter(value => value != null && String(value).trim() !== '')
        .map(value => String(value))
    ),
  ];
}
