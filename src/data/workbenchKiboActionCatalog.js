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
  if (
    catalog?.schemaVersion !== 1 ||
    catalog?.kind !== 'workbench-kibo-action-catalog' ||
    !Array.isArray(catalog.items)
  ) {
    throw new Error('Invalid Workbench kibo action catalog');
  }
  return catalog;
}
