import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');

const readJson = async file =>
  JSON.parse(await fs.readFile(path.join(projectRoot, file), 'utf8'));

function readArgument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const contractPath = readArgument('--contract');
const objective = readArgument('--objective');
const guidanceJson = readArgument('--guidance');
const guidanceFile = readArgument('--guidance-file');
const optionsJson = readArgument('--options');
const feedbackOutput = readArgument('--feedback-output');

if (!contractPath) {
  throw new Error('--contract <path> is required');
}

const loadedContract = await readJson(contractPath);
const contract = loadedContract?.contract ?? loadedContract;
const guidance = guidanceJson
  ? JSON.parse(guidanceJson)
  : guidanceFile
    ? await readJson(guidanceFile)
    : null;
const options = optionsJson ? JSON.parse(optionsJson) : {};
if (objective) options.objective = objective;
if (guidance) options.guidance = guidance;

const mechanicsPackage = await readJson(
  'src/data/generated/verified-combat-mechanics-package.json'
);
const vite = await createServer({
  root: projectRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const packageModule = await vite.ssrLoadModule(
    '/src/data/verifiedCombatMechanicsPackage.js'
  );
  const serviceModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisService.js'
  );
  const engineModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisSearchEngine.js'
  );
  const guidanceModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisSearchGuidance.js'
  );

  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const service = serviceModule.createMachineAxisService();
  const engine = engineModule.createMachineAxisSearchEngine({ service });
  const result = await engine.search({ contract, options });

  const guidanceApplication =
    guidance == null
      ? null
      : guidanceModule.applySearchGuidance(options, guidance);
  const feedback = guidanceModule.createSearchFeedback({
    result,
    guidanceApplication,
  });
  if (feedbackOutput) {
    await fs.writeFile(
      path.join(projectRoot, feedbackOutput),
      `${JSON.stringify(feedback, null, 2)}\n`,
      'utf8'
    );
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        objective: result.summary?.objective,
        guidanceHash: result.summary?.guidance?.guidanceHash ?? null,
        appliedRules: result.summary?.guidance?.appliedRules ?? [],
        summary: result.summary,
        topResultCount: result.results?.length ?? 0,
        topScores: (result.results ?? []).map(
          entry => entry.score ?? entry.formalScore ?? null
        ),
        issueCount: result.issues?.length ?? 0,
        feedbackOutput: feedbackOutput ?? null,
      },
      null,
      2
    )}\n`
  );
} finally {
  await vite.close();
}
