import { compileProject } from './compiler/compileProject';
import { simulateScenario } from './engine/simulateScenario';

export { compileProject, CompileProjectError } from './compiler/compileProject';
export { simulateScenario } from './engine/simulateScenario';
export { DAMAGE_FORMULA_VERSION, parsePercentMultiplier, parseDamageSegments } from './mechanics/damage';
export { projectSimulationResult } from './projection/projectSimulationResult';
export { createThreeValueGenerationBundle } from './generation/threeValueGenerationBuilder';

export function runSimulation(project, gameData) {
  return simulateScenario(compileProject(project, gameData));
}
