export const WORKBENCH_FPS = 60;
export const WORKBENCH_FRAME_MS = 1000 / WORKBENCH_FPS;

export function msToFrame(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.round(number / WORKBENCH_FRAME_MS);
}

export function frameToMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return normalizeMs(number * WORKBENCH_FRAME_MS);
}

export function snapMsToFrame(value) {
  return frameToMs(msToFrame(value));
}

export function formatFrameTime(value) {
  const frames = msToFrame(value);
  const sign = frames < 0 ? '-' : '';
  const absFrames = Math.abs(frames);
  const seconds = Math.floor(absFrames / WORKBENCH_FPS);
  const remainFrames = absFrames % WORKBENCH_FPS;
  return `${sign}${seconds}s${remainFrames}f`;
}

function normalizeMs(value) {
  const rounded = Number(Number(value).toFixed(6));
  const integer = Math.round(rounded);
  return Math.abs(rounded - integer) < 0.000001 ? integer : rounded;
}
