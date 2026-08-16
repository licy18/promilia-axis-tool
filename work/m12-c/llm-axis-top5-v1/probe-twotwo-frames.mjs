// 诊断 twoTwo case：列出 isolated-consumer-two-two 的 damage 事件实际帧号
import { createServer } from 'vite';

const vite = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const genModule = await vite.ssrLoadModule(
    '/scripts/generate-character-acceptance.mjs'
  );
  const serviceModule = await vite.ssrLoadModule('/src/machine-axis/machineAxisService.js');
  const pkgModule = await vite.ssrLoadModule('/src/data/verifiedCombatMechanicsPackage.js');
  const fs = await import('node:fs');
  const pkg = JSON.parse(
    fs.readFileSync('src/data/generated/verified-combat-mechanics-package.json', 'utf8')
  );
  pkgModule.installVerifiedCombatMechanicsPackage(pkg);

  const fixture = JSON.parse(
    fs.readFileSync('fixtures/character-acceptance/112001-visual.json', 'utf8')
  );
  const profile = JSON.parse(
    fs.readFileSync('src/data/generated/character-combat-profiles/112001.json', 'utf8')
  );
  const recipe = JSON.parse(
    fs.readFileSync('scripts/character-acceptance/acceptance-recipes/112001.json', 'utf8')
  );
  const service = serviceModule.createMachineAxisService();

  const twoTwoCase = (recipe.isolatedActionCases ?? []).find(
    c => c.identity === 'ultimate-consumer-two-two-prefers-thunder-and-settles-order'
  );
  // 手动执行 isolated case 拿原始 trace
  const contract = structuredClone(fixture);
  contract.actions = structuredClone(twoTwoCase.actions);
  contract.scenario.id += '--isolated--' + twoTwoCase.identity;
  for (const key of ['team', 'initialRuntimeState', 'enemy', 'target', 'critical', 'projectile']) {
    if (twoTwoCase[key] != null) contract.scenario[key] = structuredClone(twoTwoCase[key]);
  }
  const run = service.simulate(contract);
  const damage = run.trace?.damage ?? [];
  console.log('TOTAL damage events:', damage.length);
  for (const e of damage) {
    console.log(
      '  f:', e.absoluteFrame ?? e.frame,
      '| action:', e.actionId,
      '| type:', e.eventType,
      '| el:', e.elementId,
      '| hp:', e.effectiveHpDamage ?? e.rawDamage,
      '| brk:', e.breakTriggered,
      '| inBrk:', e.inBreakForHpDamage,
      '| st:', e.formula?.status
    );
  }
  const judgments = run.trace?.state?.tuningConsumeJudgments ?? [];
  console.log('tuning judgments:');
  for (const j of judgments.filter(j => j.actionId === 'isolated-consumer-two-two')) {
    console.log(
      '  f:', j.triggerFrame,
      '| mark:', j.markId,
      '| count:', j.consumedCount,
      '| status:', j.status,
      '| priority:', j.selectedPriorityCandidate?.markId,
      '| packetEl:', j.selectedPriorityCandidate?.packetElementId
    );
  }
  // 韧性/break 状态
  console.log('toughness events:');
  for (const t of run.trace?.toughness ?? []) {
    if (t.actionId === 'isolated-consumer-two-two') {
      console.log('  f:', t.absoluteFrame ?? t.frame, '| before:', t.before, '| after:', t.after, '| broke:', t.breakTriggered);
    }
  }
} finally {
  await vite.close();
}
