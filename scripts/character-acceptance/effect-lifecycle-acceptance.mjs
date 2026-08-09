export function validateRightOpenLifecycleMatches(matches, { required } = {}) {
  if (required !== true) return true;
  return (
    Array.isArray(matches) &&
    matches.length > 0 &&
    matches.every(match => match?.passed === true)
  );
}
