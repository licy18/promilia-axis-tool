export function createRecoverSpRuntimeSampleFixture({
  captureSessionId = 'fixture-recover-sp-109001081-v1',
  actionId = 'action-0001',
  actorId = 'actor-109001',
  ownerEntityId = 'runtime-owner-109001',
  roleEntityId = 'runtime-role-109001',
  sourceElementConfigId = 109001081,
  pathId = '3476557355496561381',
  frameIndex = 12,
  timeMs = 200,
  spgetup = 0.2,
  spgetupAtk = 0.05,
  spBefore = 10,
} = {}) {
  const recoverSP = 2700;
  const petRecoverSP = 10399;
  const recoverInterval = 9999;
  const modifier = 1 + spgetup + spgetupAtk;
  const baseDelta = roundFixtureNumber(recoverSP / 10000);
  const delta = roundFixtureNumber(baseDelta * modifier);
  const petDelta = roundFixtureNumber((petRecoverSP / 10000) * modifier);
  const interval = roundFixtureNumber(recoverInterval / 1000);
  const argsId = `${captureSessionId}:args:${sourceElementConfigId}`;

  const common = {
    captureSessionId,
    actionId,
    actorId,
    sourceElementConfigId,
    pathId,
    frameIndex,
    timeMs,
  };
  const args = {
    id: argsId,
    baseDelta,
    delta,
    interval,
    tagType: 0,
    skillId: 10900101,
    sharePercent: 0.2,
    petSharePercent: 0.3,
    petDelta,
    mainPetSharePercent: 1,
  };

  return {
    schemaVersion: 1,
    captureSessionId,
    clientRegion: 'manual-fixture',
    clientBuild: 'stage-5-8BB',
    source: 'manual-recover-sp-runtime-sample-fixture',
    events: [
      {
        ...common,
        eventType: 'recover-sp-args-built',
        recoverSP,
        petRecoverSP,
        recoverInterval,
        spgetup,
        spgetupAtk,
        args,
      },
      {
        ...common,
        eventType: 'recover-sp-modifier-property-read',
        ownerEntityId,
        propertyId: 105,
        propertyName: 'SPGETUP',
        isRatio: true,
        myFloatRaw: spgetup,
        floatValue: spgetup,
        args: { id: argsId },
      },
      {
        ...common,
        eventType: 'recover-sp-modifier-property-read',
        ownerEntityId,
        propertyId: 228,
        propertyName: 'SPGETUP_ATK',
        isRatio: true,
        myFloatRaw: spgetupAtk,
        floatValue: spgetupAtk,
        args: { id: argsId },
      },
      {
        ...common,
        eventType: 'recover-sp-ontransmit-12f',
        receiverEntityId: roleEntityId,
        timerMapHit: false,
        timerPreviousTime: null,
        timerNextTime: roundFixtureNumber(timeMs / 1000 + interval),
        directRecoverCalled: true,
        shareRebroadcastTargets: [],
        petShareTargets: [],
        mainPetShareTargets: [],
        args,
      },
      {
        ...common,
        eventType: 'recover-sp-applied',
        roleEntityId,
        recoverTagType: 0,
        baseDelta,
        delta,
        spBefore,
        spAfter: roundFixtureNumber(spBefore + delta),
        spDeltaApplied: delta,
        args: { id: argsId },
      },
      {
        ...common,
        eventType: 'recover-sp-share-rebroadcast',
        roleEntityId,
        shareKind: 'background-entity-share',
        targets: [],
        args: { id: argsId },
      },
    ],
  };
}

function roundFixtureNumber(value) {
  return Number(value.toFixed(6));
}
