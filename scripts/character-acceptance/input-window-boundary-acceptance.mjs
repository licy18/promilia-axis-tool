export function inspectInputWindowBoundaries(
  fixture,
  run,
  configuration = null
) {
  const selections = new Map(
    (run.trace?.variants?.selections ?? []).map(selection => [
      selection.actionId,
      selection,
    ])
  );
  const actions = new Map(
    (fixture.actions ?? []).map(action => [action.id, action])
  );
  const definitions = configuration?.cases ?? [
    {
      actionId: 'window-outside-before',
      expectedOffset: 39,
      expectedControlSkillId: 10900101,
    },
    {
      actionId: 'window-inside-start',
      expectedOffset: 41,
      expectedControlSkillId: 10900143,
    },
    {
      actionId: 'window-inside-end',
      expectedOffset: 76,
      expectedControlSkillId: 10900143,
    },
    {
      actionId: 'window-outside-after',
      expectedOffset: 78,
      expectedControlSkillId: 10900101,
    },
  ];
  const cases = definitions.map(definition => {
    const {
      actionId,
      sourceActionId,
      expectedOffset,
      expectedControlSkillId,
      expectedSubSkillIndex,
    } = definition;
    const action = actions.get(actionId);
    const sourceAction = actions.get(
      sourceActionId ?? action?.intent?.attackInput?.contextActionId
    );
    const actualOffset =
      Number(action?.schedule?.frame) - Number(sourceAction?.schedule?.frame);
    const selection = selections.get(actionId) ?? null;
    return {
      actionId,
      sourceActionId: sourceActionId ?? null,
      expectedOffset,
      actualOffset,
      expectedControlSkillId,
      actualControlSkillId: Number(selection?.controlSkillId),
      expectedSubSkillIndex: expectedSubSkillIndex ?? null,
      actualSubSkillIndex: Number(selection?.subSkillIndex),
      passed:
        actualOffset === expectedOffset &&
        Number(selection?.controlSkillId) === expectedControlSkillId &&
        (expectedSubSkillIndex == null ||
          Number(selection?.subSkillIndex) === expectedSubSkillIndex),
      selection,
    };
  });
  return {
    passed: cases.every(entry => entry.passed),
    details: {
      sourceControlSkillId: configuration?.sourceControlSkillId ?? 10900112,
      transitionControlSkillId:
        configuration?.transitionControlSkillId ?? 10900143,
      sourceWindow: configuration?.sourceWindow ?? '(40,77] source frames',
      cases,
    },
  };
}
