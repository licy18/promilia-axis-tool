export const THREE_VALUE_HP_OPERAND_SOURCE_BINDING_CONTRACT_NAME =
  'AzPrHpOperandSourceBinding';

export const THREE_VALUE_HP_OPERAND_SOURCE_BINDING_CONTRACT_VERSION = 1;

export function createThreeValueHpOperandSourceBinding({
  action,
  actor,
  segment,
  gameDataReference = action?.gameDataReference,
} = {}) {
  const referenceVariant =
    gameDataReference?.variant ?? gameDataReference?.skill?.variant ?? null;
  const baseAttack = numberOrNull(actor?.stats?.attack);
  const actionMultiplier = numberOrNull(segment?.multiplier);
  const binding = {
    schemaVersion: 1,
    contractName: THREE_VALUE_HP_OPERAND_SOURCE_BINDING_CONTRACT_NAME,
    contractVersion: THREE_VALUE_HP_OPERAND_SOURCE_BINDING_CONTRACT_VERSION,
    sourceKind: 'compiled-action-skill-variant-operands',
    action: {
      actionId: textOrNull(action?.id ?? action?.actionId),
      skillId: numberOrNull(action?.skillId),
      actorId: textOrNull(action?.actorId),
      actorCharacterId: numberOrNull(actor?.characterId),
      actionVariantIndex: nonNegativeIntegerOrNull(
        action?.actionVariantIndex ??
          segment?.actionVariantIndex ??
          segment?.index
      ),
    },
    skillVariantReference: {
      identity:
        textOrNull(gameDataReference?.skillVariantReferenceIdentity) ??
        textOrNull(gameDataReference?.skill?.skillVariantReferenceIdentity),
      actionReferenceIdentity: textOrNull(gameDataReference?.referenceIdentity),
      ready:
        gameDataReference?.ready === true &&
        gameDataReference?.skill?.compatible === true,
      catalogId: textOrNull(gameDataReference?.skill?.catalogId),
      catalogVersion: numberOrNull(gameDataReference?.skill?.catalogVersion),
      dataVersion: textOrNull(gameDataReference?.skill?.dataVersion),
      skillId: numberOrNull(gameDataReference?.skill?.id),
      characterId: numberOrNull(gameDataReference?.skill?.resolvedCharacterId),
      actionVariantIndex: nonNegativeIntegerOrNull(referenceVariant?.index),
      rawValue: referenceVariant?.rawValue ?? null,
      multiplier: numberOrNull(referenceVariant?.multiplier),
      sourceIdentity: createSkillVariantSourceIdentity(
        referenceVariant?.source
      ),
    },
    operands: {
      baseAttack: {
        value: baseAttack,
        source: textOrNull(actor?.stats?.source),
        actorId: textOrNull(actor?.id),
        characterId: numberOrNull(actor?.characterId),
      },
      actionMultiplier: {
        value: actionMultiplier,
        rawValue: segment?.rawValue ?? null,
        actionVariantIndex: nonNegativeIntegerOrNull(
          segment?.actionVariantIndex ?? segment?.index
        ),
        sourceIdentity: createSkillVariantSourceIdentity(segment?.source),
      },
    },
  };
  const expectedDelta = calculateHpPreviewDelta(baseAttack, actionMultiplier);
  const validation = validateThreeValueHpOperandSourceBinding({
    binding,
    action,
    baseAttack,
    actionMultiplier,
    expectedDelta,
  });

  return {
    ...binding,
    status: validation.ready
      ? 'hp-operand-source-binding-ready'
      : 'hp-operand-source-binding-invalid',
    ready: validation.ready,
    validation,
  };
}

