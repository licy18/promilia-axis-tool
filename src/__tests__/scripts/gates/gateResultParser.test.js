import { describe, expect, it } from 'vitest';

import {
  createNpmStageTracker,
  parseGateResult,
  parsePlaywrightOutput,
  parseVitestOutput,
} from '../../../../scripts/gates/gate-result-parser.mjs';

describe('gate result parser', () => {
  it('parses only counts actually printed by Vitest', () => {
    const parsed = parseVitestOutput(`
 Test Files  2 failed | 8 passed (10)
      Tests  3 failed | 37 passed (40)
   Duration  1.23s
`);

    expect(parsed).toEqual({
      summary: {
        filesPassed: 8,
        filesFailed: 2,
        filesTotal: 10,
        testsPassed: 37,
        testsFailed: 3,
        testsTotal: 40,
        runnerDuration: '1.23s',
      },
      reportParseStatus: 'complete',
    });
  });

  it('parses Playwright totals without turning missing output into a pass', () => {
    expect(parsePlaywrightOutput('  64 passed (12.4s)')).toEqual({
      summary: {
        testsPassed: 64,
        testsFailed: 0,
        testsSkipped: 0,
        testsTotal: 64,
        runnerDuration: '12.4s',
      },
      reportParseStatus: 'complete',
    });
    expect(parseGateResult('vitest', 'process exited 0')).toEqual({
      summary: null,
      reportParseStatus: 'unavailable',
    });
  });

  it('tracks the real npm script headers observed in an aggregate release', () => {
    let timestamp = Date.parse('2026-08-11T00:00:00.000Z');
    const tracker = createNpmStageTracker({
      now: () => {
        timestamp += 100;
        return timestamp;
      },
    });
    tracker.observe('> promilia-axis-tool@0.1.0 test:full');
    tracker.observe('vitest run');
    tracker.observe('> promilia-axis-tool@0.1.0 audit:bundle:check');
    const stageTimeline = tracker.finish();
    const parsed = parseGateResult(
      'trial-release',
      'Test Files  2 passed (2)\nTests  5 passed (5)',
      { stageTimeline }
    );

    expect(parsed.summary.observedScripts).toEqual([
      'test:full',
      'audit:bundle:check',
    ]);
    expect(parsed.summary.testFull.testsTotal).toBe(5);
    expect(stageTimeline).toHaveLength(2);
  });
});
