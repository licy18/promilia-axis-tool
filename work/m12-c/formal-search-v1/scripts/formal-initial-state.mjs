export function materializeFormalInitialState(presetSpec, sourceConfig) {
  const objectIds = sourceConfig.actors.map(actor =>
    String(actor.optimizationObjectId)
  );
  const actorSpByOptimizationObjectId = createSpMap(
    presetSpec.actorSp,
    objectIds
  );
  const kiboSpByOptimizationObjectId = createSpMap(
    presetSpec.kiboSp,
    objectIds
  );
  const specialResources = [];
  if (objectIds.includes('103002') && presetSpec.rubyAmmo != null) {
    const rubyAmmo = Number(presetSpec.rubyAmmo);
    if (!Number.isInteger(rubyAmmo) || rubyAmmo < 0 || rubyAmmo > 12) {
      throw new TypeError('Ruby ammunition must be an integer from 0 to 12');
    }
    specialResources.push({
      optimizationObjectId: '103002',
      resourceIdentity: 'actor:103002:element:103002047',
      currentValue: rubyAmmo,
      maxValue: 12,
      inputStep: 1,
      scenarioConfigurable: true,
      activeStates: [],
    });
  }
  return {
    presetId: presetSpec.presetId,
    actorSpByOptimizationObjectId,
    kiboSpByOptimizationObjectId,
    tuningMarks: structuredClone(presetSpec.tuningMarks ?? []),
    specialResources,
  };
}

function createSpMap(specification, objectIds) {
  if (specification === 'max') {
    return Object.fromEntries(
      [...objectIds].sort().map(objectId => [objectId, 100])
    );
  }
  if (specification === 'zero' || specification == null) return {};
  if (typeof specification !== 'object' || Array.isArray(specification)) {
    throw new TypeError('SP preset must be max, zero, or an object map');
  }
  return Object.fromEntries(
    objectIds
      .filter(objectId => specification[objectId] != null)
      .sort()
      .map(objectId => [objectId, Number(specification[objectId])])
  );
}
