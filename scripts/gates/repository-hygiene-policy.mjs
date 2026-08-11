import { normalizeRepositoryPath } from './git-change-classifier.mjs';

export const GENERATOR_OWNED_OUTPUT_PREFIXES = Object.freeze([
  'reports/',
  'src/data/generated/',
]);

export function isGeneratorOwnedOutput(file) {
  const normalized = normalizeRepositoryPath(file);
  return GENERATOR_OWNED_OUTPUT_PREFIXES.some(prefix =>
    normalized.startsWith(prefix)
  );
}
