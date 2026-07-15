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
const kiboCooldownBySkillId = new Map(
  (actionStatusCatalog.kiboCooldowns ?? []).map(cooldown => [
    Number(cooldown.skillId),
    cooldown,
  ])
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
  return kiboCooldownBySkillId.get(Number(skillId)) ?? null;
}

function createKiboCooldownIdentity(kiboId, skillId) {
  return `${Number(kiboId) || 0}|${Number(skillId) || 0}`;
}
