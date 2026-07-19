import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ActionRuleDiagnosticsPanel from '../../features/workbench/ActionRuleDiagnosticsPanel.vue';
import { ACTION_RULE_CODES } from '../../simulation/runtime/actionRuleDiagnostics';

describe('ActionRuleDiagnosticsPanel', () => {
  it('locates rule actions and applies only confirmed suggested timing fixes', async () => {
    const cooldown = {
      id: 'cooldown-action-2',
      code: ACTION_RULE_CODES.SKILL_COOLDOWN_ACTIVE,
      status: 'violated',
      severity: 'error',
      actionId: 'action-2',
      actionIds: ['action-1', 'action-2'],
      actionName: '星鸣技',
      actorName: '末音',
      message: '星鸣技 尚有 12000ms 冷却',
      readyAtMs: 17000,
      suggestedStartMs: 17000,
      source: {
        fieldPath: 'skillsub_logic.rows[skillId=10900112].coolDown',
      },
    };
    const unresolvedSp = {
      id: 'sp-action-3',
      code: ACTION_RULE_CODES.SKILL_SP_PRECONDITION_UNRESOLVED,
      status: 'unresolved',
      severity: 'warning',
      actionId: 'action-3',
      actionIds: ['action-3'],
      actionName: '星决技',
      actorName: '末音',
      message: '星决技 需要 SP 100，当前 50/100',
      requiredSp: 100,
      actorInitialSp: 50,
      actorMaxSp: 100,
      suggestedStartMs: null,
    };
    const wrapper = mount(ActionRuleDiagnosticsPanel, {
      props: {
        diagnostics: {
          executable: false,
          diagnostics: [cooldown, unresolvedSp],
          summary: {
            violationCount: 1,
            unresolvedCount: 1,
            affectedActionCount: 2,
          },
        },
        selectedActionId: 'action-2',
      },
    });

    expect(
      wrapper.find('[data-testid="workbench-action-rule-panel"]').attributes()
    ).toMatchObject({
      'data-executable': 'false',
      'data-violation-count': '1',
      'data-unresolved-count': '1',
    });
    expect(
      wrapper.findAll('[data-testid="workbench-action-rule-row"]')
    ).toHaveLength(2);
    expect(
      wrapper.findAll('[data-testid="workbench-action-rule-apply-start"]')
    ).toHaveLength(1);

    await wrapper
      .find('[data-testid="workbench-action-rule-locate"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="workbench-action-rule-apply-start"]')
      .trigger('click');

    expect(wrapper.emitted('locate-action')?.[0]).toEqual([cooldown]);
    expect(wrapper.emitted('apply-suggested-start')?.[0]).toEqual([cooldown]);
    expect(wrapper.text()).toContain('移至 1020F');
    expect(wrapper.text()).toContain('需要 SP 100，当前 50/100');
    expect(wrapper.text()).not.toContain('0-1');
  });
});
