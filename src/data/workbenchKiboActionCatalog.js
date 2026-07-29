const catalogUrl = new URL(
  './generated/workbench-kibo-action-catalog.json',
  import.meta.url
);

export async function loadWorkbenchKiboActionCatalog(fetchImpl = fetch) {
  const response = await fetchImpl(catalogUrl);
  if (!response.ok) {
    throw new Error(`Unable to load kibo action catalog: ${response.status}`);
  }
  const catalog = await response.json();
  return projectWorkbenchKiboActionCatalog(catalog);
}

export function projectWorkbenchKiboActionCatalog(catalog) {
  if (
    catalog?.schemaVersion !== 2 ||
    catalog?.kind !== 'workbench-kibo-action-catalog' ||
    !Array.isArray(catalog.items)
  ) {
    throw new Error('Invalid Workbench kibo action catalog');
  }
  const seenKibos = new Set();
  const seenActions = new Set();
  const items = catalog.items.map((item, itemIndex) => {
    const kiboId = positiveIntegerOrNull(item?.kiboId);
    if (!kiboId || seenKibos.has(kiboId) || !Array.isArray(item?.actions)) {
      throw new Error(
        `Invalid Workbench kibo action catalog item ${itemIndex}`
      );
    }
    seenKibos.add(kiboId);
    return {
      ...item,
      kiboId,
      actions: item.actions.map((action, actionIndex) => {
        const skillId = positiveIntegerOrNull(action?.skillId);
        const kind = String(action?.kind ?? '').trim();
        const actionIdentity = `${kiboId}:${kind}:${skillId}`;
        if (
          !skillId ||
          !['signature', 'active', 'break'].includes(kind) ||
          seenActions.has(actionIdentity)
        ) {
          throw new Error(
            `Invalid Workbench kibo action ${itemIndex}.${actionIndex}`
          );
        }
        seenActions.add(actionIdentity);
        return { ...action, skillId, kind };
      }),
    };
  });
  return { ...catalog, items };
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
