import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';

const OBJECT_KINDS = Object.freeze([
  {
    kind: 'character',
    denominator: 'characterOptimizationObjects',
    admission: 'characters',
    numeric: false,
  },
  { kind: 'kibo', denominator: 'kibos', admission: 'kibos', numeric: true },
  {
    kind: 'soul-essence',
    denominator: 'soulEssences',
    admission: 'soulEssences',
    numeric: true,
  },
  {
    kind: 'equipment',
    denominator: 'equipment',
    admission: 'equipment',
    numeric: true,
  },
  {
    kind: 'set-skill',
    denominator: 'setSkills',
    admission: 'setSkills',
    numeric: false,
  },
]);

export function deriveOptimizationQualificationStageGate(catalog = {}) {
  const records = Array.isArray(catalog.records) ? catalog.records : [];
  const denominators = catalog.denominators ?? {};
  const admission = catalog.admission ?? {};
  const bindingMatrix = catalog.bindingMatrix ?? {};
  const reasonCodes = [];
  const counts = {};

  for (const config of OBJECT_KINDS) {
    const rows = records.filter(record => record.objectKind === config.kind);
    const ready = rows.filter(record => record.optimizationReady === true);
    const denominator = Number(denominators[config.denominator]);
    const expectedAdmission = normalizeIdentities(
      ready.map(record => record.objectId),
      config.numeric
    );
    const actualAdmission = normalizeIdentities(
      admission[config.admission] ?? [],
      config.numeric
    );
    const row = {
      total: rows.length,
      denominator,
      ready: ready.length,
      admission: actualAdmission.length,
    };
    counts[config.kind] = row;
    if (!Number.isInteger(denominator) || rows.length !== denominator) {
      reasonCodes.push(
        `optimization-qualification-denominator-mismatch:${config.kind}`
      );
    }
    if (
      hashCanonicalValue(actualAdmission) !==
      hashCanonicalValue(expectedAdmission)
    ) {
      reasonCodes.push(
        `optimization-qualification-admission-mismatch:${config.kind}`
      );
    }
    if (ready.length !== rows.length) {
      reasonCodes.push(
        `optimization-qualification-object-kind-incomplete:${config.kind}`
      );
    }
  }

  const recordReadyByKey = new Map(
    records.map(record => [
      `${record.objectKind}:${record.objectId}`,
      record.optimizationReady === true,
    ])
  );
  const characters = records.filter(record => record.objectKind === 'character');
  const kibos = records.filter(record => record.objectKind === 'kibo');
  const souls = records.filter(record => record.objectKind === 'soul-essence');
  const equipment = records.filter(record => record.objectKind === 'equipment');
  const setSkills = records.filter(record => record.objectKind === 'set-skill');

  const actorKibo = validateBindingFamily({
    rows: bindingMatrix.actorKibo,
    expectedCount: characters.length * kibos.length,
    keyOf: edge => `${edge.actorObjectId}:${edge.kiboId}`,
    expectedReady: edge =>
      edge.compatible !== false &&
      recordReadyByKey.get(`character:${edge.actorObjectId}`) === true &&
      recordReadyByKey.get(`kibo:${edge.kiboId}`) === true,
    family: 'actor-kibo',
    reasonCodes,
  });
  const actorSoulEssence = validateBindingFamily({
    rows: bindingMatrix.actorSoulEssence,
    expectedCount: characters.length * souls.length,
    keyOf: edge => `${edge.actorObjectId}:${edge.soulEssenceId}`,
    expectedReady: edge =>
      edge.compatible === true &&
      recordReadyByKey.get(`character:${edge.actorObjectId}`) === true &&
      recordReadyByKey.get(`soul-essence:${edge.soulEssenceId}`) === true,
    family: 'actor-soul-essence',
    reasonCodes,
  });
  const actorEquipment = validateBindingFamily({
    rows: bindingMatrix.actorEquipment,
    expectedCount: characters.length * equipment.length,
    keyOf: edge => `${edge.actorObjectId}:${edge.equipmentId}`,
    expectedReady: edge =>
      edge.compatible === true &&
      recordReadyByKey.get(`character:${edge.actorObjectId}`) === true &&
      recordReadyByKey.get(`equipment:${edge.equipmentId}`) === true,
    family: 'actor-equipment',
    reasonCodes,
  });
  const setSkillThresholds = validateBindingFamily({
    rows: bindingMatrix.setSkillThresholds,
    expectedCount: setSkills.length,
    keyOf: edge => `${edge.setId}:${edge.pieces}`,
    expectedReady: edge =>
      recordReadyByKey.get(`set-skill:${edge.setId}:${edge.pieces}`) === true,
    family: 'set-skill-threshold',
    reasonCodes,
  });
  const equipmentSlots = validateEquipmentSlots({
    equipment,
    equipmentSlots: bindingMatrix.equipmentSlots,
    reasonCodes,
  });
  const bindings = {
    actorKibo,
    actorSoulEssence,
    actorEquipment,
    setSkillThresholds,
    equipmentSlots,
  };
  const uniqueReasonCodes = [...new Set(reasonCodes)].sort();
  const formalOptimizationUnlocked = uniqueReasonCodes.length === 0;
  return {
    schemaVersion: 1,
    contractName: 'AzPrOptimizationQualificationStageGate',
    counts,
    bindings,
    reasonCodes: uniqueReasonCodes,
    formalOptimizationUnlocked,
    m12cLocked: !formalOptimizationUnlocked,
  };
}

