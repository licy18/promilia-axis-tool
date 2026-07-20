const diagnosticsUrl = new URL(
  '../../data/generated/workbench-skill-diagnostics.json',
  import.meta.url
);

let diagnosticsPromise = null;

export function getWorkbenchSkillDiagnostics(fetchImpl = fetch) {
  if (!diagnosticsPromise) {
    diagnosticsPromise = fetchImpl(diagnosticsUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(
            `Unable to load workbench skill diagnostics: ${response.status}`
          );
        }
        return response.json();
      })
      .catch(error => {
        diagnosticsPromise = null;
        throw error;
      });
  }
  return diagnosticsPromise;
}
