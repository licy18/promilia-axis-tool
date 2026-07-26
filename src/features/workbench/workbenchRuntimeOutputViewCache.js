import { createWorkbenchRuntimeOutputConsumerView } from './runtimeProjectionPoints';

const runtimeOutputViewCache = new WeakMap();

export function getCachedWorkbenchRuntimeOutputConsumerView(runtimeProjection) {
  return getRuntimeOutputCacheEntry(runtimeProjection).consumerView;
}

export function getCachedWorkbenchRuntimeDerivedView(
  runtimeProjection,
  cacheKey,
  createView
) {
  if (!isObject(runtimeProjection)) {
    return createView();
  }
  const entry = getRuntimeOutputCacheEntry(runtimeProjection);
  if (!entry.derivedViews.has(cacheKey)) {
    entry.derivedViews.set(cacheKey, createView(entry.consumerView));
  }
  return entry.derivedViews.get(cacheKey);
}

function getRuntimeOutputCacheEntry(runtimeProjection) {
  if (!isObject(runtimeProjection)) {
    return {
      consumerView: createWorkbenchRuntimeOutputConsumerView(runtimeProjection),
      derivedViews: new Map(),
    };
  }
  let entry = runtimeOutputViewCache.get(runtimeProjection);
  if (!entry) {
    entry = {
      consumerView: createWorkbenchRuntimeOutputConsumerView(runtimeProjection),
      derivedViews: new Map(),
    };
    runtimeOutputViewCache.set(runtimeProjection, entry);
  }
  return entry;
}

function isObject(value) {
  return Boolean(value && typeof value === 'object');
}
