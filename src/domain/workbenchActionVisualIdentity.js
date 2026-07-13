import { AZPR_ACTION_KIND_LABELS } from './skillActionCatalog';
import { msToFrame } from './timebase';

const KIBO_ACTION_LABELS = {
  active: '主动技',
  break: '合击技',
  signature: '特性技',
};

export function resolveWorkbenchActionVisualIdentity(action = {}) {
  const actionKind = action.actionKind ?? action.kind ?? action.eventType ?? '';
  const name = action.name || action.label || '动作';
  return {
    name,
    typeLabel:
      AZPR_ACTION_KIND_LABELS[actionKind] ||
      KIBO_ACTION_LABELS[actionKind] ||
      name,
    durationFrames: Math.max(1, msToFrame(Number(action.durationMs) || 0)),
    iconUrl: resolveWorkbenchActionIconUrl(action.icon),
  };
}

export function resolveWorkbenchActionIconUrl(icon) {
  const fileName = String(icon ?? '');
  return /^[^/\\]+\.png$/i.test(fileName)
    ? `/assets/actions/${encodeURIComponent(fileName)}`
    : null;
}
