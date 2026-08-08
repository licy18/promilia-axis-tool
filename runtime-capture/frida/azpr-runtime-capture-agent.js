'use strict';

const listeners = [];
const threadStates = new Map();
let captureConfig = null;
let captureModule = null;
let methodByKey = new Map();
let fieldOffsetByKey = new Map();
let captureStartedAt = 0;
let emittedEventCount = 0;
let captureSequence = 0;
let frameCountFunction = null;
let deltaTimeFunction = null;

rpc.exports = {
  inspectmodule(moduleName) {
    const module = Process.getModuleByName(moduleName);
    return {
      name: module.name,
      path: module.path,
      base: module.base.toString(),
      size: module.size,
      platform: Process.platform,
      arch: Process.arch,
    };
  },

  startcapture(config) {
    stopCapture();
    if (Process.platform !== 'windows' || Process.arch !== 'x64') {
      throw new Error(
        `Unsupported runtime ${Process.platform}/${Process.arch}; expected windows/x64`
      );
    }
    const captureKind = normalizeCaptureKind(config.captureKind);
    if (
      captureKind === 'kibo-energy' &&
      (!config.slotId || !(Number(config.kiboId) > 0))
    ) {
      throw new Error(
        'kibo-energy capture requires slotId and a positive kiboId'
      );
    }
    captureConfig = { ...config, captureKind };
    captureModule = Process.getModuleByName(config.manifest.source.moduleName);
    methodByKey = new Map(
      config.manifest.methods.map(method => [method.key, method])
    );
    fieldOffsetByKey = new Map(
      config.manifest.fields.map(field => [field.key, parseHex(field.offset)])
    );
    captureStartedAt = Date.now();
    emittedEventCount = 0;
    captureSequence = 0;
    frameCountFunction = createManifestNativeFunction(
      'UnityEngine.Time.get_frameCount',
      'int',
      []
    );
    deltaTimeFunction = createManifestNativeFunction(
      'UnityEngine.Time.get_deltaTime',
      'float',
      []
    );

    if (captureKind === 'all' || captureKind === 'role-sp') {
      installRecoverSpHooks();
    }
    if (
      (captureKind === 'all' || captureKind === 'kibo-energy') &&
      captureConfig.slotId &&
      Number(captureConfig.kiboId) > 0
    ) {
      installKiboEnergyHooks();
    }
    if (captureKind === 'all' || captureKind === 'toughness') {
      installToughnessHooks();
    }
    sendStatus('capture-agent-started', {
      captureKind,
      moduleName: captureModule.name,
      moduleBase: captureModule.base.toString(),
      installedHookCount: listeners.length,
    });
    return {
      status: 'capture-agent-started',
      captureKind,
      installedHookCount: listeners.length,
      moduleName: captureModule.name,
      moduleBase: captureModule.base.toString(),
    };
  },

  startselftest(config) {
    stopCapture();
    captureConfig = config;
    captureStartedAt = Date.now();
    emittedEventCount = 0;
    captureSequence = 0;
    const kernel32 = Process.getModuleByName('kernel32.dll');
    const sleepAddress = kernel32.getExportByName('Sleep');
    listeners.push(
      Interceptor.attach(sleepAddress, {
        onEnter(args) {
          emitRecord({
            recordType: 'event',
            captureSessionId: captureConfig.captureSessionId,
            eventType: 'capture-agent-self-test-probe',
            timeMs: elapsedTimeMs(),
            requestedSleepMs: args[0].toUInt32(),
            threadId: Process.getCurrentThreadId(),
          });
        },
      })
    );
    return {
      status: 'capture-agent-self-test-started',
      installedHookCount: listeners.length,
      address: sleepAddress.toString(),
    };
  },

  stopcapture() {
    return stopCapture();
  },
};

function installKiboEnergyHooks() {
  attachMethod('PetEntity.PetUltimateCdTime', {
    onEnter(args) {
      const petData = readNativePointerField(args[0], 'PetEntity.data');
      const observedKiboId = readS32Field(
        petData,
        'BaseData.<configId>k__BackingField'
      );
      if (observedKiboId !== Number(captureConfig.kiboId)) {
        this.kiboObservation = null;
        return;
      }
      this.kiboObservation = {
        petEntityPointer: args[0].toString(),
        petEntityId: readS32Field(
          petData,
          'BaseData.<entityId>k__BackingField'
        ),
        observedKiboId,
        totalTimePointer: args[1],
      };
    },
    onLeave() {
      const observation = this.kiboObservation;
      if (!observation) {
        return;
      }
      const cdTime = readXmmFloat(this.context, 'xmm0');
      const totalTime = safeRead(
        () => roundNumber(observation.totalTimePointer.readFloat()),
        null
      );
      emitRecord({
        recordType: 'event',
        captureSessionId: captureConfig.captureSessionId,
        eventType: 'pet-ultimate-cooldown-observed',
        timeMs: elapsedTimeMs(),
        actionId: captureConfig.actionId,
        actorId: captureConfig.actorId,
        targetId: captureConfig.targetId,
        slotId: captureConfig.slotId,
        kiboId: observation.observedKiboId,
        petEntityPointer: observation.petEntityPointer,
        petEntityId: observation.petEntityId,
        api: 'PetUltimateCdTime',
        cdTime,
        totalTime,
        ready: cdTime != null ? cdTime <= 0 : null,
        threadId: Process.getCurrentThreadId(),
      });
    },
  });
}