export function validateThreeValueHpOperandSourceBinding({
  binding,
  action = null,
  baseAttack = null,
  actionMultiplier = null,
  expectedDelta = null,
} = {}) {
  if (!binding) {
    return {
      required: false,
      ready: false,
      status: 'hp-operand-source-binding-not-provided',
      issueCodes: [],
      issues: [],
    };
  }

  const issues = [];
  const addIssue = (code, expected, actual) =>
    issues.push({ code, expected: expected ?? null, actual: actual ?? null });
  if (
    binding.contractName !==
      THREE_VALUE_HP_OPERAND_SOURCE_BINDING_CONTRACT_NAME ||
    Number(binding.contractVersion) !==
      THREE_VALUE_HP_OPERAND_SOURCE_BINDING_CONTRACT_VERSION
  ) {
    addIssue(
      'hp-operand-source-binding-contract-invalid',
      THREE_VALUE_HP_OPERAND_SOURCE_BINDING_CONTRACT_NAME,
      binding.contractName
    );
  }

  const reference = binding.skillVariantReference ?? {};
  const operands = binding.operands ?? {};
  if (reference.ready !== true) {
    addIssue('skill-variant-reference-not-ready', true, reference.ready);
  }
  if (!textOrNull(reference.identity)) {
    addIssue('skill-variant-reference-identity-missing', 'non-empty', null);
  }
  if (
    numberOrNull(binding.action?.skillId) !== numberOrNull(reference.skillId)
  ) {
    addIssue(
      'skill-id-reference-mismatch',
      reference.skillId,
      binding.action?.skillId
    );
  }
  if (
    numberOrNull(binding.action?.actorCharacterId) !==
    numberOrNull(reference.characterId)
  ) {
    addIssue(
      'actor-character-reference-mismatch',
      reference.characterId,
      binding.action?.actorCharacterId
    );
  }
  if (
    nonNegativeIntegerOrNull(binding.action?.actionVariantIndex) !==
    nonNegativeIntegerOrNull(reference.actionVariantIndex)
  ) {
    addIssue(
      'action-variant-reference-mismatch',
      reference.actionVariantIndex,
      binding.action?.actionVariantIndex
    );
  }
  if (!numbersMatch(operands.actionMultiplier?.value, reference.multiplier)) {
    addIssue(
      'action-multiplier-reference-mismatch',
      reference.multiplier,
      operands.actionMultiplier?.value
    );
  }
  if (
    textOrNull(operands.actionMultiplier?.sourceIdentity) !==
    textOrNull(reference.sourceIdentity)
  ) {
    addIssue(
      'action-multiplier-source-mismatch',
      reference.sourceIdentity,
      operands.actionMultiplier?.sourceIdentity
    );
  }

  const runtimeReference = action?.gameDataReference ?? null;
  if (action) {
    const actionId = textOrNull(action.id ?? action.actionId);
    if (actionId !== textOrNull(binding.action?.actionId)) {
      addIssue(
        'action-id-binding-mismatch',
        binding.action?.actionId,
        actionId
      );
    }
    if (
      numberOrNull(action.skillId) !== numberOrNull(binding.action?.skillId)
    ) {
      addIssue(
        'skill-id-binding-mismatch',
        binding.action?.skillId,
        action.skillId
      );
    }
    if (
      runtimeReference &&
      textOrNull(runtimeReference.skillVariantReferenceIdentity) !==
        textOrNull(reference.identity)
    ) {
      addIssue(
        'skill-variant-reference-identity-mismatch',
        reference.identity,
        runtimeReference.skillVariantReferenceIdentity
      );
    }
  }
  if (
    numberOrNull(baseAttack) != null &&
    !numbersMatch(baseAttack, operands.baseAttack?.value)
  ) {
    addIssue(
      'base-attack-input-mismatch',
      operands.baseAttack?.value,
      baseAttack
    );
  }
  if (
    numberOrNull(actionMultiplier) != null &&
    !numbersMatch(actionMultiplier, operands.actionMultiplier?.value)
  ) {
    addIssue(
      'action-multiplier-input-mismatch',
      operands.actionMultiplier?.value,
      actionMultiplier
    );
  }
  const calculatedDelta = calculateHpPreviewDelta(
    numberOrNull(baseAttack) ?? numberOrNull(operands.baseAttack?.value),
    numberOrNull(actionMultiplier) ??
      numberOrNull(operands.actionMultiplier?.value)
  );
  if (
    numberOrNull(expectedDelta) != null &&
    !numbersMatch(expectedDelta, calculatedDelta)
  ) {
    addIssue(
      'hp-operand-expected-delta-mismatch',
      calculatedDelta,
      expectedDelta
    );
  }

  const ready = issues.length === 0;
  return {
    required: true,
    ready,
    status: ready
      ? 'hp-operand-source-binding-valid'
      : 'hp-operand-source-binding-drift-detected',
    issueCodes: issues.map(issue => issue.code),
    issues,
  };
}

function calculateHpPreviewDelta(baseAttack, actionMultiplier) {
  const attack = numberOrNull(baseAttack);
  const multiplier = numberOrNull(actionMultiplier);
  return attack == null || multiplier == null
    ? null
    : Math.max(0, Math.round(attack * multiplier));
}

import {
  createSkillVariantSourceIdentity,
  nonNegativeIntegerOrNull,
  numberOrNull,
  numbersMatch,
  textOrNull,
} from '../../domain/contractValues';
