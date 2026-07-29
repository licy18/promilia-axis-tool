import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installVerifiedCombatMechanicsPackage } from '../src/data/verifiedCombatMechanicsPackage';
import { runMachineAxisCli } from '../src/machine-axis/machineAxisCli';

const root = process.env.AZPR_AXIS_ROOT
  ? resolve(process.env.AZPR_AXIS_ROOT)
  : process.cwd();
const mechanicsPackage = JSON.parse(
  await readFile(
    resolve(root, 'src/data/generated/verified-combat-mechanics-package.json'),
    'utf8'
  )
);
installVerifiedCombatMechanicsPackage(mechanicsPackage);
const exitCode = await runMachineAxisCli(process.argv.slice(2), {
  readFile: path => readFile(resolve(root, path), 'utf8'),
  readStdin: async () => {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  },
  writeFile: (path, value) => writeFile(resolve(root, path), value, 'utf8'),
  writeStdout: value => process.stdout.write(value),
  writeStderr: value => process.stderr.write(value),
});
process.exitCode = exitCode;
