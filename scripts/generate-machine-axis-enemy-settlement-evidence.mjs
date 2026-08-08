import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENEMY_TOUGHNESS_SETTLEMENT_EVIDENCE_RELATIVE_PATH,
  ENEMY_TOUGHNESS_SETTLEMENT_REPORT_RELATIVE_PATH,
  readEnemyToughnessSettlementEvidenceSource,
} from './machine-axis/enemy-toughness-settlement-evidence.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_GAME_ASSEMBLY =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
const DEFAULT_DUMP_CS =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';
const DEFAULT_SCRIPT_JSON =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/script.json';

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourcePath = path.resolve(
    options.source ??
      path.join(PROJECT_ROOT, ENEMY_TOUGHNESS_SETTLEMENT_EVIDENCE_RELATIVE_PATH)
  );
  const outputPath = path.resolve(
    options.output ??
      path.join(PROJECT_ROOT, ENEMY_TOUGHNESS_SETTLEMENT_REPORT_RELATIVE_PATH)
  );
  const source = await readEnemyToughnessSettlementEvidenceSource({
    sourcePath,
    gameAssemblyPath: path.resolve(
      options.gameAssembly ?? DEFAULT_GAME_ASSEMBLY
    ),
    il2CppDumpPath: path.resolve(options.dumpCs ?? DEFAULT_DUMP_CS),
    il2CppScriptPath: path.resolve(options.scriptJson ?? DEFAULT_SCRIPT_JSON),
    captureManifestPath: path.resolve(
      PROJECT_ROOT,
      'src/data/generated/runtime-capture-hook-manifest.json'
    ),
    projectRoot: PROJECT_ROOT,
  });
  const serialized = `${JSON.stringify(source.report, null, 2)}\n`;
  if (options.assertClean) {
    const current = await fs.readFile(outputPath, 'utf8').catch(() => null);
    if (current !== serialized) {
      throw new Error(
        `Machine Axis enemy settlement evidence report is stale: ${outputPath}`
      );
    }
  } else {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, serialized, 'utf8');
  }
  process.stdout.write(
    `${JSON.stringify({
      status: options.assertClean ? 'clean' : 'written',
      outputPath,
      reportHash: source.report.reportHash,
      formalReady: source.report.conclusion.formalReady,
      leavesOpen: source.report.conclusion.leavesOpen,
    })}\n`
  );
}

function parseArguments(args) {
  const options = { assertClean: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--assert-clean') {
      options.assertClean = true;
    } else if (argument === '--source') {
      options.source = args[++index];
    } else if (argument === '--output') {
      options.output = args[++index];
    } else if (argument === '--game-assembly') {
      options.gameAssembly = args[++index];
    } else if (argument === '--dump-cs') {
      options.dumpCs = args[++index];
    } else if (argument === '--script-json') {
      options.scriptJson = args[++index];
    } else if (argument === '--help') {
      process.stdout.write(
        'Usage: node scripts/generate-machine-axis-enemy-settlement-evidence.mjs [--assert-clean] [--source PATH] [--output PATH] [--game-assembly PATH] [--dump-cs PATH] [--script-json PATH]\n'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

await main();
