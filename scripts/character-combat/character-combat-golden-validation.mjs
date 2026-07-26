export function validateCharacterCombatGoldenRuntime({
  actual,
  expected,
} = {}) {
  const assertions = [];
  for (const [jsonPath, expectedValue] of Object.entries(
    expected?.exact ?? {}
  )) {
    const actualValue = resolveJsonPath(actual, jsonPath);
    assertions.push({
      jsonPath,
      operator: 'exact',
      expected: expectedValue,
      actual: actualValue,
      passed: deepEqual(actualValue, expectedValue),
    });
  }
  for (const [jsonPath, expectedValue] of Object.entries(
    expected?.greaterThan ?? {}
  )) {
    const actualValue = Number(resolveJsonPath(actual, jsonPath));
    assertions.push({
      jsonPath,
      operator: 'greater-than',
      expected: Number(expectedValue),
      actual: actualValue,
      passed: Number.isFinite(actualValue) && actualValue > Number(expectedValue),
    });
  }
  for (const [jsonPath, expectedValue] of Object.entries(
    expected?.atLeast ?? {}
  )) {
    const actualValue = Number(resolveJsonPath(actual, jsonPath));
    assertions.push({
      jsonPath,
      operator: 'at-least',
      expected: Number(expectedValue),
      actual: actualValue,
      passed:
        Number.isFinite(actualValue) && actualValue >= Number(expectedValue),
    });
  }
  if (!expected) {
    assertions.push({
      jsonPath: '$',
      operator: 'expected-contract-present',
      expected: true,
      actual: false,
      passed: false,
    });
  }
  const failed = assertions.filter(assertion => !assertion.passed);
  return {
    status: failed.length
      ? 'authoritative-golden-runtime-expectation-failed'
      : 'authoritative-golden-runtime-expectation-passed',
    passed: failed.length === 0,
    assertionCount: assertions.length,
    failedCount: failed.length,
    assertions,
  };
}

function resolveJsonPath(value, jsonPath) {
  return String(jsonPath)
    .split('.')
    .filter(Boolean)
    .reduce(
      (current, key) => (current == null ? undefined : current[key]),
      value
    );
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