function installRecoverSpHooks() {
  attachMethod('DamageElement.RecoverSP', {
    onEnter(args) {
      const state = getThreadState();
      const source = readDamageElementSource(args[0]);
      state.damageSources.push(source);
      this.source = source;
      emitCaptureEvent('recover-sp-source-read', source, {
        recoverSP: readS32Field(args[0], 'DamageElement.m_recoverSP'),
        petRecoverSP: readS32Field(args[0], 'DamageElement.m_petRecoverSP'),
        recoverInterval: readS32Field(
          args[0],
          'DamageElement.m_recoverInterval'
        ),
      });
    },
    onLeave() {
      const state = getThreadState();
      popExpected(state.damageSources, this.source);
      releaseThreadStateIfEmpty(state);
    },
  });

  installModifierPropertyHook(
    'AliveProperty.GetBattlePropertyCurrentValue',
    1,
    args => args[0].toString()
  );
  installModifierPropertyHook(
    'SnapshotPropertyManager.GetBattlePropertyCurrentValue',
    3,
    args => String(args[1].toInt32())
  );

  attachMethod('SPSystem.OnTransmit', {
    onEnter(args) {
      const state = getThreadState();
      const source = peek(state.damageSources);
      const transmitType = args[1].toInt32();
      if (!source || transmitType !== 0x12f) {
        this.captureTransmit = null;
        return;
      }

      const root = state.transmits.length === 0;
      const rootContext = root ? null : state.transmits[0];
      const runtimeArgs = readRecoverSpArgs(args[2]);
      const context = {
        root,
        source,
        runtimeArgs,
        receiverEntityId: readPointerField(args[0], 'SPSystem.m_entityHandle'),
        rebroadcastCount: 0,
      };
      if (rootContext) {
        rootContext.rebroadcastCount += 1;
      }
      state.transmits.push(context);
      this.captureTransmit = context;

      if (!root) {
        return;
      }
      emitCaptureEvent('recover-sp-args-built', source, {
        recoverSP: readS32Field(
          source.damageElement,
          'DamageElement.m_recoverSP'
        ),
        petRecoverSP: readS32Field(
          source.damageElement,
          'DamageElement.m_petRecoverSP'
        ),
        recoverInterval: readS32Field(
          source.damageElement,
          'DamageElement.m_recoverInterval'
        ),
        spgetup: source.modifierValues[105] ?? null,
        spgetupAtk: source.modifierValues[228] ?? null,
        args: runtimeArgs,
      });
      emitCaptureEvent('recover-sp-ontransmit-12f', source, {
        receiverEntityId: context.receiverEntityId,
        transmitType,
        timerMapHit: null,
        directRecoverCalled: null,
        args: runtimeArgs,
      });
    },
    onLeave() {
      const context = this.captureTransmit;
      if (!context) {
        return;
      }
      const state = getThreadState();
      popExpected(state.transmits, context);
      if (context.root) {
        emitCaptureEvent('recover-sp-share-rebroadcast', context.source, {
          roleEntityId: context.receiverEntityId,
          shareKind: 'ontransmit-observed-rebroadcast-summary',
          observedRebroadcastCount: context.rebroadcastCount,
          targets: [],
          args: { id: context.runtimeArgs.id },
        });
      }
      releaseThreadStateIfEmpty(state);
    },
  });

  attachMethod('SPSystem.RecoverSP', {
    onEnter(args) {
      const state = getThreadState();
      const source = peek(state.damageSources);
      if (!source) {
        this.spRecovery = null;
        return;
      }
      const transmit = peek(state.transmits);
      const context = {
        source,
        transmit,
        recoverTagType: args[1].toInt32(),
        baseDelta: readXmmFloat(this.context, 'xmm2'),
        delta: readXmmFloat(this.context, 'xmm3'),
      };
      state.spRecoveries.push(context);
      this.spRecovery = context;
    },
    onLeave() {
      if (!this.spRecovery) {
        return;
      }
      const state = getThreadState();
      popExpected(state.spRecoveries, this.spRecovery);
      releaseThreadStateIfEmpty(state);
    },
  });

  attachMethod('AliveProperty.SetSp', {
    onEnter(args) {
      const state = getThreadState();
      const recovery = peek(state.spRecoveries);
      if (!recovery) {
        this.spApplication = null;
        return;
      }
      this.spApplication = {
        recovery,
        aliveProperty: args[0],
        spBefore: readMyFloatField(args[0], 'AliveProperty.m_sp'),
        requestedSpAfter: readMyFloatArgument(args[1]),
      };
    },
    onLeave() {
      const application = this.spApplication;
      if (!application) {
        return;
      }
      const spAfter = readMyFloatField(
        application.aliveProperty,
        'AliveProperty.m_sp'
      );
      emitCaptureEvent('recover-sp-applied', application.recovery.source, {
        roleEntityId: application.aliveProperty.toString(),
        recoverTagType: application.recovery.recoverTagType,
        baseDelta: application.recovery.baseDelta,
        delta: application.recovery.delta,
        spBefore: application.spBefore.value,
        spAfter: spAfter.value,
        spDeltaApplied: roundNumber(spAfter.value - application.spBefore.value),
        spBeforeRaw: application.spBefore.raw,
        spAfterRaw: spAfter.raw,
        requestedSpAfter: application.requestedSpAfter.value,
        requestedSpAfterRaw: application.requestedSpAfter.raw,
        args: {
          id: application.recovery.transmit?.runtimeArgs?.id ?? null,
        },
      });
    },
  });
}

