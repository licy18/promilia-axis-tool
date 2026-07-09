export function createThreeValueRuntimeOutputConsumerContract({
  outputContract = null,
  simLog = [],
  stateCurves = null,
  resourceCurves = null,
  summary = {},
  outputConsistency = null,
} = {}) {
  const simLogRows = Array.isArray(simLog) ? simLog : [];
  const stateCurveSummary = stateCurves?.summary ?? {};
  const resourceCurveSummary = resourceCurves?.summary ?? {};
  const contractSummary = outputContract?.summary ?? {};
  const contractOutputs = outputContract?.outputs ?? {};
  const outputConsistencyStatus =
    outputConsistency?.status ?? summary.outputConsistencyStatus ?? '';

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-runtime-output-consumer-contract',
    status:
      outputContract?.status === 'runtime-output-contract-ready'
        ? 'runtime-output-consumer-contract-ready'
        : 'runtime-output-consumer-contract-ready-no-applied-deltas',
    contractSourceKind: outputContract?.sourceKind ?? '',
    contractStatus: outputContract?.status ?? '',
    canonicalOutputNames: [
      'simLog',
      'stateCurves',
      'resourceCurves',
      'summary',
    ],
    aliases: {
      resources: 'resourceCurves',
    },
    outputs: {
      simLog: {
        outputName: 'simLog',
        dataPath: 'runtimeOutputs.simLog',
        contractPath: 'runtimeOutputs.outputContract.outputs.simLog',
        sourceKind: contractOutputs.simLog?.sourceKind ?? '',
        status: contractOutputs.simLog?.status ?? '',
        inputSource: contractOutputs.simLog?.inputSource ?? '',
        inputSourceKind: contractOutputs.simLog?.inputSourceKind ?? '',
        rowCount: simLogRows.length,
        keyFields: contractOutputs.simLog?.keyFields ?? [
          'sourceDeltaId',
          'runtimeSequenceIndex',
        ],
        valueFields: contractOutputs.simLog?.valueFields ?? [
          'delta',
          'hpDelta',
          'toughnessDelta',
          'energyDelta',
        ],
      },
      stateCurves: {
        outputName: 'stateCurves',
        dataPath: 'runtimeOutputs.stateCurves',
        contractPath: 'runtimeOutputs.outputContract.outputs.stateCurves',
        sourceKind: contractOutputs.stateCurves?.sourceKind ?? '',
        status: contractOutputs.stateCurves?.status ?? '',
        enemyPointCount: numberOrZero(
          stateCurves?.enemy?.pointCount ?? stateCurveSummary.enemyPointCount
        ),
        stateCurvePointCount: numberOrZero(
          stateCurveSummary.stateCurvePointCount ??
            contractSummary.stateCurvePointCount
        ),
        outputFields: contractOutputs.stateCurves?.outputFields ?? [
          'enemy',
          'resources',
          'summary',
        ],
      },
      resourceCurves: {
        outputName: 'resourceCurves',
        dataPath: 'runtimeOutputs.resourceCurves',
        aliasPath: 'runtimeOutputs.resources',
        contractPath: 'runtimeOutputs.outputContract.outputs.resourceCurves',
        sourceKind: contractOutputs.resourceCurves?.sourceKind ?? '',
        status: contractOutputs.resourceCurves?.status ?? '',
        actorCount: numberOrZero(
          resourceCurveSummary.actorCount ??
            contractSummary.resourceCurveActorCount
        ),
        pointCount: numberOrZero(
          resourceCurveSummary.pointCount ??
            contractSummary.resourceCurvePointCount
        ),
        curveCollectionField:
          contractOutputs.resourceCurves?.curveCollectionField ??
          'curvesByActor',
      },
      summary: {
        outputName: 'summary',
        dataPath: 'runtimeOutputs.summary',
        contractPath: 'runtimeOutputs.outputContract.outputs.summary',
        sourceKind: contractOutputs.summary?.sourceKind ?? '',
        status: contractOutputs.summary?.status ?? '',
        valueFields: contractOutputs.summary?.valueFields ?? [],
        countFields: contractOutputs.summary?.countFields ?? [],
      },
    },
    summary: {
      outputCount: numberOrZero(
        contractSummary.outputCount ?? summary.outputCount ?? 4
      ),
      appliedDeltaCount: numberOrZero(
        contractSummary.appliedDeltaCount ?? summary.appliedDeltaCount
      ),
      simLogCount: numberOrZero(
        summary.simLogCount ?? contractSummary.simLogCount ?? simLogRows.length
      ),
      enemyStatePointCount: numberOrZero(
        stateCurves?.enemy?.pointCount ??
          stateCurveSummary.enemyPointCount ??
          contractSummary.enemyStatePointCount ??
          summary.enemyStatePointCount
      ),
      stateCurvePointCount: numberOrZero(
        stateCurveSummary.stateCurvePointCount ??
          contractSummary.stateCurvePointCount ??
          summary.stateCurvePointCount
      ),
      resourceCurveActorCount: numberOrZero(
        resourceCurveSummary.actorCount ??
          contractSummary.resourceCurveActorCount ??
          summary.resourceCurveActorCount
      ),
      resourceCurvePointCount: numberOrZero(
        resourceCurveSummary.pointCount ??
          contractSummary.resourceCurvePointCount ??
          summary.resourceCurvePointCount
      ),
      enemyHpDelta: numberOrZero(
        summary.enemyHpDelta ?? contractSummary.enemyHpDelta
      ),
      enemyToughnessDelta: numberOrZero(
        summary.enemyToughnessDelta ?? contractSummary.enemyToughnessDelta
      ),
      selfEnergyDelta: numberOrZero(
        summary.selfEnergyDelta ?? contractSummary.selfEnergyDelta
      ),
      outputConsistencyStatus,
      outputConsistent: Boolean(
        summary.outputConsistent ?? outputConsistency?.consistent
      ),
      applied: true,
    },
    applied: true,
  };
}

