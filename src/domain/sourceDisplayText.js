const REPLACEMENT_CHARACTER_PATTERN = /\uFFFD/u;
const COMMON_MOJIBAKE_PATTERN =
  /(?:ï¿½|锟斤拷|(?:Ã|Â)[\u0080-\u00ff]|â(?:€|™|œ|ž|“|”|‘|’))/u;

export const SOURCE_NAME_STATUSES = Object.freeze({
  READY: 'source-name-ready',
  MISSING: 'source-name-missing',
  CORRUPT: 'corrupt-source-encoding',
});

export function inspectSourceDisplayText(value) {
  const rawText = typeof value === 'string' ? value.trim() : '';
  if (!rawText) {
    return {
      rawText,
      displayable: false,
      status: SOURCE_NAME_STATUSES.MISSING,
    };
  }
  const corrupt =
    REPLACEMENT_CHARACTER_PATTERN.test(rawText) ||
    COMMON_MOJIBAKE_PATTERN.test(rawText);
  return {
    rawText,
    displayable: !corrupt,
    status: corrupt ? SOURCE_NAME_STATUSES.CORRUPT : SOURCE_NAME_STATUSES.READY,
  };
}

export function isSourceDisplayTextSafe(value) {
  return inspectSourceDisplayText(value).displayable;
}

export function resolveSafeSourceDisplayText(value, fallback = '') {
  const inspection = inspectSourceDisplayText(value);
  return inspection.displayable ? inspection.rawText : String(fallback);
}

export function createCombatSourceDisplayLabel({
  sourceText,
  referenceKind = '',
  sequence = 1,
  sourceIdentity,
} = {}) {
  const inspection = inspectSourceDisplayText(sourceText);
  const normalizedSequence = Math.max(1, Number(sequence) || 1);
  const normalizedKind = String(referenceKind).toLowerCase();
  const fallback = normalizedKind.includes('bullet')
    ? `弹体 ${normalizedSequence}`
    : normalizedKind.includes('nested') ||
        normalizedKind.includes('additional') ||
        normalizedKind.includes('follow')
      ? `追加命中 ${normalizedSequence}`
      : `命中 ${normalizedSequence}`;
  return {
    displayLabel: inspection.displayable ? inspection.rawText : fallback,
    rawSourceName: inspection.rawText,
    sourceNameStatus: inspection.status,
    ...(sourceIdentity == null ? {} : { sourceIdentity }),
  };
}

export function createEffectSourceDisplayLabel({
  sourceText,
  sequence = 1,
  sourceIdentity,
  effectKind = '',
} = {}) {
  const inspection = inspectSourceDisplayText(sourceText);
  const normalizedSequence = Math.max(1, Number(sequence) || 1);
  const normalizedKind = String(effectKind).toLowerCase();
  const fallback =
    normalizedKind === 'damage'
      ? `追加命中 ${normalizedSequence}`
      : `状态效果 ${normalizedSequence}`;
  return {
    displayLabel: inspection.displayable
      ? normalizeAzPrEffectTerminology(inspection.rawText)
      : fallback,
    rawSourceName: inspection.rawText,
    sourceNameStatus: inspection.status,
    ...(sourceIdentity == null ? {} : { sourceIdentity }),
  };
}

export function createBattlePropertyEffectDisplayLabel({
  sourceText,
  sequence = 1,
  sourceIdentity,
  effectKind = '',
  attributeId,
  targetKind,
} = {}) {
  const display = createEffectSourceDisplayLabel({
    sourceText,
    sequence,
    sourceIdentity,
    effectKind,
  });
  if (Number(attributeId) !== 229) return display;

  const targetLabel =
    targetKind === 'team-actors'
      ? '全队调谐强度提升'
      : ['controlled-actor', 'controlling-actor'].includes(targetKind)
        ? '主控角色调谐强度提升'
        : '调谐强度提升';
  return {
    ...display,
    displayLabel: targetLabel,
  };
}

function normalizeAzPrEffectTerminology(value) {
  return String(value)
    .replace(/精通(?:强度)?/gu, '调谐强度')
    .replace(/调谐提升/gu, '调谐强度提升');
}
