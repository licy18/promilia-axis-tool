function normalizeOptionalInteger(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

export function resolveGoldenSelectedSubSkillIndex({
  action,
  mapping,
  mechanicsPackage,
}) {
  if (Object.hasOwn(action ?? {}, 'controlSubSkillIndex')) {
    return normalizeOptionalInteger(action.controlSubSkillIndex);
  }
  if (Object.hasOwn(action ?? {}, 'selectedSubSkillIndex')) {
    return normalizeOptionalInteger(action.selectedSubSkillIndex);
  }

  const publicForms = (
    mechanicsPackage?.actionVariantGraph?.publicActionForms ?? []
  ).filter(
    form =>
      form.applied === true &&
      (String(form.formIdentity ?? '').startsWith(`${mapping.identity}:`) ||
        (Number(form.ownerId) === Number(mapping.ownerId) &&
          form.publicActionKind === mapping.actionKind &&
          Number(form.publicControlSkillId ?? mapping.controlSkillId) ===
            Number(mapping.controlSkillId)))
  );
  const subSkillIndexes = [
    ...new Set(
      publicForms
        .map(form =>
          normalizeOptionalInteger(
            form.executionSubSkillIndex ?? form.subSkillIndex
          )
        )
        .filter(value => value != null)
    ),
  ];
  return subSkillIndexes.length === 1 ? subSkillIndexes[0] : null;
}

export function resolveGoldenAttackInputSourceSegment(mapping, chainSegment) {
  const controlSkillId = normalizeOptionalInteger(chainSegment?.controlSkillId);
  const subSkillIndex = normalizeOptionalInteger(
    chainSegment?.selectedSubSkillIndex ?? chainSegment?.subSkillIndex
  );
  const segmentPools = [
    mapping?.attackInputSourceSegments ?? [],
    mapping?.attackInputSegments ?? [],
  ];

  for (const segments of segmentPools) {
    const exact = segments.find(candidate => {
      const candidateSubSkillIndex = normalizeOptionalInteger(
        candidate.selectedSubSkillIndex ?? candidate.subSkillIndex
      );
      return (
        normalizeOptionalInteger(candidate.controlSkillId) === controlSkillId &&
        candidateSubSkillIndex === subSkillIndex
      );
    });
    if (exact) return exact;
  }
  for (const segments of segmentPools) {
    const controlMatch = segments.find(
      candidate =>
        normalizeOptionalInteger(candidate.controlSkillId) === controlSkillId
    );
    if (controlMatch) return controlMatch;
  }
  return null;
}