function installToughnessHooks() {
  attachMethod('DamageElement.Execute', {
    onEnter(args) {
      const state = getThreadState();
      const source = readDamageElementSource(args[0]);
      state.damagePackets.push(source);
      this.damagePacket = source;
      emitCaptureEvent('toughness-packet-execution', source, {
        phase: 'entry',
        packetDepth: state.damagePackets.length,
      });
    },
    onLeave() {
      const state = getThreadState();
      const source = this.damagePacket;
      if (!source) {
        return;
      }
      emitCaptureEvent('toughness-packet-execution', source, {
        phase: 'exit',
        packetDepth: state.damagePackets.length,
      });
      popExpected(state.damagePackets, source);
      releaseThreadStateIfEmpty(state);
    },
  });

  installOutputDamageHook(
    'FormulaUtility.GetOutputDamage',
    'toughness-hp-output-calculated'
  );
  installOutputDamageHook(
    'FormulaUtility.GetOutputRealDamage',
    'toughness-real-output-calculated'
  );
  installOutputDamageHook(
    'FormulaUtility.GetOutputWeaknessDamage',
    'toughness-output-calculated'
  );

  attachMethod('FormulaUtility.WeaknessPointChange', {
    onEnter(args) {
      const state = getThreadState();
      const source =
        peek(state.damagePackets) ?? readDamageElementSource(args[0]);
      state.weaknessCalculations.push(source);
      this.weaknessSource = source;
      this.outputDamagePointer = args[6];
      emitCaptureEvent('toughness-damage-applied', source, {
        phase: 'weakness-change-entry',
        outputDamageBefore: readMyFloatPointer(args[6]),
      });
    },
    onLeave(retval) {
      const state = getThreadState();
      if (this.weaknessSource) {
        emitCaptureEvent('toughness-damage-applied', this.weaknessSource, {
          phase: 'weakness-change-exit',
          changed: readBoolReturn(retval),
          outputDamageAfter: readMyFloatPointer(this.outputDamagePointer),
        });
      }
      popExpected(state.weaknessCalculations, this.weaknessSource);
      releaseThreadStateIfEmpty(state);
    },
  });

  attachMethod('AliveProperty.SetWeaknessPoint', {
    onEnter(args) {
      const state = getThreadState();
      const source =
        peek(state.weaknessCalculations) ??
        peek(state.damagePackets) ??
        createUnattributedDamageSource();
      this.toughnessApplication = {
        source,
        aliveProperty: args[0],
        toughnessBefore: readMyFloatField(
          args[0],
          'AliveProperty.m_weaknessPoint'
        ),
        requestedToughnessAfter: readMyFloatArgument(args[1]),
      };
      emitCaptureEvent('toughness-damage-applied', source, {
        phase: 'set-weakness-point-entry',
        targetPropertyPointer: args[0].toString(),
        toughnessBefore: this.toughnessApplication.toughnessBefore.value,
        toughnessBeforeRaw: this.toughnessApplication.toughnessBefore.raw,
        requestedToughnessAfter:
          this.toughnessApplication.requestedToughnessAfter.value,
        requestedToughnessAfterRaw:
          this.toughnessApplication.requestedToughnessAfter.raw,
        force: args[2].toInt32() !== 0,
      });
    },
    onLeave(retval) {
      const application = this.toughnessApplication;
      if (!application) {
        return;
      }
      const toughnessAfter = readMyFloatField(
        application.aliveProperty,
        'AliveProperty.m_weaknessPoint'
      );
      emitCaptureEvent('toughness-damage-applied', application.source, {
        phase: 'set-weakness-point-exit',
        targetPropertyPointer: application.aliveProperty.toString(),
        changed: readBoolReturn(retval),
        toughnessBefore: application.toughnessBefore.value,
        toughnessAfter: toughnessAfter.value,
        toughnessDeltaApplied: roundNumber(
          application.toughnessBefore.value - toughnessAfter.value
        ),
        toughnessBeforeRaw: application.toughnessBefore.raw,
        toughnessAfterRaw: toughnessAfter.raw,
        requestedToughnessAfter: application.requestedToughnessAfter.value,
        requestedToughnessAfterRaw: application.requestedToughnessAfter.raw,
      });
    },
  });

  attachMethod('FormulaUtility.ChangeHP', {
    onEnter(args) {
      const state = getThreadState();
      const source =
        peek(state.damagePackets) ?? createUnattributedDamageSource();
      const change = {
        source,
        requestedHpChange: readMyFloatArgument(args[3]),
      };
      state.hpChanges.push(change);
      this.hpChange = change;
      emitCaptureEvent('toughness-hp-change-dispatch', source, {
        phase: 'entry',
        requestedHpChange: change.requestedHpChange.value,
        requestedHpChangeRaw: change.requestedHpChange.raw,
      });
    },
    onLeave(retval) {
      const state = getThreadState();
      const change = this.hpChange;
      if (!change) {
        return;
      }
      emitCaptureEvent('toughness-hp-change-dispatch', change.source, {
        phase: 'exit',
        changed: readBoolReturn(retval),
        requestedHpChange: change.requestedHpChange.value,
        requestedHpChangeRaw: change.requestedHpChange.raw,
      });
      popExpected(state.hpChanges, change);
      releaseThreadStateIfEmpty(state);
    },
  });

  attachMethod('AliveProperty.SetHpByHurt', {
    onEnter(args) {
      const state = getThreadState();
      const change = peek(state.hpChanges);
      const source =
        change?.source ??
        peek(state.damagePackets) ??
        createUnattributedDamageSource();
      this.hpApplication = {
        source,
        aliveProperty: args[0],
        hpBefore: readMyFloatField(args[0], 'AliveProperty.m_hp'),
        requestedHpAfter: readMyFloatArgument(args[1]),
      };
      emitCaptureEvent('toughness-hp-applied', source, {
        phase: 'set-hp-by-hurt-entry',
        targetPropertyPointer: args[0].toString(),
        hpBefore: this.hpApplication.hpBefore.value,
        hpBeforeRaw: this.hpApplication.hpBefore.raw,
        requestedHpAfter: this.hpApplication.requestedHpAfter.value,
        requestedHpAfterRaw: this.hpApplication.requestedHpAfter.raw,
      });
    },
    onLeave() {
      const application = this.hpApplication;
      if (!application) {
        return;
      }
      const hpAfter = readMyFloatField(
        application.aliveProperty,
        'AliveProperty.m_hp'
      );
      emitCaptureEvent('toughness-hp-applied', application.source, {
        phase: 'set-hp-by-hurt-exit',
        targetPropertyPointer: application.aliveProperty.toString(),
        hpBefore: application.hpBefore.value,
        hpAfter: hpAfter.value,
        hpDeltaApplied: roundNumber(application.hpBefore.value - hpAfter.value),
        hpBeforeRaw: application.hpBefore.raw,
        hpAfterRaw: hpAfter.raw,
        requestedHpAfter: application.requestedHpAfter.value,
        requestedHpAfterRaw: application.requestedHpAfter.raw,
      });
    },
  });

  installToughnessPropertyHook();

  attachMethod('AliveProperty.get_breakDmgUp', {
    onEnter(args) {
      this.breakPropertyRead = {
        source:
          peek(getThreadState().damagePackets) ??
          createUnattributedDamageSource(),
        ownerPropertyPointer: args[0].toString(),
      };
    },
    onLeave(retval) {
      const read = this.breakPropertyRead;
      if (!read) {
        return;
      }
      const value = readMyFloatArgument(retval);
      emitCaptureEvent('toughness-break-property-read', read.source, {
        ownerPropertyPointer: read.ownerPropertyPointer,
        propertyId: 221,
        propertyName: 'WP_BREAK_DMGUP',
        myFloatRaw: value.raw,
        floatValue: value.value,
      });
    },
  });

  installWeakStateReadHook('ControlProperty.get_inWeakState', true);
  installWeakStateReadHook('ControlProperty.GetWeakState', false);

  attachMethod('ControlProperty.SetWeakState', {
    onEnter(args) {
      const source =
        peek(getThreadState().damagePackets) ??
        createUnattributedDamageSource();
      this.weakStateWrite = {
        source,
        controlProperty: args[0],
        weakStateBefore: readS32Field(args[0], 'ControlProperty.m_weakState'),
        requestedWeakState: args[1].toInt32(),
      };
      emitCaptureEvent('toughness-weak-state-write', source, {
        phase: 'entry',
        controlPropertyPointer: args[0].toString(),
        weakStateBefore: this.weakStateWrite.weakStateBefore,
        requestedWeakState: this.weakStateWrite.requestedWeakState,
      });
    },
    onLeave() {
      const write = this.weakStateWrite;
      if (!write) {
        return;
      }
      emitCaptureEvent('toughness-weak-state-write', write.source, {
        phase: 'exit',
        controlPropertyPointer: write.controlProperty.toString(),
        weakStateBefore: write.weakStateBefore,
        weakStateAfter: readS32Field(
          write.controlProperty,
          'ControlProperty.m_weakState'
        ),
        requestedWeakState: write.requestedWeakState,
      });
    },
  });

  for (const methodName of [
    'RecoverBreakTimingByBreakData',
    'OnAttributeCacheUpdate',
    'OnBeforeUpdate',
    'OnUpdate_LocalControlled',
    'OnUpdate_RemoteControlled',
    'WeaknessPointUpdate',
    'Lens.Gameplay.Modules.BigWorld.IUpdate.OnUpdateDeltaTime',
    'OnLateUpdate',
    'UpdateWeakState',
    'WeakBreaking',
    'WeakBreakEnding',
    'UpdateWeakBreakEnd',
  ]) {
    installWeakBreakStateHook(methodName);
  }
}

