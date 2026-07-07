import attributes from './generated/attributes.json';
import characters from './generated/characters.json';
import elements from './generated/elements.json';
import enemies from './generated/enemies.json';
import equipment from './generated/equipment.json';
import kibos from './generated/kibos.json';
import manifest from './generated/manifest.json';
import mediaIndex from './generated/media-index.json';
import skillLogicIndex from './generated/skill-logic-index.json';
import skillLevelCrossCheck from './generated/skill-level-crosscheck.json';
import skills from './generated/skills.json';
import soulessences from './generated/soulessences.json';
import validationReport from './generated/validation-report.json';

const generatedTables = {
  attributes,
  characters,
  elements,
  enemies,
  equipment,
  kibos,
  skills,
  soulessences,
};

export const azprGeneratedData = Object.freeze({
  manifest,
  validationReport,
  mediaIndex,
  skillLogicIndex,
  skillLevelCrossCheck,
  tables: generatedTables,
});

export function getAzprGeneratedManifest() {
  return manifest;
}

export function getAzprValidationReport() {
  return validationReport;
}

export function getAzprSkillLevelCrossCheck() {
  return skillLevelCrossCheck;
}

export function getAzprSkillLogicIndex() {
  return skillLogicIndex;
}

export function getAzprElements() {
  return elements.items;
}

export function getAzprCharacters() {
  return characters.items;
}

export function getAzprCharacterById(id) {
  return characters.items.find((character) => character.id === Number(id)) ?? null;
}

export function getAzprSkills() {
  return skills.items;
}

export function getAzprSkillById(id) {
  return skills.items.find((skill) => skill.id === Number(id)) ?? null;
}

export function getAzprSkillsByCharacterId(characterId) {
  return skills.items.filter((skill) => skill.characterId === Number(characterId));
}

export function getAzprEnemies() {
  return enemies.items;
}

export function getAzprEnemyById(id) {
  return enemies.items.find((enemy) => enemy.id === Number(id)) ?? null;
}

export function getAzprKibos() {
  return kibos.items;
}

export function getAzprEquipment() {
  return equipment.items;
}

export function getAzprSoulessences() {
  return soulessences.items;
}

export function getAzprAttributes() {
  return attributes.items;
}

export function findAzprMediaByFileName(fileName) {
  return mediaIndex.items.filter((item) => item.fileName === fileName);
}
