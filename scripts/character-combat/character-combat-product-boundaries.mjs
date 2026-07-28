export const UNNAMED_SECONDARY_PASSIVE_REASON =
  'unnamed-secondary-passive-not-implemented-current-client';

export function discoverUnnamedSecondaryPassiveBoundaries({
  characterCatalog,
  skills,
}) {
  const characters = Array.isArray(characterCatalog)
    ? characterCatalog
    : (characterCatalog?.items ?? []);
  const skillById = new Map(
    (skills ?? []).map(skill => [Number(skill.id), skill])
  );
  const entries = [];
  const unresolved = [];

  for (const character of characters) {
    const ownerId = Number(character.id);
    const ownerPassives = (character.skillSlots ?? [])
      .filter(slot => slot.group === 'passive')
      .map((slot, passiveSlotIndex) => ({
        passiveSlotIndex,
        slot,
        skill: skillById.get(Number(slot.skillId)) ?? null,
      }))
      .filter(
        item =>
          item.skill != null &&
          Number(item.skill.characterId) === ownerId &&
          Number(item.skill.skillType) === 1
      );
    const primary = ownerPassives[0] ?? null;
    const secondary = ownerPassives[1] ?? null;
    if (
      !primary ||
      !secondary ||
      !hasLocalizedSkillName(primary.skill) ||
      hasLocalizedSkillName(secondary.skill)
    ) {
      unresolved.push({
        ownerId,
        ownerName: character.name ?? null,
        primaryPassiveSkillId: numberOrNull(primary?.skill?.id),
        secondaryPassiveSkillId: numberOrNull(secondary?.skill?.id),
        reason: !primary
          ? 'primary-character-passive-slot-missing'
          : !secondary
            ? 'secondary-character-passive-slot-missing'
            : !hasLocalizedSkillName(primary.skill)
              ? 'primary-character-passive-name-missing'
              : 'secondary-character-passive-has-localized-name',
      });
      continue;
    }
    entries.push({
      boundaryIdentity: `actor:${ownerId}:skill:${secondary.skill.id}:product-boundary`,
      ownerId,
      ownerName: character.name ?? null,
      passiveSlotIndex: secondary.passiveSlotIndex,
      skillId: Number(secondary.skill.id),
      name: secondary.skill.name ?? null,
      displayName: secondary.skill.displayName ?? null,
      description: {
        raw: secondary.skill.description?.raw ?? null,
        plain: secondary.skill.description?.plain ?? null,
        special: secondary.skill.description?.special ?? null,
      },
      primaryPassive: {
        skillId: Number(primary.skill.id),
        name: primary.skill.name ?? primary.skill.displayName ?? null,
      },
      classification: 'not-applicable',
      reason: UNNAMED_SECONDARY_PASSIVE_REASON,
      sourceIdentities: [
        `characters.items[id=${ownerId}].skillSlots[group=passive,index=${secondary.passiveSlotIndex},skillId=${secondary.skill.id}]`,
        secondary.skill.source?.heroModule ??
          `workbench-seed.gameData.skills[id=${secondary.skill.id}]`,
      ],
      runtimeContractPolicy: {
        passiveProfile: false,
        listener: false,
        effectBinding: false,
        captureRequirement: false,
        gameplayImpactingGap: false,
      },
    });
  }

  entries.sort((left, right) => left.ownerId - right.ownerId);
  unresolved.sort((left, right) => left.ownerId - right.ownerId);
  return {
    schemaVersion: 1,
    kind: 'azpr-character-combat-product-boundary-report',
    status:
      unresolved.length === 0
        ? 'unnamed-secondary-passive-boundary-ready'
        : 'unnamed-secondary-passive-boundary-incomplete',
    policy: {
      identification:
        'second character-owned passive slot with missing localized name',
      numericSuffixIsNotEvidence: true,
      descriptionRemainsAuditable: true,
      classification: 'not-applicable',
      reason: UNNAMED_SECONDARY_PASSIVE_REASON,
    },
    entries,
    unresolved,
    summary: {
      publicCharacterCount: characters.length,
      matchedCharacterCount: entries.length,
      unresolvedCharacterCount: unresolved.length,
      matchedSkillIds: entries.map(entry => entry.skillId),
    },
  };
}

