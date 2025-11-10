onst _ = require('lodash');

/**
 * Flattens a nested object using dot notation.
 */
function flattenObject(obj, prefix = '', result = {}) {
  if (obj === null || obj === undefined) {
    return result;
  }

  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value, fullKey, result);
    } else {
      result[fullKey] = value;
    }
  });

  return result;
}

/**
 * Evaluates a single filter rule against an item.
 * rule: { path, op, value }
 * Supported ops: eq, neq, gt, gte, lt, lte, contains
 */
function matchesFilterRule(item, rule) {
  const actual = _.get(item, rule.path);
  const expected = rule.value;

  switch (rule.op) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return actual > expected;
    case 'gte':
      return actual >= expected;
    case 'lt':
      return actual < expected;
    case 'lte':
      return actual <= expected;
    case 'contains':
      if (actual == null) return false;
      return String(actual).includes(String(expected));
    default:
      return true;
  }
}

/**
 * Applies a list of filter rules to an item.
 */
function passesFilters(item, filters = []) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return true;
  }

  return filters.every((rule) => matchesFilterRule(item, rule));
}

/**
 * Applies mapping rules to an item.
 * mapping: [ { from: 'a.b', to: 'id' }, ... ]
 */
function applyMapping(item, mapping = []) {
  if (!Array.isArray(mapping) || mapping.length === 0) {
    // If no mapping is provided, flatten the object.
    return flattenObject(item);
  }

  const result = {};
  mapping.forEach((m) => {
    const value = _.get(item, m.from);
    result[m.to] = value;
  });
  return result;
}

/**
 * Transforms a data array using mapping and filters.
 * - data: input array of objects
 * - mapping: mapping config
 * - filters: filter rules
 */
function transformData(data, mapping = [], filters = []) {
  if (!Array.isArray(data)) return [];

  const transformed = [];

  for (const item of data) {
    if (!passesFilters(item, filters)) {
      continue;
    }

    const mapped = applyMapping(item, mapping);
    transformed.push(mapped);
  }

  return transformed;
}

module.exports = {
  flattenObject,
  matchesFilterRule,
  passesFilters,
  applyMapping,
  transformData
};