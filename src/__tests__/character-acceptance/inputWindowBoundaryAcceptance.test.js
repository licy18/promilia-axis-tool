import { inspectInputWindowBoundaries } from '../../../scripts/character-acceptance/input-window-boundary-acceptance.mjs';

describe('character acceptance input-window boundary evidence', () => {
  it('measures outside cases from an evidence-only source without forging runtime context', () => {
    const fixture = {
      actions: [
        action('source', 100, 'source-group'),
        action('start-minus-one', 131, 'outside-before'),
        action('start', 132, 'inside-start', 'source'),
        action('end-minus-one', 151, 'inside-end', 'source'),
        action('end', 152, 'outside-after'),
      ],
    };
    const run = {
      trace: {
        variants: {
          selections: [
            selection('start-minus-one', 19900110, 0),
            selection('start', 19900110, 1),
            selection('end-minus-one', 19900110, 1),
            selection('end', 19900110, 0),
          ],
        },
      },
    };

    const inspection = inspectInputWindowBoundaries(fixture, run, {
      sourceWindow: '[32,52) source frames',
      cases: [
        boundary('start-minus-one', 'source', 31, 0),
        boundary('start', 'source', 32, 1),
        boundary('end-minus-one', 'source', 51, 1),
        boundary('end', 'source', 52, 0),
      ],
    });

    expect(inspection.passed).toBe(true);
    expect(inspection.details.cases.map(entry => entry.actualOffset)).toEqual([
      31, 32, 51, 52,
    ]);
    expect(
      fixture.actions
        .filter(action => ['start-minus-one', 'end'].includes(action.id))
        .every(action => action.intent.attackInput.contextActionId == null)
    ).toBe(true);
  });

  it('fails closed when the evidence source is missing or a right-open edge selects the variant', () => {
    const fixture = {
      actions: [action('end', 152, 'outside-after')],
    };
    const run = {
      trace: {
        variants: {
          selections: [selection('end', 19900110, 1)],
        },
      },
    };

    const inspection = inspectInputWindowBoundaries(fixture, run, {
      cases: [boundary('end', 'missing-source', 52, 0)],
    });

    expect(inspection.passed).toBe(false);
    expect(inspection.details.cases[0]).toMatchObject({
      actualOffset: Number.NaN,
      actualSubSkillIndex: 1,
      passed: false,
    });
  });
});

function action(id, frame, groupId, contextActionId = null) {
  return {
    id,
    intent: {
      attackInput: {
        groupId,
        ...(contextActionId == null ? {} : { contextActionId }),
      },
    },
    schedule: { frame },
  };
}

function selection(actionId, controlSkillId, subSkillIndex) {
  return { actionId, controlSkillId, subSkillIndex };
}

function boundary(actionId, sourceActionId, expectedOffset, subSkillIndex) {
  return {
    actionId,
    sourceActionId,
    expectedOffset,
    expectedControlSkillId: 19900110,
    expectedSubSkillIndex: subSkillIndex,
  };
}
