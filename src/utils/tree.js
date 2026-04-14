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

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