function installOutputDamageHook(methodKey, eventType) {
  attachMethod(methodKey, {
    onEnter(args) {
      const state = getThreadState();
      const source =
        peek(state.damagePackets) ?? readDamageElementSource(args[1]);
      this.outputCalculation = {
        source,
        outputPointer: args[0],
      };
      emitCaptureEvent(eventType, source, { phase: 'entry' });
    },
    onLeave() {
      const calculation = this.outputCalculation;
      if (!calculation) {
        return;
      }
      emitCaptureEvent(eventType, calculation.source, {
        phase: 'exit',
        ...readOutputDamageData(calculation.outputPointer),
      });
    },
  });
}

function installToughnessPropertyHook() {
  attachMethod('AliveProperty.GetBattlePropertyCurrentValue', {
    onEnter(args) {
      const propertyId = args[1].toInt32();
      if (propertyId !== 221) {
        this.toughnessPropertyRead = null;
        return;
      }
      this.toughnessPropertyRead = {
        source:
          peek(getThreadState().damagePackets) ??
          createUnattributedDamageSource(),
        ownerPropertyPointer: args[0].toString(),
        propertyId,
      };
    },
    onLeave(retval) {
      const read = this.toughnessPropertyRead;
      if (!read) {
        return;
      }
      const value = readMyFloatArgument(retval);
      emitCaptureEvent('toughness-break-property-read', read.source, {
        ownerPropertyPointer: read.ownerPropertyPointer,
        propertyId: read.propertyId,
        propertyName: 'WP_BREAK_DMGUP',
        myFloatRaw: value.raw,
        floatValue: value.value,
      });
    },
  });
}