export function applyCharacterCombatProductBoundaries({
  recipes,
  boundaryReport,
}) {
  const boundariesByOwnerId = new Map();
  for (const entry of boundaryReport?.entries ?? []) {
    const ownerId = Number(entry.ownerId);
    const records = boundariesByOwnerId.get(ownerId) ?? [];
    records.push(entry);
    boundariesByOwnerId.set(ownerId, records);
  }

  return (recipes ?? []).map(recipe => {
    const ownerId = Number(recipe.ownerId);
    const boundaries = boundariesByOwnerId.get(ownerId) ?? [];
    if (boundaries.length === 0) return recipe;
    const excludedSkillIds = new Set(
      boundaries.map(entry => Number(entry.skillId))
    );
    const compiler = recipe.compiler ?? {};
    const mechanicsDiscovery = recipe.mechanicsDiscovery ?? {};
    const runtimePolicies = recipe.runtimePolicies ?? {};
    const boundaryRecords = boundaries.map(entry => ({
      skillId: entry.skillId,
      reason: entry.reason,
      sourceIdentity: entry.sourceIdentities.join('|'),
      productBoundaryIdentity: entry.boundaryIdentity,
    }));
    const notApplicableBySkillId = new Map(
      (recipe.notApplicableSkills ?? []).map(item => [
        Number(item.skillId),
        item,
      ])
    );
    for (const record of boundaryRecords) {
      notApplicableBySkillId.set(Number(record.skillId), record);
    }

    return {
      ...recipe,
      mechanicsDiscovery: {
        ...mechanicsDiscovery,
        passiveSkillIds: (mechanicsDiscovery.passiveSkillIds ?? []).filter(
          skillId => !excludedSkillIds.has(Number(skillId))
        ),
      },
      compiler: {
        ...compiler,
        reachableControlSkillIds: (
          compiler.reachableControlSkillIds ?? []
        ).filter(skillId => !excludedSkillIds.has(Number(skillId))),
        passiveEffects: (compiler.passiveEffects ?? []).filter(
          passive => !excludedSkillIds.has(Number(passive.skillId))
        ),
        targetStateTransactions: (
          compiler.targetStateTransactions ?? []
        ).filter(
          transaction =>
            !excludedSkillIds.has(Number(transaction.passiveSkillId))
        ),
      },
      runtimePolicies: {
        ...runtimePolicies,
        controlPolicies: (runtimePolicies.controlPolicies ?? []).filter(
          policy => !excludedSkillIds.has(Number(policy.controlSkillId))
        ),
      },
      unresolvedRecords: (recipe.unresolvedRecords ?? []).filter(
        record => !recordReferencesExcludedPassive(record, excludedSkillIds)
      ),
      notApplicableSkills: [...notApplicableBySkillId.values()].sort(
        (left, right) => Number(left.skillId) - Number(right.skillId)
      ),
      productBoundaries: [
        ...(recipe.productBoundaries ?? []).filter(
          record => record.kind !== 'unnamed-secondary-passive'
        ),
        ...boundaries.map(entry => ({
          kind: 'unnamed-secondary-passive',
          ...entry,
        })),
      ],
    };
  });
}

export function assertUnnamedSecondaryPassiveRuntimeIsolation({
  recipes,
  ownerCompilations,
  mechanicsPackage,
  boundaryReport,
}) {
  const excludedSkillIds = new Set(
    (boundaryReport?.entries ?? []).map(entry => Number(entry.skillId))
  );
  const violations = [];
  for (const recipe of recipes ?? []) {
    for (const passive of recipe.compiler?.passiveEffects ?? []) {
      if (excludedSkillIds.has(Number(passive.skillId))) {
        violations.push(`recipe-passive:${recipe.ownerId}/${passive.skillId}`);
      }
    }
  }
  for (const compilation of ownerCompilations ?? []) {
    for (const passive of compilation.contracts?.passiveEffects ?? []) {
      if (excludedSkillIds.has(Number(passive.skillId))) {
        violations.push(
          `compiled-passive:${compilation.ownerId}/${passive.skillId}`
        );
      }
    }
    for (const transaction of compilation.contracts
      ?.targetStateTransactions ?? []) {
      if (excludedSkillIds.has(Number(transaction.passiveSkillId))) {
        violations.push(
          `compiled-transaction:${compilation.ownerId}/${transaction.transactionIdentity}`
        );
      }
    }
  }
  for (const passive of mechanicsPackage?.specialResourceCatalog
    ?.passiveEffects ?? []) {
    if (excludedSkillIds.has(Number(passive.skillId))) {
      violations.push(`package-passive:${passive.ownerId}/${passive.skillId}`);
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `unnamed secondary passive runtime isolation failed: ${violations.join(', ')}`
    );
  }
}

export function createCharacterCombatProductBoundaryMarkdown(report) {
  const lines = [
    '# 当前客户端产品机制边界',
    '',
    `- 公开角色：${report.summary.publicCharacterCount}`,
    `- 无名第二被动：${report.summary.matchedCharacterCount}`,
    `- 未决角色：${report.summary.unresolvedCharacterCount}`,
    `- 统一口径：\`${UNNAMED_SECONDARY_PASSIVE_REASON}\``,
    '',
    '| 角色 | 第一被动 | 无名第二被动 | 状态 |',
    '| --- | --- | --- | --- |',
    ...report.entries.map(
      entry =>
        `| ${entry.ownerName} (${entry.ownerId}) | ${entry.primaryPassive.name} (${entry.primaryPassive.skillId}) | ${entry.skillId} | not-applicable |`
    ),
    '',
    '> 识别依据为角色专属被动槽顺序与本地化名称缺失。技能描述和来源仍保留供审计，但不生成监听、效果、capture 或玩法缺口。',
    '',
  ];
  return lines.join('\n');
}

function hasLocalizedSkillName(skill) {
  return [skill?.name, skill?.displayName].some(
    value => typeof value === 'string' && value.trim().length > 0
  );
}

function recordReferencesExcludedPassive(record, excludedSkillIds) {
  if (excludedSkillIds.has(Number(record?.skillId))) return true;
  if (excludedSkillIds.has(Number(record?.passiveSkillId))) return true;
  const identity = String(record?.identity ?? '');
  return [...excludedSkillIds].some(
    skillId =>
      identity === `actor:${record?.ownerId ?? ''}:passive:${skillId}` ||
      identity.endsWith(`:passive:${skillId}`) ||
      identity.endsWith(`:skill:${skillId}`)
  );
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
