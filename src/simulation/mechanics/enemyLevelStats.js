export const ENEMY_LEVEL_SCALED_STAT_KEYS = Object.freeze({
  ATK: 'attack',
  MAXHP: 'maxHp',
  DEF: 'physicalDefense',
  MDEF: 'magicalDefense',
  WEAKNESS_POINT_MAX: 'maxToughness',
});

export function resolveEnemyLevelStats({
  enemy,
  sourceEnemy,
  profiles = [],
} = {}) {
  const level = Number(enemy?.level);
  const reference = sourceEnemy?.levelProfile ?? null;
  const baseAttributes = indexAttributes(
    sourceEnemy?.property?.baseAttributes ?? enemy?.baseAttributes
  );
  const rawTemplateStats = mapStats(
    baseAttributes,
    attribute => attribute.value
  );
  const source = createSource(reference, level);

  if (!reference || reference.status !== 'ready') {
    return pendingResolution(
      reference?.status ?? 'missing-enemy-level-profile-reference',
      source,
      rawTemplateStats
    );
  }
  if (!Number.isInteger(level) || level < 1) {
    return pendingResolution('invalid-enemy-level', source, rawTemplateStats);
  }

  const profile = profiles.find(item =>
    reference.profileId
      ? item?.profileId === reference.profileId
      : Number(item?.templateId) === Number(reference.templateId)
  );
  if (!profile) {
    return pendingResolution(
      'missing-enemy-level-profile',
      source,
      rawTemplateStats
    );
  }
  const levelRow = profile.levels?.find(row => Number(row.level) === level);
  if (!levelRow) {
    return pendingResolution(
      'missing-enemy-level-row',
      {
        ...source,
        supportedLevels: [...(profile.supportedLevels ?? [])],
      },
      rawTemplateStats
    );
  }
  const coefficientByKey = new Map(
    (profile.attributeDefinitions ?? []).map((definition, index) => [
      definition.key,
      {
        value: levelRow.coefficients?.[index],
        divisor: definition.divisor,
      },
    ])
  );

  const attributes = Object.fromEntries(
    [...baseAttributes.entries()].map(([key, attribute]) => {
      const coefficient = coefficientByKey.get(key) ?? null;
      if (!Number.isFinite(coefficient?.value)) {
        return [
          key,
          {
            ...attribute,
            coefficient: null,
            divisor: null,
            effectiveValue: null,
            status: 'missing-level-coefficient',
          },
        ];
      }
      const effectiveValue =
        (Number(attribute.value) * Number(coefficient.value)) /
        Number(coefficient.divisor);
      return [
        key,
        {
          ...attribute,
          coefficient: Number(coefficient.value),
          divisor: Number(coefficient.divisor),
          effectiveValue,
          status: Number.isFinite(effectiveValue)
            ? 'client-level-growth-applied'
            : 'invalid-level-growth-result',
        },
      ];
    })
  );
  const requiredStatuses = Object.keys(ENEMY_LEVEL_SCALED_STAT_KEYS).map(
    key => attributes[key]?.status
  );
  const status = requiredStatuses.every(
    item => item === 'client-level-growth-applied'
  )
    ? 'ready'
    : 'missing-required-level-coefficient';

  return {
    schemaVersion: 1,
    status,
    applied: status === 'ready',
    level,
    rawTemplateStats,
    stats: mapStats(
      new Map(Object.entries(attributes)),
      attribute => attribute.effectiveValue
    ),
    attributes,
    source: {
      ...source,
      profileId: profile.profileId,
      templateId: profile.templateId,
      templateValueId: levelRow.templateValueId,
      supportedLevels: [...(profile.supportedLevels ?? [])],
      coefficientApplication:
        'base template value * level coefficient / client divisor',
      sceneAttributeScaleStatus: 'not-configured-in-workbench',
    },
  };
}

function pendingResolution(status, source, rawTemplateStats) {
  return {
    schemaVersion: 1,
    status,
    applied: false,
    level: source.level,
    rawTemplateStats,
    stats: nullStats(),
    attributes: {},
    source,
  };
}

function createSource(reference, level) {
  return {
    kind: 'azpr-client-enemy-level-profile',
    status: reference?.status ?? 'missing-enemy-level-profile-reference',
    level,
    enemyPackId: reference?.enemyPackId ?? null,
    levelPolicy: reference?.levelPolicy ?? null,
    levelParameter: reference?.levelParameter ?? null,
    templateId: reference?.templateId ?? null,
    templateIdSource: reference?.templateIdSource ?? null,
    profileId: reference?.profileId ?? null,
    targetLevelFormulaStatus: 'separate-damage-formula-input',
    targetLevelAppliedToStats: false,
    sceneAttributeScaleApplied: false,
    sceneAttributeOverridesApplied: false,
  };
}

function indexAttributes(attributes = []) {
  return new Map(
    attributes
      .filter(attribute => attribute?.key && Number.isFinite(attribute?.value))
      .map(attribute => [attribute.key, attribute])
  );
}

function mapStats(attributes, selector) {
  return Object.fromEntries(
    Object.entries(ENEMY_LEVEL_SCALED_STAT_KEYS).map(
      ([attributeKey, statKey]) => {
        const attribute = attributes.get(attributeKey);
        const value = attribute ? selector(attribute) : null;
        return [statKey, Number.isFinite(value) ? value : null];
      }
    )
  );
}

function nullStats() {
  return Object.fromEntries(
    Object.values(ENEMY_LEVEL_SCALED_STAT_KEYS).map(key => [key, null])
  );
}