export function createThreeValueRuntimeOutputConsumerView(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  const outputContract = runtimeOutputSource?.outputContract ?? null;
  const outputSummary = getThreeValueRuntimeOutputSummary(runtimeOutputSource);
  const simLog = getThreeValueRuntimeSimLogRows(runtimeOutputSource);
  const stateCurves = getThreeValueRuntimeStateCurves(runtimeOutputSource);
  const resourceCurves =
    getThreeValueRuntimeResourceCurves(runtimeOutputSource);
  const outputConsistency = runtimeOutputSource?.outputConsistency ?? {};
  const outputConsumerContract =
    runtimeOutputSource?.outputConsumerContract ??
    runtimeOutputSource?.consumerContract ??
    createThreeValueRuntimeOutputConsumerContract({
      outputContract,
      simLog,
      stateCurves,
      resourceCurves,
      summary: outputSummary,
      outputConsistency,
    });
  const enemyStateCurve =
    stateCurves?.enemy ?? runtimeOutputSource?.enemyStateCurve ?? {};
  const resourceCurveRows = Array.isArray(resourceCurves?.curvesByActor)
    ? resourceCurves.curvesByActor
    : (runtimeOutputSource?.selfEnergyCurveByActor ?? []);

  return {
    schemaVersion: 1,
    sourceKind: 'azpr-three-value-runtime-output-consumer-view',
    status: runtimeOutputSource
      ? 'runtime-output-consumer-view-ready'
      : 'runtime-output-consumer-view-missing',
    runtimeOutputsSourceKind: runtimeOutputSource?.sourceKind ?? '',
    runtimeOutputsStatus: runtimeOutputSource?.status ?? '',
    outputContract,
    outputConsumerContract,
    consumerContract: outputConsumerContract,
    outputConsistency,
    outputSummary,
    simLog,
    stateCurves,
    resourceCurves,
    resources: resourceCurves,
    enemyStateCurve,
    resourceCurveRows,
    summary: {
      outputCount: numberOrZero(outputSummary.outputCount),
      simLogCount: getThreeValueRuntimeSimLogCount(runtimeOutputSource),
      enemyStatePointCount: numberOrZero(
        outputSummary.enemyStatePointCount ?? enemyStateCurve?.pointCount
      ),
      stateCurvePointCount: numberOrZero(outputSummary.stateCurvePointCount),
      resourceCurvePointCount: numberOrZero(
        outputSummary.resourceCurvePointCount
      ),
      resourceCurveActorCount: numberOrZero(
        outputSummary.resourceCurveActorCount
      ),
      outputConsumerContractStatus: outputConsumerContract?.status ?? '',
      outputConsistencyStatus:
        outputSummary.outputConsistencyStatus ?? outputConsistency.status ?? '',
      outputConsistent: Boolean(
        outputSummary.outputConsistent ?? outputConsistency.consistent
      ),
    },
    ready:
      Boolean(runtimeOutputSource) &&
      (isReadyStatus(outputConsumerContract?.status) ||
        isReadyStatus(outputContract?.status) ||
        isReadyStatus(runtimeOutputSource?.status)),
  };
}

