import { mount } from '@vue/test-utils';
import SkillBlock from '@/components/timeline/SkillBlock.vue';

// Mock Vue Use Core
jest.mock('@vueuse/core', () => ({
  useThrottleFn: (fn) => fn
}));

describe('SkillBlock Component', () => {
  const mockSkillBlock = {
    id: 'test-skill-1',
    instanceId: 'test-instance-1',
    characterId: 'character-1',
    skillId: 'skill-1',
    name: '测试技能',
    startTime: 60,
    duration: 120,
    type: 'skill',
    element: 'blaze',
    cooldown: 180,
    damageTicks: [
      { offset: 30, multiplier: 1.5, element: 'blaze' },
      { offset: 90, multiplier: 2.0, element: 'blaze' }
    ],
    physicalAnomaly: [
      [
        { type: 'burning', offset: 10, duration: 100, stacks: 2, _id: 'anomaly-1' }
      ]
    ],
    triggerWindow: 30,
    enhancementTime: 60
  };

  const defaultProps = {
    skillBlock: mockSkillBlock,
    scale: 2,
    isSelected: false,
    elementColor: '#409EFF'
  };

  it('renders correctly with basic props', () => {
    const wrapper = mount(SkillBlock, { props: defaultProps });
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.skill-name').text()).toBe('测试技能');
  });

  it('displays CD bar when cooldown is greater than 0', () => {
    const wrapper = mount(SkillBlock, { props: defaultProps });
    expect(wrapper.find('.cd-bar-container').exists()).toBe(true);
  });

  it('does not display CD bar when cooldown is 0', () => {
    const props = {
      ...defaultProps,
      skillBlock: { ...mockSkillBlock, cooldown: 0 }
    };
    const wrapper = mount(SkillBlock, { props });
    expect(wrapper.find('.cd-bar-container').exists()).toBe(false);
  });

  it('displays enhancement bar for ultimate skills', () => {
    const props = {
      ...defaultProps,
      skillBlock: { ...mockSkillBlock, type: 'ultimate' }
    };
    const wrapper = mount(SkillBlock, { props });
    expect(wrapper.find('.cd-bar-container:nth-child(2)').exists()).toBe(true);
  });

  it('displays damage ticks correctly', () => {
    const wrapper = mount(SkillBlock, { props: defaultProps });
    const ticks = wrapper.findAll('.damage-tick-wrapper');
    expect(ticks.length).toBe(2);
  });

  it('displays anomaly (buff) bars correctly', () => {
    const wrapper = mount(SkillBlock, { props: defaultProps });
    expect(wrapper.find('.anomaly-wrapper').exists()).toBe(true);
    expect(wrapper.find('.anomaly-duration-bar').exists()).toBe(true);
  });

  it('displays trigger window bar when triggerWindow is set', () => {
    const wrapper = mount(SkillBlock, { props: defaultProps });
    expect(wrapper.find('.trigger-window-bar').exists()).toBe(true);
  });

  it('emits select event when clicked', async () => {
    const wrapper = mount(SkillBlock, { props: defaultProps });
    await wrapper.trigger('click');
    expect(wrapper.emitted('select')).toBeTruthy();
    expect(wrapper.emitted('select')[0]).toEqual(['test-skill-1']);
  });

  it('emits edit event when double-clicked', async () => {
    const wrapper = mount(SkillBlock, { props: defaultProps });
    await wrapper.trigger('dblclick');
    expect(wrapper.emitted('edit')).toBeTruthy();
    expect(wrapper.emitted('edit')[0]).toEqual(['test-skill-1']);
  });

  it('applies correct styles based on skill type', () => {
    // Test ultimate skill
    const ultimateProps = {
      ...defaultProps,
      skillBlock: { ...mockSkillBlock, type: 'ultimate' }
    };
    const ultimateWrapper = mount(SkillBlock, { props: ultimateProps });
    expect(ultimateWrapper.classes()).toContain('skill-block-wrapper');

    // Test link skill
    const linkProps = {
      ...defaultProps,
      skillBlock: { ...mockSkillBlock, type: 'link' }
    };
    const linkWrapper = mount(SkillBlock, { props: linkProps });
    expect(linkWrapper.classes()).toContain('skill-block-wrapper');
  });

  it('applies selected style when isSelected is true', () => {
    const props = {
      ...defaultProps,
      isSelected: true
    };
    const wrapper = mount(SkillBlock, { props });
    expect(wrapper.classes()).toContain('is-selected');
  });

  it('applies disabled style when skill is disabled', () => {
    const props = {
      ...defaultProps,
      skillBlock: { ...mockSkillBlock, isDisabled: true }
    };
    const wrapper = mount(SkillBlock, { props });
    expect(wrapper.classes()).toContain('is-disabled');
  });

  it('applies locked style when skill is locked', () => {
    const props = {
      ...defaultProps,
      skillBlock: { ...mockSkillBlock, isLocked: true }
    };
    const wrapper = mount(SkillBlock, { props });
    expect(wrapper.classes()).toContain('is-locked');
  });
});