function installWeakStateReadHook(methodKey, isBoolean) {
  attachMethod(methodKey, {
    onEnter(args) {
      this.weakStateRead = {
        source:
          peek(getThreadState().damagePackets) ??
          createUnattributedDamageSource(),
        controlPropertyPointer: args[0].toString(),
      };
    },
    onLeave(retval) {
      const read = this.weakStateRead;
      if (!read) {
        return;
      }
      emitCaptureEvent('toughness-weak-state-read', read.source, {
        methodKey,
        controlPropertyPointer: read.controlPropertyPointer,
        weakState: isBoolean ? null : retval.toInt32(),
        inWeakState: isBoolean ? readBoolReturn(retval) : null,
      });
    },
  });
}

function installWeakBreakStateHook(methodName) {
  const methodKey = `WeakBreakSystem.${methodName}`;
  attachMethod(methodKey, {
    onEnter(args) {
      this.weakBreakUpdate = {
        system: args[0],
        stateBefore: readWeakBreakSystemState(args[0]),
      };
      emitToughnessStateUpdate(methodKey, 'entry', {
        stateBefore: this.weakBreakUpdate.stateBefore,
        attributeId:
          methodName === 'OnAttributeCacheUpdate' ? args[1].toInt32() : null,
        updateDeltaTime:
          methodName ===
          'Lens.Gameplay.Modules.BigWorld.IUpdate.OnUpdateDeltaTime'
            ? readXmmFloat(this.context, 'xmm1')
            : null,
      });
    },
    onLeave() {
      const update = this.weakBreakUpdate;
      if (!update) {
        return;
      }
      emitToughnessStateUpdate(methodKey, 'exit', {
        stateBefore: update.stateBefore,
        stateAfter: readWeakBreakSystemState(update.system),
      });
    },
  });
}

