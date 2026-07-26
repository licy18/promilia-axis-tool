import { describe, expect, it, vi } from 'vitest';
import {
  getCachedWorkbenchRuntimeDerivedView,
  getCachedWorkbenchRuntimeOutputConsumerView,
} from '../../features/workbench/workbenchRuntimeOutputViewCache';

describe('workbenchRuntimeOutputViewCache', () => {
  it('reuses consumer and derived views for one immutable runtime result', () => {
    const runtimeProjection = {
      sourceKind: 'azpr-three-value-runtime-projection',
      simLog: [],
      stateCurves: [],
    };
    const firstConsumer =
      getCachedWorkbenchRuntimeOutputConsumerView(runtimeProjection);
    const secondConsumer =
      getCachedWorkbenchRuntimeOutputConsumerView(runtimeProjection);
    const createDerived = vi.fn(consumerView => ({
      consumerView,
      id: 'derived',
    }));
    const firstDerived = getCachedWorkbenchRuntimeDerivedView(
      runtimeProjection,
      'resource-series:120000',
      createDerived
    );
    const secondDerived = getCachedWorkbenchRuntimeDerivedView(
      runtimeProjection,
      'resource-series:120000',
      createDerived
    );

    expect(secondConsumer).toBe(firstConsumer);
    expect(secondDerived).toBe(firstDerived);
    expect(secondDerived.consumerView).toBe(firstConsumer);
    expect(createDerived).toHaveBeenCalledTimes(1);
  });

  it('does not share projections across different runtime result identities', () => {
    const first = getCachedWorkbenchRuntimeOutputConsumerView({
      sourceKind: 'azpr-three-value-runtime-projection',
      simLog: [],
      stateCurves: [],
    });
    const second = getCachedWorkbenchRuntimeOutputConsumerView({
      sourceKind: 'azpr-three-value-runtime-projection',
      simLog: [],
      stateCurves: [],
    });

    expect(second).not.toBe(first);
  });
});
