/**
 * Build a nested JSON tree from flat MongoDB documents.
 *
 * @param {Array<{path: string, data: object}>} docs - Flat documents from MongoDB
 * @param {string} basePath - The base path being queried
 * @returns {object} - Nested JSON tree
 */
export function buildTree(docs, basePath) {
  // Sort docs by path length (shorter first) to ensure parents are processed before children
  const sorted = [...docs].sort((a, b) => a.path.length - b.path.length);

  // If there's only one doc and it matches exactly, return its data
  if (sorted.length === 1 && sorted[0].path === basePath) {
    return sorted[0].data;
  }

  const tree = {};

  for (const doc of sorted) {
    // Calculate relative path from basePath
    let relativePath = doc.path;

    if (doc.path === basePath) {
      // If this is the exact base path, merge its data into the root
      Object.assign(tree, doc.data);
      continue;
    }

    if (doc.path.startsWith(basePath + '/')) {
      relativePath = doc.path.slice(basePath.length + 1);
    } else {
      // This shouldn't happen with proper prefix queries, but handle it
      continue;
    }

    // Split the relative path into segments
    const segments = relativePath.split('/').filter(Boolean);

    // Navigate/create the tree structure
    let current = tree;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (!(segment in current)) {
        current[segment] = {};
      }
      current = current[segment];
    }

    // Set the data at the final segment
    const lastSegment = segments[segments.length - 1];
    if (lastSegment) {
      current[lastSegment] = doc.data;
    }
  }

  return tree;
}

/**
 * Deep merge two objects. Source values overwrite target values.
 * Arrays are replaced, not merged.
 *
 * @param {object} target - Target object
 * @param {object} source - Source object to merge in
 * @returns {object} - Merged object
 */
export function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      isPlainObject(sourceValue) &&
      isPlainObject(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Deep merge imported data into a target object (used when resolving ___import).
 * Neither input is mutated and values taken from `imported` are deep-cloned,
 * so cached trees are never shared with, or modified through, the result.
 *
 * - Key on one side only: kept.
 * - Both sides plain objects: merged recursively with the same priority.
 * - Otherwise (scalars, arrays, type mismatch): 'keep' retains the target
 *   value, 'overwrite' takes the imported value. Arrays are never concatenated.
 *
 * @param {object} target - The importing object
 * @param {object} imported - Data being imported
 * @param {'keep'|'overwrite'} priority
 * @returns {object}
 */
export function mergeImport(target, imported, priority = 'keep') {
  const result = { ...target };

  for (const key of Object.keys(imported)) {
    const importedValue = imported[key];

    if (!(key in result)) {
      result[key] = structuredClone(importedValue);
    } else if (isPlainObject(result[key]) && isPlainObject(importedValue)) {
      result[key] = mergeImport(result[key], importedValue, priority);
    } else if (priority === 'overwrite') {
      result[key] = structuredClone(importedValue);
    }
  }

  return result;
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
