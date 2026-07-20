export const AZPR_INPUT_COMMAND_PROFILE_SCHEMA_VERSION = 1;
export const AZPR_PC_DEFAULT_INPUT_PROFILE_ID =
  'azpr-pc-default-input-profile-2026-07-20';

const CLIENT_GUIDE_SOURCE = Object.freeze({
  sourceKind: 'azpr-client-guide-input-binding',
  status: 'verified-client-input-binding',
  confidence: 'high',
});

const PROJECT_DEFAULT_SOURCE = Object.freeze({
  sourceKind: 'azpr-project-default-input-binding',
  status: 'project-default-input-binding',
  confidence: 'medium',
});

export const AZPR_PC_DEFAULT_INPUT_PROFILE = Object.freeze({
  schemaVersion: AZPR_INPUT_COMMAND_PROFILE_SCHEMA_VERSION,
  profileId: AZPR_PC_DEFAULT_INPUT_PROFILE_ID,
  platform: 'pc',
  commands: Object.freeze({
    'normal-attack': createBinding({
      command: 'normal-attack',
      keyCode: 'Mouse0',
      keyLabel: 'LMB',
      sourceIdentity:
        'ResourcesLang/chs/Table/lang_guide_pic.json[id=433791697920].content',
    }),
    'charged-attack': createBinding({
      command: 'charged-attack',
      keyCode: 'Mouse0',
      keyLabel: 'LMB',
      defaultMode: 'hold',
      sourceIdentity:
        'ResourcesLang/chs/Table/lang_guide_pic.json[id=12030203397120].content',
    }),
    'dodge-attack': createBinding({
      command: 'dodge-attack',
      keyCode: 'Mouse0',
      keyLabel: 'LMB',
      sourceIdentity: 'project-default/pc/contextual-attack',
      source: PROJECT_DEFAULT_SOURCE,
    }),
    'plunging-attack': createBinding({
      command: 'plunging-attack',
      keyCode: 'Mouse0',
      keyLabel: 'LMB',
      sourceIdentity: 'project-default/pc/contextual-attack',
      source: PROJECT_DEFAULT_SOURCE,
    }),
    'star-skill': createBinding({
      command: 'skill',
      keyCode: 'KeyE',
      keyLabel: 'E',
      sourceIdentity:
        'ResourcesLang/chs/Table/lang_words.json[text=E键释放星鸣技]',
    }),
    ultimate: createBinding({
      command: 'ultimate',
      keyCode: 'KeyR',
      keyLabel: 'R',
      sourceIdentity:
        'ResourcesLang/chs/Table/lang_words.json[text=R键释放星决技]',
    }),
    'kibo-skill': createBinding({
      command: 'kibo-skill',
      keyCode: 'KeyQ',
      keyLabel: 'Q',
      sourceIdentity:
        'ResourcesLang/chs/Table/lang_words.json[text=Q键释放奇波技能]',
    }),
    'limit-counter': createBinding({
      command: 'limit-counter',
      keyCode: 'Mouse0',
      keyLabel: 'LMB',
      sourceIdentity:
        'ResourcesLang/chs/Table/lang_guide_pic.json[id=6451040879616].content',
    }),
    'perfect-parry': createBinding({
      command: 'perfect-parry',
      keyCode: 'Mouse1',
      keyLabel: 'RMB',
      sourceIdentity:
        'ResourcesLang/chs/Table/lang_guide_pic.json[id=10746008175616].content',
    }),
    switch: Object.freeze({
      command: 'switch',
      keyCodePattern: 'Digit{slot}',
      keyLabelPattern: '{slot}',
      defaultMode: 'press',
      sourceKind: 'azpr-team-slot-input-binding',
      sourceIdentity: 'project-team-slot-order/slots[1..3]',
      status: 'verified-project-team-slot-input-binding',
      confidence: 'high',
    }),
  }),
});

export function resolveAzPrActionInputBinding(action = {}) {
  if (
    action.type === 'kiboEvent' &&
    Number.isInteger(Number(action.skillId)) &&
    Number(action.skillId) > 0
  ) {
    return AZPR_PC_DEFAULT_INPUT_PROFILE.commands['kibo-skill'];
  }
  if (action.type !== 'skill') return null;
  return AZPR_PC_DEFAULT_INPUT_PROFILE.commands[action.actionKind] ?? null;
}

export function resolveAzPrSwitchInputBinding({
  action = {},
  actors = [],
} = {}) {
  const slotIndex = actors.findIndex(
    actor =>
      String(actor?.id ?? '') === String(action.targetActorId ?? '') ||
      Number(actor?.characterId) === Number(action.targetCharacterId)
  );
  if (slotIndex < 0 || slotIndex > 2) return null;
  const slot = slotIndex + 1;
  const binding = AZPR_PC_DEFAULT_INPUT_PROFILE.commands.switch;
  return {
    ...binding,
    slot,
    keyCode: binding.keyCodePattern.replace('{slot}', String(slot)),
    keyLabel: binding.keyLabelPattern.replace('{slot}', String(slot)),
  };
}

function createBinding({
  command,
  keyCode,
  keyLabel,
  defaultMode = 'press',
  sourceIdentity,
  source = CLIENT_GUIDE_SOURCE,
}) {
  return Object.freeze({
    command,
    keyCode,
    keyLabel,
    defaultMode,
    sourceIdentity,
    ...source,
  });
}
