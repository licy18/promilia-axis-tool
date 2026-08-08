import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
import manifest from '../../data/generated/runtime-capture-hook-manifest.json';

let agentSource;

beforeAll(async () => {
  agentSource = await readFile(
    'runtime-capture/frida/azpr-runtime-capture-agent.js',
    'utf8'
  );
});

describe('controlled Frida runtime capture agent', () => {
  it.each([
    ['role-sp', {}, 6],
    ['kibo-energy', { slotId: 'team-slot-1', kiboId: 500001 }, 1],
    ['toughness', {}, 25],
    ['all', { slotId: 'team-slot-1', kiboId: 500001 }, 32],
  ])('installs only the %s hook scope', (captureKind, owner, hookCount) => {
    const harness = createAgentHarness();
    const result = harness.rpc.exports.startcapture({
      manifest,
      captureSessionId: `test-${captureKind}`,
      captureKind,
      actionId: 'action-0001',
      actorId: 'actor-109001',
      targetId: 'enemy-300032',
      ...owner,
    });

    expect(result).toMatchObject({
      status: 'capture-agent-started',
      captureKind,
      installedHookCount: hookCount,
    });
    expect(harness.listeners).toHaveLength(hookCount);
    expect(harness.statuses.at(-1)).toMatchObject({
      channel: 'capture-status',
      status: 'capture-agent-started',
      captureKind,
      installedHookCount: hookCount,
    });
  });

  it('keeps all as the legacy default and rejects incomplete kibo scope', () => {
    const harness = createAgentHarness();
    expect(
      harness.rpc.exports.startcapture({
        manifest,
        captureSessionId: 'legacy-all',
        actionId: 'action-0001',
        actorId: 'actor-109001',
        targetId: 'enemy-300032',
      })
    ).toMatchObject({ captureKind: 'all', installedHookCount: 31 });
    harness.rpc.exports.stopcapture();
    expect(harness.listeners.every(listener => listener.detached)).toBe(true);

    expect(() =>
      harness.rpc.exports.startcapture({
        manifest,
        captureSessionId: 'missing-kibo-owner',
        captureKind: 'kibo-energy',
      })
    ).toThrow('kibo-energy capture requires slotId and a positive kiboId');
  });

  it('keeps a monotonic client-frame ordering envelope in capture records', () => {
    expect(agentSource).toContain('captureSequence');
    expect(agentSource).toContain('clientFrameCount');
    expect(agentSource).toContain('clientDeltaTimeSeconds');
    expect(agentSource).toContain('eventIdentity');
    expect(agentSource).toContain('sourceSequencePath');
    expect(agentSource).toContain('hookInvocationIdentity');
    expect(agentSource).toContain('finalCaptureSequence');
    expect(agentSource).toContain('openThreadStateCount');
    expect(agentSource).toContain('FormulaUtility.GetOutputDamage');
    expect(agentSource).toContain('ControlProperty.SetWeakState');
    expect(agentSource).toContain('UpdateWeakBreakEnd');
    expect(agentSource).toContain('AliveProperty.SetHpByHurt');
  });
});

function createAgentHarness() {
  const listeners = [];
  const statuses = [];
  const rpc = { exports: {} };
  const context = vm.createContext({
    rpc,
    Process: {
      platform: 'windows',
      arch: 'x64',
      getModuleByName(name) {
        return {
          name,
          path: `C:/controlled/${name}`,
          base: createPointer(0x180000000),
          size: 1,
        };
      },
      getCurrentThreadId() {
        return 1;
      },
    },
    Interceptor: {
      attach(address) {
        const listener = {
          address,
          detached: false,
          detach() {
            this.detached = true;
          },
        };
        listeners.push(listener);
        return listener;
      },
    },
    ptr(value) {
      return createPointer(Number(value));
    },
    send(payload) {
      statuses.push(payload);
    },
  });
  vm.runInContext(agentSource, context, {
    filename: 'azpr-runtime-capture-agent.js',
  });
  return { rpc, listeners, statuses };
}

function createPointer(value) {
  return {
    value,
    add(offset) {
      return createPointer(this.value + Number(offset));
    },
    toString() {
      return `0x${this.value.toString(16)}`;
    },
  };
}
