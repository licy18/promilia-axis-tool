import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_LAYOUT_MODES,
  WORKBENCH_LAYOUT_STORAGE_KEY,
  applyWorkbenchLayoutMode,
  createDefaultWorkbenchLayoutState,
  loadWorkbenchLayoutState,
  nudgeWorkbenchLayoutPanel,
  normalizeWorkbenchLayoutState,
  resizeWorkbenchLayoutPanel,
  resizeWorkbenchLayoutPanelFromPointer,
  saveWorkbenchLayoutState,
  toggleWorkbenchLayoutPanel,
} from '../../domain/workbenchLayout';

describe('workbench layout', () => {
  it('normalizes widths and applies complete editing and review modes', () => {
    expect(
      normalizeWorkbenchLayoutState({
        mode: 'unknown',
        leftPanelWidth: 999,
        rightPanelWidth: 10,
        leftPanelCollapsed: true,
      })
    ).toEqual({
      schemaVersion: 1,
      mode: WORKBENCH_LAYOUT_MODES.BALANCED,
      leftPanelWidth: 380,
      rightPanelWidth: 260,
      leftPanelCollapsed: true,
      rightPanelCollapsed: false,
    });

    const editing = applyWorkbenchLayoutMode(
      createDefaultWorkbenchLayoutState(),
      WORKBENCH_LAYOUT_MODES.EDIT
    );
    expect(editing).toMatchObject({
      mode: 'edit',
      leftPanelCollapsed: false,
      rightPanelCollapsed: true,
    });
    expect(
      applyWorkbenchLayoutMode(editing, WORKBENCH_LAYOUT_MODES.REVIEW)
    ).toMatchObject({
      mode: 'review',
      leftPanelCollapsed: true,
      rightPanelCollapsed: false,
    });
  });

  it('toggles and resizes panels without touching project state', () => {
    const toggled = toggleWorkbenchLayoutPanel(
      createDefaultWorkbenchLayoutState(),
      'left'
    );
    expect(toggled).toMatchObject({
      mode: 'custom',
      leftPanelCollapsed: true,
    });
    expect(resizeWorkbenchLayoutPanel(toggled, 'right', 390)).toMatchObject({
      rightPanelWidth: 390,
      leftPanelCollapsed: true,
    });
    expect(
      resizeWorkbenchLayoutPanelFromPointer(
        createDefaultWorkbenchLayoutState(),
        {
          panel: 'left',
          startWidth: 260,
          deltaX: 80,
          containerWidth: 1400,
        }
      ).leftPanelWidth
    ).toBe(340);
    expect(
      nudgeWorkbenchLayoutPanel(createDefaultWorkbenchLayoutState(), {
        panel: 'right',
        direction: -1,
        containerWidth: 1400,
      }).rightPanelWidth
    ).toBe(316);
  });

  it('persists one versioned local layout and recovers from invalid data', () => {
    const storage = createMemoryStorage();
    const saved = saveWorkbenchLayoutState(storage, {
      mode: 'review',
      leftPanelWidth: 310,
      rightPanelWidth: 360,
      leftPanelCollapsed: true,
      rightPanelCollapsed: false,
    });

    expect(JSON.parse(storage.getItem(WORKBENCH_LAYOUT_STORAGE_KEY))).toEqual(
      saved
    );
    expect(loadWorkbenchLayoutState(storage)).toEqual(saved);

    storage.setItem(WORKBENCH_LAYOUT_STORAGE_KEY, '{bad-json');
    expect(loadWorkbenchLayoutState(storage)).toEqual(
      createDefaultWorkbenchLayoutState()
    );
  });
});

function createMemoryStorage() {
  const storage = new Map();
  storage.getItem = key => storage.get(key) ?? null;
  storage.setItem = (key, value) => storage.set(key, value);
  return storage;
}
