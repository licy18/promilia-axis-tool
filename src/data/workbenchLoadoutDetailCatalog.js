let catalogSnapshot = null;
let catalogRequest = null;

export function getWorkbenchLoadoutDetailCatalogSnapshot() {
  return catalogSnapshot;
}

export function loadWorkbenchLoadoutDetailCatalog({ force = false } = {}) {
  if (force) {
    catalogSnapshot = null;
    catalogRequest = null;
  }
  if (catalogSnapshot) return Promise.resolve(catalogSnapshot);
  if (catalogRequest) return catalogRequest;

  catalogRequest = fetch(
    new URL(
      './generated/workbench-loadout-detail-catalog.json',
      import.meta.url
    )
  )
    .then(response => {
      if (!response.ok) {
        throw new Error(`培养资料载入失败（${response.status}）`);
      }
      return response.json();
    })
    .then(value => {
      catalogSnapshot = value;
      return value;
    })
    .catch(error => {
      catalogRequest = null;
      throw error;
    });

  return catalogRequest;
}
