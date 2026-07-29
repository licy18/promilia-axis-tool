import { MACHINE_AXIS_TRANSPORT_METADATA_KEY } from './machineAxisTransport';

export function hasWorkbenchMachineAxisTransport(projectTransport) {
  const metadata = projectTransport?.[MACHINE_AXIS_TRANSPORT_METADATA_KEY];
  return Boolean(
    metadata &&
      typeof metadata === 'object' &&
      !Array.isArray(metadata)
  );
}

export function resolveWorkbenchMachineAxisConfigurationProjection({
  configurationLibrary,
  configurationSelection,
  projectTransport,
} = {}) {
  if (hasWorkbenchMachineAxisTransport(projectTransport)) {
    return {
      configurationLibrary: undefined,
      configurationSelection: undefined,
    };
  }
  return { configurationLibrary, configurationSelection };
}
