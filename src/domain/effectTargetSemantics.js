const CONTROLLED_ACTOR_TARGET_KIND_ALIASES = new Set([
  'controlled-actor',
  'controlling-actor',
]);

export function isControlledActorEffectTargetKind(value) {
  return CONTROLLED_ACTOR_TARGET_KIND_ALIASES.has(String(value ?? '').trim());
}
