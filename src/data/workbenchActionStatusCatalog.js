import actionStatusCatalog from './generated/workbench-action-status-catalog.json';

const effectCandidatesBySkillId = new Map();
for (const candidate of actionStatusCatalog.effectCandidates ?? []) {
  const skillId = Number(candidate.skillId);
  const candidates = effectCandidatesBySkillId.get(skillId) ?? [];
  candidates.push(candidate);
  effectCandidatesBySkillId.set(skillId, candidates);
}

const kiboCooldownByIdentity = new Map(
  (actionStatusCatalog.kiboCooldowns ?? []).map(cooldown => [
    createKiboCooldownIdentity(cooldown.kiboId, cooldown.skillId),
    cooldown,
  ])
);
const kiboCooldownsBySkillId = new Map();
for (const cooldown of actionStatusCatalog.kiboCooldowns ?? []) {
  const skillId = Number(cooldown.skillId);
  const entries = kiboCooldownsBySkillId.get(skillId) ?? [];
  entries.push(cooldown);
  kiboCooldownsBySkillId.set(skillId, entries);
}
const unambiguousKiboCooldownBySkillId = new Map(
  [...kiboCooldownsBySkillId.entries()]
    .filter(([, entries]) => entries.length === 1)
    .map(([skillId, entries]) => [skillId, entries[0]])
);

export function getWorkbenchActionStatusCatalog() {
  return actionStatusCatalog;
}

export function getWorkbenchActionStatusEffectCandidates(skillId) {
  return effectCandidatesBySkillId.get(Number(skillId)) ?? [];
}

export function getWorkbenchKiboActionStatusCooldown(kiboId, skillId) {
  const normalizedKiboId = Number(kiboId);
  if (Number.isFinite(normalizedKiboId) && normalizedKiboId > 0) {
    return (
      kiboCooldownByIdentity.get(
        createKiboCooldownIdentity(normalizedKiboId, skillId)
      ) ?? null
    );
  }
  return unambiguousKiboCooldownBySkillId.get(Number(skillId)) ?? null;
}

function createKiboCooldownIdentity(kiboId, skillId) {
  return `${Number(kiboId) || 0}|${Number(skillId) || 0}`;
}
