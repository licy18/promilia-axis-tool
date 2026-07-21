export function createVerifiedActionMechanicsTrace({
  action = null,
  scenario = null,
  verifiedCombatRuntime = null,
} = {}) {
  if (!action || !verifiedCombatRuntime?.enabled) return null;
  const resolution = resolveActionResolution(verifiedCombatRuntime, action.id);
  const actor = (scenario?.actors ?? []).find(
    item => item.id === action.actorId
  );
  const hitEvents = (verifiedCombatRuntime.damageEvents ?? []).filter(
    event =>
      event.actionId === action.id && event.type === 'VERIFIED_COMBAT_HIT'
  );
  const resourceEvents = [
    ...(verifiedCombatRuntime.resourceEvents ?? []),
    ...(verifiedCombatRuntime.kiboResourceEvents ?? []),
  ].filter(event => event.actionId === action.id);
  const effectEvents = (
    verifiedCombatRuntime.effectTimeline?.events ?? []
  ).filter(event => event.actionId === action.id);
  const tuningEvents = (
    verifiedCombatRuntime.tuningMarkRuntime?.events ?? []
  ).filter(event => event.actionId === action.id);
  const dynamicPropertyRows = collectDynamicPropertyRows(hitEvents);
  const staticProperties = actor?.verifiedStaticProperties ?? null;
  const staticKiboProperties = actor?.verifiedStaticKiboProperties ?? null;
  const sourceRows = createSourceRows({
    resolution,
    hitEvents,
    effectEvents,
    tuningEvents,
    staticProperties,
    staticKiboProperties,
  });
  const unresolved = uniqueValues([
    ...(resolution?.reasons ?? []).map(normalizeReason),
    ...(verifiedCombatRuntime.tuningMarkRuntime?.unresolved ?? [])
      .filter(issue => issue.actionId === action.id)
      .map(issue => normalizeReason(issue.status ?? issue.kind)),
  ]);
  const status = resolveTraceStatus({ resolution, unresolved });
  const hpDamage = sumNumbers(hitEvents.map(event => event.payload?.rawDamage));
  const toughnessDamage = sumNumbers(
    hitEvents.map(event => event.payload?.toughnessDamage)
  );
  const resourceDelta = sumNumbers(
    resourceEvents.map(event => event.payload?.change)
  );

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-workbench-verified-action-mechanics-trace',
    status,
    statusLabel: traceStatusLabel(status),
    actionId: action.id,
    actionName: action.name,
    packageId: resolution?.packageId ?? verifiedCombatRuntime.packageId ?? '',
    packageHash:
      resolution?.packageHash ?? verifiedCombatRuntime.packageHash ?? '',
    bindingIdentity: resolution?.actionBinding?.identity ?? '',
    controlSkillId: resolution?.actionBinding?.controlSkillId ?? null,
    hitBindingCount: resolution?.hits?.length ?? 0,
    effectBindingCount: resolution?.effects?.length ?? 0,
    runtimeHitCount: hitEvents.length,
    runtimeEffectEventCount: effectEvents.length,
    runtimeTuningEventCount: tuningEvents.length,
    dynamicPropertyCount: dynamicPropertyRows.length,
    hitEvents,
    resourceEvents,
    effectEvents,
    tuningEvents,
    dynamicPropertyRows,
    sourceRows,
    unresolved,
    steps: [
      {
        key: 'action-binding',
        label: '动作',
        value: resolution?.ready
          ? `control ${resolution.actionBinding?.controlSkillId ?? '待确认'}`
          : '绑定未完成',
        detail: resolution?.status ?? 'runtime-resolution-missing',
        applied: resolution?.ready === true,
      },
      {
        key: 'effects',
        label: '效果',
        value: `${resolution?.effects?.length ?? 0} 个绑定`,
        detail: `${effectEvents.length} 个生命周期事件`,
        applied: effectEvents.some(event => event.appliedToCalculators),
      },
      {
        key: 'property-snapshot',
        label: '属性快照',
        value: formatPropertySnapshot(hitEvents, action),
        detail: `${dynamicPropertyRows.length} 条动态属性来源`,
        applied: hitEvents.length > 0,
      },
      {
        key: 'hit-results',
        label: '命中结果',
        value: `${hitEvents.length} 个命中`,
        detail: `HP -${formatNumber(hpDamage)} · 韧性 -${formatNumber(
          toughnessDamage
        )} · SP ${formatSigned(resourceDelta)}`,
        applied: hitEvents.length > 0 || resourceEvents.length > 0,
      },
      {
        key: 'runtime-state',
        label: '状态',
        value: `Buff ${effectEvents.length} · 印记 ${tuningEvents.length}`,
        detail: formatStateKinds(effectEvents, tuningEvents),
        applied: effectEvents.length > 0 || tuningEvents.length > 0,
      },
    ],
  };
}