function installModifierPropertyHook(
  methodKey,
  idArgumentIndex,
  ownerResolver
) {
  attachMethod(methodKey, {
    onEnter(args) {
      const source = peek(getThreadState().damageSources);
      const propertyId = args[idArgumentIndex].toInt32();
      if (!source || (propertyId !== 105 && propertyId !== 228)) {
        this.modifierRead = null;
        return;
      }
      this.modifierRead = {
        source,
        propertyId,
        ownerEntityId: ownerResolver(args),
      };
    },
    onLeave(retval) {
      const read = this.modifierRead;
      if (!read) {
        return;
      }
      const value = readMyFloatArgument(retval);
      read.source.modifierValues[read.propertyId] = value.value;
      emitCaptureEvent('recover-sp-modifier-property-read', read.source, {
        ownerEntityId: read.ownerEntityId,
        propertyId: read.propertyId,
        propertyName: read.propertyId === 105 ? 'SPGETUP' : 'SPGETUP_ATK',
        isRatio: true,
        myFloatRaw: value.raw,
        floatValue: value.value,
      });
    },
  });
}

function readDamageElementSource(damageElement) {
  const configuredElementId =
    Number(captureConfig.sourceElementConfigId) || null;
  const observedElementId = readS32Field(
    damageElement,
    'BaseElement.<elementId>k__BackingField'
  );
  return {
    damageElement,
    damageElementPointer: damageElement.toString(),
    sourceElementConfigId:
      observedElementId > 0 ? observedElementId : configuredElementId,
    sourceSkillId: readS32Field(
      damageElement,
      'BaseElement.<skillId>k__BackingField'
    ),
    sourceElementUniqueId: readU64Field(
      damageElement,
      'BaseElement.m_uniqueId'
    ),
    sourceId: readU64Field(damageElement, 'BaseElement.p_sourceID'),
    attackerEntityId: readS32Field(
      damageElement,
      'BaseElement.p_attackerEntityID'
    ),
    executeEntityId: readS32Field(
      damageElement,
      'BaseElement.p_executeEntityID'
    ),
    sourceEntityId: readS32Field(damageElement, 'BaseElement.p_sourceEntityID'),
    uuid: readU32Field(damageElement, 'BaseElement.UUID'),
    modifierValues: {},
  };
}

function createUnattributedDamageSource() {
  return {
    damageElement: null,
    damageElementPointer: null,
    sourceElementConfigId: null,
    sourceSkillId: null,
    sourceElementUniqueId: null,
    sourceId: null,
    attackerEntityId: null,
    executeEntityId: null,
    sourceEntityId: null,
    uuid: null,
    modifierValues: {},
  };
}

function readRecoverSpArgs(argsPointer) {
  return {
    id: readS32Field(argsPointer, 'RecoverSPArgs.id'),
    baseDelta: readFloatField(argsPointer, 'RecoverSPArgs.baseDelta'),
    delta: readFloatField(argsPointer, 'RecoverSPArgs.delta'),
    interval: readFloatField(argsPointer, 'RecoverSPArgs.interval'),
    tagType: readS32Field(argsPointer, 'RecoverSPArgs.tagType'),
    skillId: readS32Field(argsPointer, 'RecoverSPArgs.skillId'),
    sharePercent: readFloatField(argsPointer, 'RecoverSPArgs.sharePercent'),
    petSharePercent: readFloatField(
      argsPointer,
      'RecoverSPArgs.petSharePercent'
    ),
    petDelta: readFloatField(argsPointer, 'RecoverSPArgs.petDelta'),
    isAddition: readBoolField(argsPointer, 'RecoverSPArgs.isAddition'),
    additionId: readS32Field(argsPointer, 'RecoverSPArgs.additionId'),
    mainPetSharePercent: readFloatField(
      argsPointer,
      'RecoverSPArgs.mainPetSharePercent'
    ),
  };
}

