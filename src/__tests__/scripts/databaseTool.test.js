import { describe, expect, it } from 'vitest';
import {
  computeContentHash,
  validate,
} from '../../../scripts/database-tool.mjs';

describe('azpr editable game database tool', () => {
  it('validates the exported database schema and references', () => {
    const result = validate();
    expect(result).toMatchObject({
      valid: true,
      status: 'azpr-database-schema-valid',
      issues: [],
    });
    expect(result.counts).toMatchObject({
      characters: 20,
      skills: 120,
      kibos: 122,
      enemies: 208,
      actions: 648,
      effects: 415,
      formulas: 177,
    });
  });

  it('computes a stable 64-hex contentHash across calls', () => {
    const first = computeContentHash();
    const second = computeContentHash();
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('treats the database as value data (no correctness verification)', () => {
    // 数据库只做 schema/引用校验，不验证数值与客户端一致（见 DECOMPOSITION_PLAN 阶段 A）。
    const result = validate();
    expect(Object.keys(result)).not.toContain('clientParity');
    expect(result.issues).toEqual([]);
  });
});
