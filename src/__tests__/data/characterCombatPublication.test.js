import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createCharacterCombatPublicationPlan,
  detectCharacterCombatPublicationDrift,
  selectCharacterCombatPublicationRecords,
  writeCharacterCombatOutputsAtomically,
} from '../../../scripts/character-combat/character-combat-publication.mjs';

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('character combat owner publication', () => {
  it('preserves owner A through owner B staging and the later all publication', () => {
    const root = createTemporaryRoot();
    const ownerA = createOwnerRecords(101010, 'xiaoyu-v1');
    const ownerB = createOwnerRecords(424242, 'synthetic-v1');
    const globalRecords = [
      ...ownerA,
      ...ownerB,
      {
        relativePath:
          'src/data/generated/character-combat-profile-catalog.json',
        content: `${JSON.stringify({
          profiles: [{ ownerId: 101010 }, { ownerId: 424242 }],
        })}\n`,
      },
    ];

    publishRecords({ root, records: globalRecords, ownerId: 101010 });
    publishRecords({ root, records: globalRecords, ownerId: 424242 });
    expect(readProfile(root, 101010)).toContain('xiaoyu-v1');
    expect(readProfile(root, 424242)).toContain('synthetic-v1');
    expect(
      fs.existsSync(
        path.join(
          root,
          'src',
          'data',
          'generated',
          'character-combat-profile-catalog.json'
        )
      )
    ).toBe(false);

    publishRecords({ root, records: globalRecords });
    expect(readProfile(root, 101010)).toContain('xiaoyu-v1');
    expect(readProfile(root, 424242)).toContain('synthetic-v1');
    const catalog = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          'src',
          'data',
          'generated',
          'character-combat-profile-catalog.json'
        ),
        'utf8'
      )
    );
    expect(catalog.profiles.map(item => item.ownerId)).toEqual([
      101010, 424242,
    ]);

    const repeatPlan = createCharacterCombatPublicationPlan({
      records: globalRecords,
      outputRoot: root,
    });
    expect(detectCharacterCombatPublicationDrift(repeatPlan)).toEqual([]);
  });

  it('leaves every published file untouched when an atomic commit fails', () => {
    const root = createTemporaryRoot();
    const initialRecords = [
      {
        relativePath: 'reports/m10/101010/source-manifest.json',
        content: 'old-source\n',
      },
      {
        relativePath: 'reports/m10/101010/runtime-coverage.json',
        content: 'old-runtime\n',
      },
    ];
    publishRecords({ root, records: initialRecords });
    const changedRecords = initialRecords.map(record => ({
      ...record,
      content: record.content.replace('old', 'new'),
    }));
    const plan = createCharacterCombatPublicationPlan({
      records: changedRecords,
      outputRoot: root,
    });

    expect(() =>
      writeCharacterCombatOutputsAtomically(plan, {
        beforeCommit: () => {
          throw new Error('synthetic generation failure');
        },
      })
    ).toThrow('synthetic generation failure');
    expect(
      fs.readFileSync(
        path.join(root, initialRecords[0].relativePath),
        'utf8'
      )
    ).toBe('old-source\n');
    expect(
      fs.readFileSync(
        path.join(root, initialRecords[1].relativePath),
        'utf8'
      )
    ).toBe('old-runtime\n');
  });
});

function createTemporaryRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'azpr-character-combat-publication-')
  );
  temporaryRoots.push(root);
  return root;
}

function createOwnerRecords(ownerId, marker) {
  return [
    {
      relativePath: `src/data/generated/character-combat-owner-contracts/${ownerId}.json`,
      content: `${JSON.stringify({ ownerId, marker, kind: 'contract' })}\n`,
    },
    {
      relativePath: `src/data/generated/character-combat-profiles/${ownerId}.json`,
      content: `${JSON.stringify({ ownerId, marker, kind: 'profile' })}\n`,
    },
    {
      relativePath: `reports/m10/${ownerId}/summary.md`,
      content: `${ownerId}:${marker}\n`,
    },
  ];
}

function publishRecords({ root, records, ownerId = null }) {
  const selected = selectCharacterCombatPublicationRecords({
    records,
    ownerId,
  });
  const plan = createCharacterCombatPublicationPlan({
    records: selected,
    outputRoot: root,
  });
  writeCharacterCombatOutputsAtomically(plan);
}

function readProfile(root, ownerId) {
  return fs.readFileSync(
    path.join(
      root,
      'src',
      'data',
      'generated',
      'character-combat-profiles',
      `${ownerId}.json`
    ),
    'utf8'
  );
}