function emitCaptureEvent(eventType, source, extra = {}) {
  emitRecord({
    recordType: 'event',
    captureSessionId: captureConfig.captureSessionId,
    eventType,
    timeMs: elapsedTimeMs(),
    actionId: captureConfig.actionId,
    actorId: captureConfig.actorId,
    targetId: captureConfig.targetId,
    sourceElementConfigId: source.sourceElementConfigId,
    sourceSkillId: source.sourceSkillId,
    sourceElementUniqueId: source.sourceElementUniqueId,
    sourceId: source.sourceId,
    attackerEntityId: source.attackerEntityId,
    executeEntityId: source.executeEntityId,
    sourceEntityId: source.sourceEntityId,
    damageElementPointer: source.damageElementPointer,
    threadId: Process.getCurrentThreadId(),
    ...extra,
  });
}

function emitToughnessStateUpdate(methodKey, phase, extra = {}) {
  emitRecord({
    recordType: 'event',
    captureSessionId: captureConfig.captureSessionId,
    eventType: 'toughness-state-update',
    timeMs: elapsedTimeMs(),
    actionId: captureConfig.actionId,
    actorId: captureConfig.actorId,
    targetId: captureConfig.targetId,
    methodKey,
    phase,
    threadId: Process.getCurrentThreadId(),
    ...extra,
  });
}

function emitRecord(record) {
  emittedEventCount += 1;
  captureSequence += 1;
  send({
    channel: 'capture-event',
    record: {
      ...record,
      captureSequence,
      clientFrameCount: safeNativeCall(frameCountFunction),
      clientDeltaTimeSeconds: roundNumber(safeNativeCall(deltaTimeFunction)),
    },
  });
}

function sendStatus(status, details = {}) {
  send({ channel: 'capture-status', status, ...details });
}

function attachMethod(methodKey, callbacks) {
  const method = methodByKey.get(methodKey);
  if (!method) {
    throw new Error(`Hook manifest method missing: ${methodKey}`);
  }
  const address = captureModule.base.add(parseHex(method.rva));
  listeners.push(Interceptor.attach(address, callbacks));
}

function createManifestNativeFunction(methodKey, returnType, argumentTypes) {
  if (typeof NativeFunction !== 'function') {
    return null;
  }
  const method = methodByKey.get(methodKey);
  if (!method) {
    throw new Error(`Hook manifest method missing: ${methodKey}`);
  }
  const address = captureModule.base.add(parseHex(method.rva));
  return new NativeFunction(address, returnType, argumentTypes);
}

function safeNativeCall(nativeFunction) {
  if (!nativeFunction) {
    return null;
  }
  return safeRead(() => nativeFunction(), null);
}

function getThreadState() {
  const threadId = Process.getCurrentThreadId();
  let state = threadStates.get(threadId);
  if (!state) {
    state = {
      threadId,
      damageSources: [],
      transmits: [],
      spRecoveries: [],
      weaknessCalculations: [],
      damagePackets: [],
      hpChanges: [],
    };
    threadStates.set(threadId, state);
  }
  return state;
}

function releaseThreadStateIfEmpty(state) {
  if (
    state.damageSources.length === 0 &&
    state.transmits.length === 0 &&
    state.spRecoveries.length === 0 &&
    state.weaknessCalculations.length === 0 &&
    state.damagePackets.length === 0 &&
    state.hpChanges.length === 0
  ) {
    threadStates.delete(state.threadId);
  }
}

function popExpected(stack, expected) {
  if (stack.length === 0) {
    return null;
  }
  const value = stack.pop();
  if (value !== expected) {
    sendStatus('capture-agent-stack-mismatch');
  }
  return value;
}

