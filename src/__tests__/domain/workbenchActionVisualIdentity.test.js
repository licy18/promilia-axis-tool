import { describe, expect, it } from 'vitest';
import {
  resolveWorkbenchActionIconUrl,
  resolveWorkbenchActionVisualIdentity,
} from '../../domain/workbenchActionVisualIdentity';

describe('workbench action visual identity', () => {
  it('derives role and kibo identities from stable source fields', () => {
    expect(
      resolveWorkbenchActionVisualIdentity({
        type: 'skill',
        name: '普通攻击',
        actionKind: 'normal-attack',
        durationMs: 1000,
        icon: 'tex_icon_skill_109001_00.png',
      })
    ).toEqual({
      name: '普通攻击',
      typeLabel: '普通攻击',
      durationFrames: 60,
      iconUrl: '/assets/actions/tex_icon_skill_109001_00.png',
    });
    expect(
      resolveWorkbenchActionVisualIdentity({
        type: 'kiboEvent',
        name: '迅风刃',
        eventType: 'signature',
        durationMs: 1416.666667,
        icon: 'tex_icon_petskill_500001_02.png',
      })
    ).toMatchObject({
      name: '迅风刃',
      typeLabel: '特性技',
      durationFrames: 85,
      iconUrl: '/assets/actions/tex_icon_petskill_500001_02.png',
    });
  });

  it('rejects icon paths outside the published action asset directory', () => {
    expect(resolveWorkbenchActionIconUrl('../skill.png')).toBeNull();
    expect(resolveWorkbenchActionIconUrl('folder/skill.png')).toBeNull();
    expect(resolveWorkbenchActionIconUrl('skill.svg')).toBeNull();
  });
});
