export const THREE_VALUE_MECHANICS_LAYER_INPUTS_CONTRACT_NAME =
  'AzPrThreeValueMechanicsLayerInputs';

export function createThreeValueMechanicsLayerInputs({
  trackKey,
  mechanicsProfile,
  mechanismContext: context,
  sourceValue,
} = {}) {
  const track = mechanicsProfile?.tracks?.[trackKey] ?? {};
  const operands = sourceValue?.operands?.inputs ?? {};
  const required =
    mechanicsProfile?.operandKinds?.[sourceValue?.operands?.kind]?.layerKeys ??
    [];
  const actor = context?.sourceActor ?? {};
  const enemy = context?.targetEnemy ?? {};
  const configuration = context?.configuration ?? {};
  const applied = track.appliedLayers ?? [];
  const unapplied = track.unappliedLayers ?? [];
  const inputKeys = Object.fromEntries(
    [...applied, ...unapplied].map(key => [key, resolveInputKey(key)])
  );
  const inputs = {
    actorStats: input(actor.stats, 'actor'),
    actionMultiplier: input(operands.actionMultiplier, 'operands'),
    enemyDefense: input(
      {
        level: enemy.level,
        physicalDefense: enemy.stats?.physicalDefense,
        magicalDefense: enemy.stats?.magicalDefense,
        defenseMultiplier: configuration.targetEnemy?.defenseMultiplier,
      },
      'enemy'
    ),
    enemyElementDefense: input(enemy.elementDefenses, 'elements'),
    cultivationConfiguration: input(
      configuration.sourceActor?.loadout,
      'loadout'
    ),
    operands: input(operands, 'operands'),
    initialEnergy: input(actor.energy?.initialValue, 'energy'),
    stateBefore: input(null, 'state'),
  };

  return {
    contractName: THREE_VALUE_MECHANICS_LAYER_INPUTS_CONTRACT_NAME,
    contractVersion: 1,
    layers: { applied, unapplied, required, inputKeys },
    inputs,
    missingRequiredCount: required.filter(
      key => !inputs[inputKeys[key]]?.ready
    ).length,
  };
}

export function bindThreeValueMechanicsLayerInputsState(
  layerInputs,
  stateBefore
) {
  return {
    ...layerInputs,
    inputs: {
      ...layerInputs?.inputs,
      stateBefore: input(stateBefore, 'state'),
    },
  };
}

function resolveInputKey(key) {
  if (['baseAttack', 'critical', 'damageBonus'].includes(key)) {
    return 'actorStats';
  }
  if (key === 'actionMultiplier') return key;
  if (key === 'enemyDefense' || key === 'enemyLevel') return 'enemyDefense';
  if (key === 'enemyResistance') return 'enemyElementDefense';
  if (key === 'loadout') return 'cultivationConfiguration';
  return 'operands';
}

function input(value, source) {
  return { value, source, ready: hasValue(value) };
}

function hasValue(value) {
  return (
    value != null &&
    value !== '' &&
    (typeof value !== 'object' || Object.values(value).some(hasValue))
  );
}