export function validateOptimizationQualificationBindingHash(catalog = {}) {
  const matrix = catalog.bindingMatrix;
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) {
    return false;
  }
  const value = structuredClone(matrix);
  const hash = value.bindingMatrixHash;
  delete value.bindingMatrixHash;
  return (
    typeof hash === 'string' &&
    hash === hashCanonicalValue(value) &&
    catalog.bindingMatrixHash === hash
  );
}

function validateBindingFamily({
  rows: rawRows,
  expectedCount,
  keyOf,
  expectedReady,
  family,
  reasonCodes,
}) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const keys = rows.map(keyOf);
  const uniqueCount = new Set(keys).size;
  const readinessMismatchCount = rows.filter(
    edge => edge.qualificationReady !== expectedReady(edge)
  ).length;
  const qualifiedCount = rows.filter(edge => edge.qualificationReady === true)
    .length;
  if (rows.length !== expectedCount || uniqueCount !== expectedCount) {
    reasonCodes.push(
      `optimization-qualification-binding-coverage-incomplete:${family}`
    );
  }
  if (readinessMismatchCount > 0) {
    reasonCodes.push(
      `optimization-qualification-binding-readiness-mismatch:${family}`
    );
  }
  if (
    rows.some(
      edge => expectedReady(edge) === true && edge.qualificationReady !== true
    )
  ) {
    reasonCodes.push(
      `optimization-qualification-binding-not-qualified:${family}`
    );
  }
  return {
    total: rows.length,
    expected: expectedCount,
    unique: uniqueCount,
    qualified: qualifiedCount,
    readinessMismatch: readinessMismatchCount,
  };
}

function validateEquipmentSlots({ equipment, equipmentSlots, reasonCodes }) {
  const assignments = new Map();
  for (const [slot, ids] of Object.entries(equipmentSlots ?? {})) {
    for (const equipmentId of ids ?? []) {
      const key = String(equipmentId);
      const slots = assignments.get(key) ?? [];
      slots.push(slot);
      assignments.set(key, slots);
    }
  }
  const missing = equipment.filter(
    record => (assignments.get(String(record.objectId)) ?? []).length !== 1
  );
  if (missing.length > 0 || assignments.size !== equipment.length) {
    reasonCodes.push(
      'optimization-qualification-binding-coverage-incomplete:equipment-slot'
    );
  }
  return {
    equipmentCount: equipment.length,
    assignedCount: assignments.size,
    invalidAssignmentCount: missing.length,
  };
}

function normalizeIdentities(values, numeric) {
  return [...new Set(values.map(value => (numeric ? Number(value) : String(value))))]
    .filter(value => (numeric ? Number.isFinite(value) : value.length > 0))
    .sort((left, right) =>
      numeric ? left - right : String(left).localeCompare(String(right), 'en')
    );
}