function peek(stack) {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

function readS32Field(objectPointer, key) {
  return safeRead(() => objectPointer.add(requireOffset(key)).readS32(), null);
}

function readU32Field(objectPointer, key) {
  return safeRead(() => objectPointer.add(requireOffset(key)).readU32(), null);
}

function readU64Field(objectPointer, key) {
  return safeRead(
    () => objectPointer.add(requireOffset(key)).readU64().toString(),
    null
  );
}

function readFloatField(objectPointer, key) {
  return safeRead(
    () => roundNumber(objectPointer.add(requireOffset(key)).readFloat()),
    null
  );
}

function readBoolField(objectPointer, key) {
  return safeRead(
    () => objectPointer.add(requireOffset(key)).readU8() !== 0,
    null
  );
}

function readPointerField(objectPointer, key) {
  return safeRead(
    () => objectPointer.add(requireOffset(key)).readPointer().toString(),
    null
  );
}

function readNativePointerField(objectPointer, key) {
  return safeRead(
    () => objectPointer.add(requireOffset(key)).readPointer(),
    ptr(0)
  );
}

function readMyFloatField(objectPointer, key) {
  return safeRead(
    () => myFloatFromInt64(objectPointer.add(requireOffset(key)).readS64()),
    { raw: null, value: null }
  );
}

function readMyFloatPointer(valuePointer) {
  return safeRead(() => myFloatFromInt64(valuePointer.readS64()), {
    raw: null,
    value: null,
  });
}

function readOutputDamageData(outputPointer) {
  const outputDamage = readMyFloatField(
    outputPointer,
    'FormulaUtility.OutputDamageData.outputDamage'
  );
  const realDamage = readMyFloatField(
    outputPointer,
    'FormulaUtility.OutputDamageData.realDamage'
  );
  return {
    outputDamage: outputDamage.value,
    outputDamageRaw: outputDamage.raw,
    realDamage: realDamage.value,
    realDamageRaw: realDamage.raw,
    isCritical: readBoolField(
      outputPointer,
      'FormulaUtility.OutputDamageData.isCritical'
    ),
    isShield: readBoolField(
      outputPointer,
      'FormulaUtility.OutputDamageData.isShield'
    ),
  };
}

function readWeakBreakSystemState(systemPointer) {
  return {
    systemPointer: safeRead(() => systemPointer.toString(), null),
    entityHandle: readU64Field(systemPointer, 'WeakBreakSystem.m_entityHandle'),
    lastDamageTime: readMyFloatField(
      systemPointer,
      'WeakBreakSystem.m_lastDamageTime'
    ),
    weakTime: readFloatField(systemPointer, 'WeakBreakSystem.m_weakTime'),
    currentWeakTime: readFloatField(
      systemPointer,
      'WeakBreakSystem.m_curWeakTime'
    ),
    weakEndTime: readFloatField(systemPointer, 'WeakBreakSystem.m_weakEndTime'),
    currentWeakEndTime: readFloatField(
      systemPointer,
      'WeakBreakSystem.m_curWeakEndTime'
    ),
    weakState: readS32Field(systemPointer, 'WeakBreakSystem.m_weakState'),
  };
}

function readBoolReturn(retval) {
  return safeRead(() => retval.toInt32() !== 0, null);
}

function readMyFloatArgument(value) {
  return safeRead(
    () => {
      let raw = BigInt(value.toString());
      if (raw >= 0x8000000000000000n) {
        raw -= 0x10000000000000000n;
      }
      return myFloatFromBigInt(raw);
    },
    { raw: null, value: null }
  );
}

function myFloatFromInt64(value) {
  return myFloatFromBigInt(BigInt(value.toString()));
}

function myFloatFromBigInt(raw) {
  return {
    raw: raw.toString(),
    value: roundNumber(Number(raw) / 65536),
  };
}

function readXmmFloat(context, registerName) {
  return safeRead(() => {
    const register = context[registerName];
    if (register instanceof ArrayBuffer) {
      return roundNumber(new DataView(register).getFloat32(0, true));
    }
    if (ArrayBuffer.isView(register)) {
      return roundNumber(
        new DataView(
          register.buffer,
          register.byteOffset,
          register.byteLength
        ).getFloat32(0, true)
      );
    }
    const bits = Number(BigInt(register.toString()) & 0xffffffffn);
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, bits, true);
    return roundNumber(new DataView(buffer).getFloat32(0, true));
  }, null);
}

function requireOffset(key) {
  const offset = fieldOffsetByKey.get(key);
  if (offset == null) {
    throw new Error(`Hook manifest field missing: ${key}`);
  }
  return offset;
}

function safeRead(reader, fallback) {
  try {
    return reader();
  } catch (error) {
    sendStatus('capture-agent-read-failed', { error: String(error) });
    return fallback;
  }
}

function stopCapture() {
  while (listeners.length > 0) {
    listeners.pop().detach();
  }
  threadStates.clear();
  const result = {
    status: 'capture-agent-stopped',
    emittedEventCount,
  };
  captureConfig = null;
  captureModule = null;
  methodByKey = new Map();
  fieldOffsetByKey = new Map();
  frameCountFunction = null;
  deltaTimeFunction = null;
  return result;
}

function elapsedTimeMs() {
  return Math.max(0, Date.now() - captureStartedAt);
}

function roundNumber(value) {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

function parseHex(value) {
  return Number.parseInt(String(value), 16);
}

function normalizeCaptureKind(value) {
  const captureKind = value || 'all';
  if (
    captureKind !== 'all' &&
    captureKind !== 'role-sp' &&
    captureKind !== 'kibo-energy' &&
    captureKind !== 'toughness'
  ) {
    throw new Error(`Unsupported capture kind: ${captureKind}`);
  }
  return captureKind;
}
