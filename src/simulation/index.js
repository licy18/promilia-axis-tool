import { compileProject } from './compiler/compileProject';
import { simulateScenario } from './engine/simulateScenario';

export { compileProject, CompileProjectError } from './compiler/compileProject';
export { simulateScenario } from './engine/simulateScenario';
export {
  ACTION_EXECUTION_PLAN_CONTRACT_NAME,
  ACTION_EXECUTION_STATUSES,
  createActionExecutionPlan,
} from './engine/actionExecutionPlan';
export {
  DAMAGE_FORMULA_VERSION,
  parsePercentMultiplier,
  parseDamageSegments,
} from './mechanics/damage';
export { projectSimulationResult } from './projection/projectSimulationResult';
export {
  createThreeValueGenerationBundle,
  validateStandardGenerationEntryContract,
} from './generation/threeValueGenerationBuilder';
export { createActionHitThreeValueDeltaGeneration } from './generation/actionHitThreeValueDeltaGeneration';
export {
  ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
  createActionHitThreeValueRuntimeInput,
  createThreeValueRuntimeInput,
} from './runtime/threeValueRuntimeInput';

export function runSimulation(project, gameData) {
  return simulateScenario(compileProject(project, gameData));
}
