export const WORKBENCH_LAYOUT_SCHEMA_VERSION = 1;
export const WORKBENCH_LAYOUT_STORAGE_KEY =
  'promilia-axis-tool:workbench-layout:v1';

export const WORKBENCH_LAYOUT_MODES = Object.freeze({
  BALANCED: 'balanced',
  EDIT: 'edit',
  REVIEW: 'review',
  CUSTOM: 'custom',
});

export const WORKBENCH_LAYOUT_LIMITS = Object.freeze({
  leftMinWidth: 220,
  leftMaxWidth: 380,
  rightMinWidth: 260,
  rightMaxWidth: 420,
  defaultLeftWidth: 260,
  defaultRightWidth: 300,
});

export function createDefaultWorkbenchLayoutState() {
  return {
    schemaVersion: WORKBENCH_LAYOUT_SCHEMA_VERSION,
    mode: WORKBENCH_LAYOUT_MODES.BALANCED,
    leftPanelWidth: WORKBENCH_LAYOUT_LIMITS.defaultLeftWidth,
    rightPanelWidth: WORKBENCH_LAYOUT_LIMITS.defaultRightWidth,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
  };
}

export function normalizeWorkbenchLayoutState(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    schemaVersion: WORKBENCH_LAYOUT_SCHEMA_VERSION,
    mode: normalizeWorkbenchLayoutMode(source.mode),
    leftPanelWidth: clampLayoutWidth(
      source.leftPanelWidth,
      WORKBENCH_LAYOUT_LIMITS.leftMinWidth,
      WORKBENCH_LAYOUT_LIMITS.leftMaxWidth,
      WORKBENCH_LAYOUT_LIMITS.defaultLeftWidth
    ),
    rightPanelWidth: clampLayoutWidth(
      source.rightPanelWidth,
      WORKBENCH_LAYOUT_LIMITS.rightMinWidth,
      WORKBENCH_LAYOUT_LIMITS.rightMaxWidth,
      WORKBENCH_LAYOUT_LIMITS.defaultRightWidth
    ),
    leftPanelCollapsed: source.leftPanelCollapsed === true,
    rightPanelCollapsed: source.rightPanelCollapsed === true,
  };
}

export function applyWorkbenchLayoutMode(state, mode) {
  const normalized = normalizeWorkbenchLayoutState(state);
  const nextMode = normalizeWorkbenchLayoutMode(mode);
  if (nextMode === WORKBENCH_LAYOUT_MODES.EDIT) {
    return {
      ...normalized,
      mode: nextMode,
      leftPanelCollapsed: false,
      rightPanelCollapsed: true,
    };
  }
  if (nextMode === WORKBENCH_LAYOUT_MODES.REVIEW) {
    return {
      ...normalized,
      mode: nextMode,
      leftPanelCollapsed: true,
      rightPanelCollapsed: false,
    };
  }
  return {
    ...normalized,
    mode: WORKBENCH_LAYOUT_MODES.BALANCED,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
  };
}

export function toggleWorkbenchLayoutPanel(state, panel) {
  const normalized = normalizeWorkbenchLayoutState(state);
  if (panel === 'left') {
    return {
      ...normalized,
      mode: WORKBENCH_LAYOUT_MODES.CUSTOM,
      leftPanelCollapsed: !normalized.leftPanelCollapsed,
    };
  }
  if (panel === 'right') {
    return {
      ...normalized,
      mode: WORKBENCH_LAYOUT_MODES.CUSTOM,
      rightPanelCollapsed: !normalized.rightPanelCollapsed,
    };
  }
  return normalized;
}

export function resizeWorkbenchLayoutPanel(state, panel, width) {
  const normalized = normalizeWorkbenchLayoutState(state);
  if (panel === 'left') {
    return normalizeWorkbenchLayoutState({
      ...normalized,
      leftPanelWidth: width,
    });
  }
  if (panel === 'right') {
    return normalizeWorkbenchLayoutState({
      ...normalized,
      rightPanelWidth: width,
    });
  }
  return normalized;
}

