export const WORKBENCH_LOADOUT_DETAIL_CATALOG_KIND =
  'workbench-loadout-detail-catalog';
export const WORKBENCH_LOADOUT_DETAIL_CATALOG_VERSION = 1;

export function createWorkbenchLoadoutDetailProjection({
  generatedAt,
  sources = {},
  equipment = [],
  kibos = [],
  soulessences = [],
} = {}) {
  return {
    schemaVersion: WORKBENCH_LOADOUT_DETAIL_CATALOG_VERSION,
    kind: WORKBENCH_LOADOUT_DETAIL_CATALOG_KIND,
    generatedAt,
    sources,
    policy: {
      loadoutEffectsAppliedToCalculators: false,
      displayValuesAreSourceRecords: true,
    },
    counts: {
      equipment: equipment.length,
      kibos: kibos.length,
      soulessences: soulessences.length,
    },
    equipment: equipment.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      icon: item.icon,
      set: item.set,
      summary: [...(item.mainAttributes ?? []), ...(item.subAttributes ?? [])]
        .map(attribute => `${attribute.name} ${attribute.value}`)
        .join(' / '),
    })),
    kibos: kibos.map(kibo => ({
      id: kibo.id,
      name: kibo.name,
      icon: `tex_icon_pet_${kibo.id}.png`,
      fallbackIcon: kibo.skills?.[0]?.icon ?? '',
      summary: [
        kibo.element,
        kibo.stage,
        ...(kibo.tags ?? []),
        ...(kibo.skills ?? []).map(skill => skill.name),
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    soulessences: soulessences.map(item => ({
      id: item.id,
      name: item.name,
      icons: item.icons ?? {},
      profession: item.profession ? String(item.profession).trim() : null,
      summary: [
        item.rarity,
        item.profession,
        item.attribute,
        ...Object.entries(item.level80Stats ?? {}).map(
          ([name, value]) => `${name} ${value}`
        ),
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  };
}
