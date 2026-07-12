import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_CAPABILITIES = [
  'routes-and-assets',
  'diagnostics-lazy-load',
  'json-project-exchange',
  'profile-compatibility-gate',
  'game-data-compatibility-gate',
  'action-skill-compatibility-gate',
  'applied-source-binding-guard',
  'stage-9a-timeline-topology',
  'stage-9b-runtime-step-curves',
  'stage-9c-timeline-first-workspace',
  'stage-10a-multitrack-editing',
  'stage-10b-cross-lane-batch-editing',
  'stage-10c-frame-cursor-review',
  'png-project-exchange',
  'project-drop-recovery',
  'configuration-instances',
  'multi-action-editing',
  'timeline-relations',
  'effect-interval-review',
  'scenario-comparison',
  'cycle-sections',
  'cycle-inheritance',
  'workspace-scenarios',
  'workspace-layout',
  'narrow-main-flow',
];

export default class ProductionPreviewReporter {
  constructor(options = {}) {
    this.outputFile = path.resolve(
      process.cwd(),
      options.outputFile ?? 'reports/production-preview-acceptance.json'
    );
    this.startedAt = new Date();
    this.tests = [];
  }

  onTestEnd(test, result) {
    this.tests.push({
      capability: readCapability(test.title),
      title: test.title,
      status: result.status,
      durationMs: result.duration,
      retry: result.retry,
      errors: result.errors.map(error => error.message ?? String(error)),
    });
  }

  async onEnd(result) {
    const finishedAt = new Date();
    const capabilities = REQUIRED_CAPABILITIES.map(capability => {
      const tests = this.tests.filter(test => test.capability === capability);
      return {
        capability,
        status:
          tests.length > 0 && tests.every(test => test.status === 'passed')
            ? 'passed'
            : tests.length === 0
              ? 'missing'
              : 'failed',
        testCount: tests.length,
      };
    });
    const trialReady =
      result.status === 'passed' &&
      capabilities.every(capability => capability.status === 'passed');
    const report = {
      schemaVersion: 1,
      kind: 'production-preview-acceptance',
      generatedAt: finishedAt.toISOString(),
      environment: {
        platform: `${process.platform}-${process.arch}`,
        node: process.version,
        server: 'vite-preview',
        source: 'dist',
      },
      commands: {
        build: 'npm run build',
        acceptance: 'npm run test:e2e:production-preview',
      },
      decision: {
        status: trialReady ? 'trial-ready' : 'blocked',
        trialReady,
        reason: trialReady
          ? 'all-required-production-preview-capabilities-passed'
          : 'one-or-more-production-preview-capabilities-failed-or-missing',
      },
      summary: {
        requiredCapabilityCount: REQUIRED_CAPABILITIES.length,
        passedCapabilityCount: capabilities.filter(
          capability => capability.status === 'passed'
        ).length,
        testCount: this.tests.length,
        passedTestCount: this.tests.filter(test => test.status === 'passed')
          .length,
        playwrightStatus: result.status,
        durationMs: finishedAt.getTime() - this.startedAt.getTime(),
      },
      capabilities,
      tests: this.tests,
      limitations: [
        'validates the local production build served by vite preview',
        'does not validate a remote CDN, public hosting, or cache headers',
        'does not confirm final AzPr formulas or non-fixture runtime captures',
      ],
    };

    await mkdir(path.dirname(this.outputFile), { recursive: true });
    await writeFile(
      this.outputFile,
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
  }
}

function readCapability(title) {
  return /^\[([^\]]+)\]/.exec(title)?.[1] ?? '';
}
