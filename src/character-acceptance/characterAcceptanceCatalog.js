import generatedCharacterAcceptanceCatalog from '../data/generated/character-acceptance-catalog.json';
import generatedManifestIndex from '../data/generated/character-acceptance-manifest-index.json';
import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';
import {
  CharacterAcceptanceError,
  validateCharacterAcceptanceManifestIndex,
} from './characterAcceptanceProtocol.js';

export const CHARACTER_ACCEPTANCE_CATALOG_SCHEMA_VERSION = 1;
export const CHARACTER_ACCEPTANCE_CATALOG_CONTRACT_NAME =
  'AzPrCharacterAcceptanceCatalog';

export function getCharacterAcceptanceCatalog() {
  return generatedCharacterAcceptanceCatalog;
}

export function getCharacterAcceptanceEntry(ownerId) {
  return (
    generatedCharacterAcceptanceCatalog.entries.find(
      entry => Number(entry.ownerId) === Number(ownerId)
    ) ?? null
  );
}

export function isCharacterOptimizationReady(ownerId) {
  return getCharacterAcceptanceEntry(ownerId)?.optimizationReady === true;
}

export function assertCharacterIsOptimizationReady(ownerId) {
  const catalogValidation = validateCharacterAcceptanceCatalog(
    generatedCharacterAcceptanceCatalog
  );
  if (!catalogValidation.valid) {
    throw new CharacterAcceptanceError(
      'character-acceptance-catalog-invalid',
      catalogValidation.issues
    );
  }
  const entry = getCharacterAcceptanceEntry(ownerId);
  if (!entry) {
    throw new CharacterAcceptanceError('character-acceptance-owner-unknown', [
      String(ownerId),
    ]);
  }
  if (entry.optimizationReady !== true) {
    throw new CharacterAcceptanceError('character-not-optimization-ready', [
      ...(entry.blockers ?? []),
    ]);
  }
  return entry;
}

export function validateCharacterAcceptanceCatalog(
  catalog,
  { publishedManifestIndex = generatedManifestIndex } = {}
) {
  const issues = [];
  if (catalog?.schemaVersion !== CHARACTER_ACCEPTANCE_CATALOG_SCHEMA_VERSION) {
    issues.push('character-acceptance-catalog-schema-version-invalid');
  }
  if (catalog?.contractName !== CHARACTER_ACCEPTANCE_CATALOG_CONTRACT_NAME) {
    issues.push('character-acceptance-catalog-contract-name-invalid');
  }
  if (!Array.isArray(catalog?.entries)) {
    issues.push('character-acceptance-catalog-entries-required');
  }
  const indexValidation = validateCharacterAcceptanceManifestIndex(
    publishedManifestIndex
  );
  for (const issue of indexValidation.issues) {
    issues.push('character-acceptance-catalog-manifest-index-invalid:' + issue);
  }
  if (catalog?.manifestIndexHash !== publishedManifestIndex?.indexHash) {
    issues.push('character-acceptance-catalog-manifest-index-hash-mismatch');
  }
  const ownerIds = new Set();
  for (const entry of catalog?.entries ?? []) {
    const ownerId = Number(entry?.ownerId);
    if (!Number.isInteger(ownerId) || ownerIds.has(ownerId)) {
      issues.push(`character-acceptance-catalog-owner-invalid:${ownerId}`);
    }
    ownerIds.add(ownerId);
    if (
      entry?.optimizationReady === true &&
      entry?.maturityState !== 'optimization-ready'
    ) {
      issues.push(
        `character-acceptance-catalog-ready-state-invalid:${ownerId}`
      );
    }
    const publishedEntry = (publishedManifestIndex?.entries ?? []).find(
      candidate => Number(candidate?.ownerId) === ownerId
    );
    if (
      !publishedEntry ||
      publishedEntry.manifestHash !== entry?.manifestHash ||
      publishedEntry.qualificationSubjectHash !==
        entry?.qualificationSubjectHash ||
      publishedEntry.sourceOfTruthHash !== entry?.sourceOfTruthHash ||
      publishedEntry.profileHash !== entry?.profileHash ||
      publishedEntry.catalogEntryHash !== hashCanonicalValue(entry)
    ) {
      issues.push(
        `character-acceptance-catalog-manifest-index-mismatch:${ownerId}`
      );
    }
  }
  for (const publishedEntry of publishedManifestIndex?.entries ?? []) {
    if (!ownerIds.has(Number(publishedEntry?.ownerId))) {
      issues.push(
        `character-acceptance-catalog-owner-missing:${Number(
          publishedEntry?.ownerId
        )}`
      );
    }
  }
  if (catalog && typeof catalog === 'object') {
    const copy = structuredClone(catalog);
    delete copy.catalogHash;
    if (catalog.catalogHash !== hashCanonicalValue(copy)) {
      issues.push('character-acceptance-catalog-hash-mismatch');
    }
  }
  return { valid: issues.length === 0, issues };
}