export function getThreeValueRuntimeOutputSource(runtimeProjection) {
  return runtimeProjection?.runtimeOutputs ?? runtimeProjection ?? null;
}

export function getThreeValueRuntimeOutputContract(runtimeProjection) {
  return (
    getThreeValueRuntimeOutputSource(runtimeProjection)?.outputContract ?? null
  );
}

export function getThreeValueRuntimeOutputContractOutput(
  runtimeProjection,
  outputName
) {
  return (
    getThreeValueRuntimeOutputContract(runtimeProjection)?.outputs?.[
      outputName
    ] ?? null
  );
}

export function getThreeValueRuntimeOutputSummary(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  const outputContract = runtimeOutputSource?.outputContract ?? null;
  return {
    ...(runtimeOutputSource?.outputs?.summary ?? {}),
    ...(runtimeOutputSource?.summary ?? {}),
    ...(outputContract?.summary ?? {}),
    ...(runtimeOutputSource?.outputSummary ?? {}),
    ...(runtimeOutputSource?.outputConsumerContract?.summary ?? {}),
  };
}

export function getThreeValueRuntimeSimLogRows(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  const rows =
    runtimeOutputSource?.outputs?.simLog ?? runtimeOutputSource?.simLog;
  return Array.isArray(rows) ? rows : [];
}

export function getThreeValueRuntimeSimLogCount(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  const consumerSummaryCount = numberOrNull(
    runtimeOutputSource?.outputConsumerContract?.summary?.simLogCount
  );
  if (Number.isFinite(consumerSummaryCount)) {
    return consumerSummaryCount;
  }

  const simLogOutputCount = numberOrNull(
    getThreeValueRuntimeOutputContractOutput(runtimeProjection, 'simLog')
      ?.rowCount
  );
  if (Number.isFinite(simLogOutputCount)) {
    return simLogOutputCount;
  }

  const outputSummary = getThreeValueRuntimeOutputSummary(runtimeProjection);
  const outputSummaryCount = numberOrNull(outputSummary.simLogCount);
  if (Number.isFinite(outputSummaryCount)) {
    return outputSummaryCount;
  }

  return getThreeValueRuntimeSimLogRows(runtimeProjection).length;
}

export function getThreeValueRuntimeStateCurves(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  return (
    runtimeOutputSource?.outputs?.stateCurves ??
    runtimeOutputSource?.stateCurves ??
    {}
  );
}

export function getThreeValueRuntimeEnemyStateCurve(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  return (
    getThreeValueRuntimeStateCurves(runtimeProjection)?.enemy ??
    runtimeOutputSource?.enemyStateCurve ??
    {}
  );
}

export function getThreeValueRuntimeResourceCurves(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  return (
    runtimeOutputSource?.outputs?.resourceCurves ??
    runtimeOutputSource?.resourceCurves ??
    runtimeOutputSource?.resources ??
    {}
  );
}

export function getThreeValueRuntimeResourceCurveRows(runtimeProjection) {
  const runtimeOutputSource =
    getThreeValueRuntimeOutputSource(runtimeProjection);
  const resourceCurves = getThreeValueRuntimeResourceCurves(runtimeProjection);
  if (Array.isArray(resourceCurves?.curvesByActor)) {
    return resourceCurves.curvesByActor;
  }

  return runtimeOutputSource?.selfEnergyCurveByActor ?? [];
}

function isReadyStatus(status = '') {
  return String(status).includes('ready');
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