export function resizeWorkbenchLayoutPanelFromPointer(
  state,
  {
    panel,
    startWidth,
    deltaX,
    containerWidth,
    mainMinWidth = 560,
    horizontalPadding = 28,
    resizerWidth = 14,
  } = {}
) {
  const requestedWidth =
    panel === 'left'
      ? Number(startWidth) + Number(deltaX)
      : Number(startWidth) - Number(deltaX);
  const limits = createWorkbenchLayoutPanelLimits(state, {
    panel,
    containerWidth,
    mainMinWidth,
    horizontalPadding,
    resizerWidth,
  });
  return resizeWorkbenchLayoutPanel(
    state,
    panel,
    Math.min(limits.max, Math.max(limits.min, requestedWidth))
  );
}

export function nudgeWorkbenchLayoutPanel(
  state,
  { panel, direction = 0, containerWidth, step = 16 } = {}
) {
  const normalized = normalizeWorkbenchLayoutState(state);
  const currentWidth =
    panel === 'left' ? normalized.leftPanelWidth : normalized.rightPanelWidth;
  const panelDirection = panel === 'left' ? direction : -direction;
  const limits = createWorkbenchLayoutPanelLimits(normalized, {
    panel,
    containerWidth,
  });
  return resizeWorkbenchLayoutPanel(
    normalized,
    panel,
    Math.min(
      limits.max,
      Math.max(limits.min, currentWidth + panelDirection * step)
    )
  );
}

export function createWorkbenchLayoutPanelLimits(
  state,
  {
    panel,
    containerWidth,
    mainMinWidth = 560,
    horizontalPadding = 28,
    resizerWidth = 14,
  } = {}
) {
  const normalized = normalizeWorkbenchLayoutState(state);
  const isLeft = panel === 'left';
  const minimum = isLeft
    ? WORKBENCH_LAYOUT_LIMITS.leftMinWidth
    : WORKBENCH_LAYOUT_LIMITS.rightMinWidth;
  const maximum = isLeft
    ? WORKBENCH_LAYOUT_LIMITS.leftMaxWidth
    : WORKBENCH_LAYOUT_LIMITS.rightMaxWidth;
  const width = Number(containerWidth);
  if (!Number.isFinite(width) || width <= 0) {
    return { min: minimum, max: maximum };
  }
  const otherPanelWidth = isLeft
    ? normalized.rightPanelCollapsed
      ? 0
      : normalized.rightPanelWidth
    : normalized.leftPanelCollapsed
      ? 0
      : normalized.leftPanelWidth;
  const visibleResizerCount =
    Number(!normalized.leftPanelCollapsed) +
    Number(!normalized.rightPanelCollapsed);
  const available =
    width -
    horizontalPadding -
    otherPanelWidth -
    visibleResizerCount * resizerWidth -
    mainMinWidth;
  return {
    min: minimum,
    max: Math.max(minimum, Math.min(maximum, Math.floor(available))),
  };
}

export function loadWorkbenchLayoutState(storage) {
  if (!storage?.getItem) {
    return createDefaultWorkbenchLayoutState();
  }
  try {
    const raw = storage.getItem(WORKBENCH_LAYOUT_STORAGE_KEY);
    return raw
      ? normalizeWorkbenchLayoutState(JSON.parse(raw))
      : createDefaultWorkbenchLayoutState();
  } catch {
    return createDefaultWorkbenchLayoutState();
  }
}

export function saveWorkbenchLayoutState(storage, state) {
  const normalized = normalizeWorkbenchLayoutState(state);
  if (!storage?.setItem) {
    return null;
  }
  try {
    storage.setItem(WORKBENCH_LAYOUT_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

function normalizeWorkbenchLayoutMode(value) {
  return Object.values(WORKBENCH_LAYOUT_MODES).includes(value)
    ? value
    : WORKBENCH_LAYOUT_MODES.BALANCED;
}

function clampLayoutWidth(value, min, max, fallback) {
  const number = Number(value);
  return Math.round(
    Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback))
  );
}
