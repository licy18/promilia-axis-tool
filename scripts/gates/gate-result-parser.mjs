const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/gu;

export function stripAnsi(value) {
  return String(value ?? '').replace(ANSI_PATTERN, '');
}

export function parseGateResult(parser, output, options = {}) {
  switch (parser) {
    case 'vitest':
      return parseVitestOutput(output);
    case 'playwright':
      return parsePlaywrightOutput(output);
    case 'vite-build':
      return parseViteBuildOutput(output);
    case 'trial-release':
      return parseTrialReleaseOutput(output, options);
    case 'audit':
    case 'bundle':
    default:
      return { summary: null, reportParseStatus: 'unavailable' };
  }
}

export function parseVitestOutput(output) {
  const text = stripAnsi(output);
  const files = lastMatch(
    text,
    /Test Files\s+(?:(\d+) failed \|\s*)?(\d+) passed(?:\s+\((\d+)\))?/gu
  );
  const tests = lastMatch(
    text,
    /Tests\s+(?:(\d+) failed \|\s*)?(\d+) passed(?:\s+\((\d+)\))?/gu
  );
  const duration = lastMatch(text, /Duration\s+([^\r\n]+)/gu);
  if (!files && !tests) {
    return { summary: null, reportParseStatus: 'unavailable' };
  }
  const filesFailed = numberOrZero(files?.[1]);
  const filesPassed = numberOrNull(files?.[2]);
  const filesTotal =
    numberOrNull(files?.[3]) ?? addKnown(filesPassed, filesFailed);
  const testsFailed = numberOrZero(tests?.[1]);
  const testsPassed = numberOrNull(tests?.[2]);
  const testsTotal =
    numberOrNull(tests?.[3]) ?? addKnown(testsPassed, testsFailed);
  return {
    summary: {
      filesPassed,
      filesFailed,
      filesTotal,
      testsPassed,
      testsFailed,
      testsTotal,
      runnerDuration: duration?.[1]?.trim() ?? null,
    },
    reportParseStatus: 'complete',
  };
}

export function parsePlaywrightOutput(output) {
  const text = stripAnsi(output);
  const passed = lastMatch(text, /^\s*(\d+) passed\s+\(([^\r\n)]+)\)/gmu);
  const failed = lastMatch(text, /^\s*(\d+) failed(?:\s|$)/gmu);
  const skipped = lastMatch(text, /^\s*(\d+) skipped(?:\s|$)/gmu);
  if (!passed && !failed) {
    return { summary: null, reportParseStatus: 'unavailable' };
  }
  const testsPassed = numberOrZero(passed?.[1]);
  const testsFailed = numberOrZero(failed?.[1]);
  const testsSkipped = numberOrZero(skipped?.[1]);
  return {
    summary: {
      testsPassed,
      testsFailed,
      testsSkipped,
      testsTotal: testsPassed + testsFailed + testsSkipped,
      runnerDuration: passed?.[2]?.trim() ?? null,
    },
    reportParseStatus: 'complete',
  };
}

export function parseViteBuildOutput(output) {
  const text = stripAnsi(output);
  const modules = lastMatch(text, /[✓✔]\s*(\d+) modules transformed\./gu);
  const duration = lastMatch(text, /built in\s+([^\r\n]+)/gu);
  if (!modules) {
    return { summary: null, reportParseStatus: 'unavailable' };
  }
  return {
    summary: {
      modulesTransformed: Number(modules[1]),
      runnerDuration: duration?.[1]?.trim() ?? null,
    },
    reportParseStatus: 'complete',
  };
}

export function parseTrialReleaseOutput(output, { stageTimeline = [] } = {}) {
  const vitest = parseVitestOutput(output);
  const playwright = parsePlaywrightOutput(output);
  const vite = parseViteBuildOutput(output);
  const observedScripts = [
    ...new Set(stageTimeline.map(stage => stage.script).filter(Boolean)),
  ];
  const hasAnySummary =
    vitest.summary != null ||
    playwright.summary != null ||
    vite.summary != null ||
    stageTimeline.length > 0;
  return {
    summary: hasAnySummary
      ? {
          testFull: vitest.summary,
          productionPreview: playwright.summary,
          productionBuild: vite.summary,
          observedScripts,
          stageTimeline,
        }
      : null,
    reportParseStatus: hasAnySummary ? 'complete' : 'unavailable',
  };
}

export function createNpmStageTracker({ now = () => Date.now() } = {}) {
  const stages = [];
  let current = null;
  return {
    observe(line) {
      const clean = stripAnsi(line).trim();
      const match = /^>\s+\S+@\S+\s+([^\s]+)$/u.exec(clean);
      if (!match) return;
      const timestamp = now();
      if (current) finishCurrent(timestamp);
      current = {
        script: match[1],
        startedAt: new Date(timestamp).toISOString(),
        startedAtMs: timestamp,
      };
    },
    finish() {
      if (current) finishCurrent(now());
      return stages.map(publicStage);
    },
    snapshot() {
      return stages.map(publicStage);
    },
  };

  function finishCurrent(timestamp) {
    stages.push({
      ...current,
      finishedAt: new Date(timestamp).toISOString(),
      durationMs: Math.max(0, timestamp - current.startedAtMs),
    });
    current = null;
  }
}

function publicStage(value) {
  const stage = { ...value };
  delete stage.startedAtMs;
  return stage;
}

export function inferFailedStage(stageTimeline, fallback = 'unknown') {
  return stageTimeline.at(-1)?.script ?? fallback;
}

function lastMatch(text, pattern) {
  let found = null;
  for (const match of text.matchAll(pattern)) found = match;
  return found;
}

function numberOrNull(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  return numberOrNull(value) ?? 0;
}

function addKnown(left, right) {
  return left == null ? null : left + right;
}
