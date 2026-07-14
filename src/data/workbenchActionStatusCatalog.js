import actionStatusCatalog from './generated/workbench-action-status-catalog.json';

const effectCandidatesBySkillId = new Map();
for (const candidate of actionStatusCatalog.effectCandidates ?? []) {
  const skillId = Number(candidate.skillId);
  const candidates = effectCandidatesBySkillId.get(skillId) ?? [];
  candidates.push(candidate);
  effectCandidatesBySkillId.set(skillId, candidates);
}

export function getWorkbenchActionStatusCatalog() {
  return actionStatusCatalog;
}

export function getWorkbenchActionStatusEffectCandidates(skillId) {
  return effectCandidatesBySkillId.get(Number(skillId)) ?? [];
}
