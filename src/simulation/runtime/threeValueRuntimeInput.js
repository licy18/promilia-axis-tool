import {
  ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
  createActionHitThreeValueRuntimeInput,
} from './actionHitThreeValueRuntimeInput';

export {
  ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
  createActionHitThreeValueRuntimeInput,
};

export function createThreeValueRuntimeInput(options = {}) {
  return createActionHitThreeValueRuntimeInput(options);
}