function resolveActionResolution(runtime, actionId) {
  if (runtime.actionResolutionById?.get) {
    return runtime.actionResolutionById.get(actionId) ?? null;
  }
  return (
    (runtime.actionResolutions ?? []).find(
      resolution => resolution?.actionBinding?.actionId === actionId
    ) ?? null
  );
}

function collectDynamicPropertyRows(hitEvents) {
  const rows = hitEvents.flatMap(event => [
    ...(event.payload?.dynamicPropertyTrace?.source ?? []),
    ...(event.payload?.dynamicPropertyTrace?.target ?? []),
  ]);
  const unique = new Map();
  for (const row of rows) {
    const key = [
      row.attributeId,
      row.baseRaw,
      row.dynamicPercentRaw,
      row.dynamicExtraRaw,
      row.dynamicForceRaw,
      row.value,
    ].join('|');
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()];
}

function createSourceRows({
  resolution,
  hitEvents,
  effectEvents,
  tuningEvents,
  staticProperties,
  staticKiboProperties,
}) {
  const rows = [
    createSourceRow('动作绑定', resolution?.actionBinding?.identity),
    createSourceRow('角色装配', staticProperties?.sourceIdentity),
    createSourceRow('奇波继承', staticKiboProperties?.sourceIdentity),
    ...hitEvents.map((event, index) =>
      createSourceRow(`命中 ${index + 1}`, {
        bindingIdentity: event.payload?.bindingIdentity,
        attackSource: event.payload?.attackSource,
        enemyProfileSourceIdentity: event.payload?.enemyProfileSourceIdentity,
      })
    ),
    ...effectEvents.map((event, index) =>
      createSourceRow(`Buff ${index + 1}`, event.sourceIdentity)
    ),
    ...tuningEvents.map((event, index) =>
      createSourceRow(`印记 ${index + 1}`, event.sourceIdentity)
    ),
  ].filter(Boolean);
  const seen = new Set();
  return rows.filter(row => {
    const key = `${row.label}|${row.identity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createSourceRow(label, value) {
  if (value == null || value === '') return null;
  return { label, identity: formatSourceIdentity(value) };
}

function formatSourceIdentity(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(formatSourceIdentity).filter(Boolean).join(' · ');
  }
  if (typeof value !== 'object') return String(value);
  return Object.entries(value)
    .filter(([, item]) => item != null && item !== '')
    .map(([key, item]) => `${key}=${formatSourceIdentity(item)}`)
    .join(' · ');
}

function resolveTraceStatus({ resolution, unresolved }) {
  if (!resolution) return 'unresolved';
  if (!resolution.ready || resolution.applied === false) return 'unresolved';
  if (resolution.complete === false || unresolved.length > 0) {
    return 'partial';
  }
  return 'applied';
}

function traceStatusLabel(status) {
  if (status === 'applied') return '已验证';
  if (status === 'partial') return '部分应用';
  return '未解析';
}

function formatPropertySnapshot(hitEvents, action) {
  const attackValues = uniqueValues(
    hitEvents
      .map(event => Number(event.payload?.attack))
      .filter(Number.isFinite)
  );
  if (attackValues.length === 0) {
    return action.type === 'skill' || action.type === 'kiboEvent'
      ? '等待可执行命中'
      : '无战斗属性快照';
  }
  return `ATK ${attackValues.map(formatNumber).join(' / ')}`;
}

function formatStateKinds(effectEvents, tuningEvents) {
  const kinds = uniqueValues([
    ...effectEvents.map(event => event.operation ?? event.eventType),
    ...tuningEvents.map(event => event.kind),
  ]);
  return kinds.length > 0 ? kinds.join(' · ') : '本动作无状态变化';
}

function normalizeReason(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return value.reason ?? value.code ?? value.status ?? JSON.stringify(value);
  }
  return String(value ?? 'unresolved');
}

function sumNumbers(values) {
  return values.reduce((sum, value) => {
    const number = Number(value);
    return Number.isFinite(number) ? sum + number : sum;
  }, 0);
}

function formatNumber(value) {
  return Number(Number(value || 0).toFixed(4)).toLocaleString('zh-CN', {
    maximumFractionDigits: 4,
  });
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${formatNumber(number)}`;
}

function uniqueValues(values) {
  return [...new Set(values.filter(value => value != null && value !== ''))];
}
