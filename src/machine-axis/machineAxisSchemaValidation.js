import machineAxisSchema from '../../schemas/azpr-machine-axis-v1.schema.json';

export function validateRawMachineAxisSchema(value) {
  return validateNode(machineAxisSchema, value, '', machineAxisSchema);
}

function validateNode(schema, value, path, rootSchema) {
  const resolvedSchema = schema?.$ref
    ? resolveLocalReference(rootSchema, schema.$ref)
    : schema;
  if (!resolvedSchema) {
    return [
      issue(
        'machine-axis-schema-reference-invalid',
        path,
        `Unknown Machine Axis schema reference: ${schema?.$ref ?? 'missing'}`
      ),
    ];
  }
  if (Array.isArray(resolvedSchema.anyOf)) {
    const candidates = resolvedSchema.anyOf.map(candidate =>
      validateNode(candidate, value, path, rootSchema)
    );
    return candidates.some(candidateIssues => candidateIssues.length === 0)
      ? []
      : [
          issue(
            'machine-axis-schema-any-of',
            path,
            'Value does not match any allowed Machine Axis schema shape'
          ),
        ];
  }

  const issues = [];
  const allowedTypes = Array.isArray(resolvedSchema.type)
    ? resolvedSchema.type
    : resolvedSchema.type
      ? [resolvedSchema.type]
      : [];
  if (allowedTypes.length && !allowedTypes.some(type => matchesType(value, type))) {
    issues.push(
      issue(
        'machine-axis-schema-type',
        path,
        `Expected ${allowedTypes.join(' or ')}, received ${describeType(value)}`,
        { expectedTypes: allowedTypes, actualType: describeType(value) }
      )
    );
    return issues;
  }
  if ('const' in resolvedSchema && !Object.is(value, resolvedSchema.const)) {
    issues.push(
      issue(
        path === 'scenario.fps'
          ? 'machine-axis-fps-unsupported'
          : 'machine-axis-schema-const',
        path,
        `Expected ${JSON.stringify(resolvedSchema.const)}`,
        { expected: resolvedSchema.const, actual: value }
      )
    );
  }
  if (
    Array.isArray(resolvedSchema.enum) &&
    !resolvedSchema.enum.some(entry => Object.is(entry, value))
  ) {
    issues.push(
      issue(
        'machine-axis-schema-enum',
        path,
        `Value is not one of ${resolvedSchema.enum.map(JSON.stringify).join(', ')}`,
        { allowedValues: resolvedSchema.enum, actual: value }
      )
    );
  }

  if (isRecord(value)) {
    const properties = resolvedSchema.properties ?? {};
    for (const requiredKey of resolvedSchema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, requiredKey)) {
        const requiredPath = joinPath(path, requiredKey);
        issues.push(
          issue(
            'machine-axis-schema-required',
            requiredPath,
            `Required property is missing: ${requiredPath}`,
            { missingProperty: requiredKey }
          )
        );
      }
    }
    for (const [key, childValue] of Object.entries(value)) {
      const childPath = joinPath(path, key);
      if (properties[key]) {
        issues.push(
          ...validateNode(properties[key], childValue, childPath, rootSchema)
        );
      } else if (resolvedSchema.additionalProperties === false) {
        issues.push(
          issue(
            'machine-axis-schema-additional-property',
            childPath,
            `Additional property is not allowed: ${childPath}`,
            { additionalProperty: key }
          )
        );
      } else if (isRecord(resolvedSchema.additionalProperties)) {
        issues.push(
          ...validateNode(
            resolvedSchema.additionalProperties,
            childValue,
            childPath,
            rootSchema
          )
        );
      }
    }
  }

  if (Array.isArray(value)) {
    if (Number.isInteger(resolvedSchema.minItems) && value.length < resolvedSchema.minItems) {
      issues.push(
        issue(
          'machine-axis-schema-min-items',
          path,
          `Expected at least ${resolvedSchema.minItems} items`,
          { minimum: resolvedSchema.minItems, actual: value.length }
        )
      );
    }
    if (Number.isInteger(resolvedSchema.maxItems) && value.length > resolvedSchema.maxItems) {
      issues.push(
        issue(
          path.endsWith('.kibo.dnaFactors')
            ? 'machine-axis-cultivation-kibo-dna-unsupported-in-current-version'
            : 'machine-axis-schema-max-items',
          path,
          `Expected at most ${resolvedSchema.maxItems} items`,
          {
            maximum: resolvedSchema.maxItems,
            actual: value.length,
            ...(path.endsWith('.kibo.dnaFactors')
              ? { status: 'unsupported-in-current-version' }
              : {}),
          }
        )
      );
    }
    if (resolvedSchema.items) {
      value.forEach((entry, index) => {
        issues.push(
          ...validateNode(
            resolvedSchema.items,
            entry,
            joinPath(path, index),
            rootSchema
          )
        );
      });
    }
  }

  if (typeof value === 'string' && Number.isInteger(resolvedSchema.minLength)) {
    if (value.length < resolvedSchema.minLength) {
      issues.push(
        issue(
          'machine-axis-schema-min-length',
          path,
          `Expected at least ${resolvedSchema.minLength} characters`
        )
      );
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isFinite(resolvedSchema.minimum) && value < resolvedSchema.minimum) {
      issues.push(
        issue(
          path.endsWith('.schedule.frame')
            ? 'machine-axis-schedule-start-before-zero'
            : 'machine-axis-schema-minimum',
          path,
          `Value must be at least ${resolvedSchema.minimum}`,
          { minimum: resolvedSchema.minimum, actual: value }
        )
      );
    }
    if (Number.isFinite(resolvedSchema.maximum) && value > resolvedSchema.maximum) {
      issues.push(
        issue(
          'machine-axis-schema-maximum',
          path,
          `Value must be at most ${resolvedSchema.maximum}`,
          { maximum: resolvedSchema.maximum, actual: value }
        )
      );
    }
    if (
      Number.isFinite(resolvedSchema.exclusiveMinimum) &&
      value <= resolvedSchema.exclusiveMinimum
    ) {
      issues.push(
        issue(
          'machine-axis-schema-exclusive-minimum',
          path,
          `Value must be greater than ${resolvedSchema.exclusiveMinimum}`,
          { exclusiveMinimum: resolvedSchema.exclusiveMinimum, actual: value }
        )
      );
    }
  }
  return issues;
}

function resolveLocalReference(rootSchema, reference) {
  if (!String(reference).startsWith('#/')) return null;
  return String(reference)
    .slice(2)
    .split('/')
    .reduce(
      (current, segment) =>
        current?.[segment.replaceAll('~1', '/').replaceAll('~0', '~')],
      rootSchema
    );
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isRecord(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function describeType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function issue(code, path, message, details = {}) {
  return {
    ...details,
    severity: 'error',
    code,
    path,
    message,
    actionId: null,
    hitIdentity: null,
    relatedActionId: null,
  };
}

function joinPath(parent, child) {
  return parent ? `${parent}.${child}` : String(child);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
