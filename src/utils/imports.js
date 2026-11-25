/**
 * Shared helpers for the ___import feature.
 */

export const IMPORT_KEY = '___import';
export const PRIORITIES = ['keep', 'overwrite'];

/**
 * Error raised while resolving ___import tags. `code` is one of:
 * INVALID_IMPORT_TAG, SOURCE_NOT_FOUND, INVALID_FILTER, CIRCULAR_IMPORT,
 * IMPORT_DEPTH_EXCEEDED, FORBIDDEN_SOURCE.
 */
export class ImportError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    this.source = details.source;
    this.importedFrom = details.importedFrom;
    this.chain = details.chain;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}

/**
 * Cheap recursive check for an ___import key anywhere in a tree.
 */
export function hasImports(node) {
  if (!isObject(node)) return false;

  if (Array.isArray(node)) {
    return node.some(hasImports);
  }

  if (Object.prototype.hasOwnProperty.call(node, IMPORT_KEY)) return true;

  for (const key of Object.keys(node)) {
    if (hasImports(node[key])) return true;
  }
  return false;
}

/**
 * Normalise an import `source` to an absolute /config/... path.
 * Accepts "app/shared", "/app/shared" or "/config/app/shared".
 * Returns null if the source is not a usable path.
 */
export function normalizeSourcePath(source) {
  if (typeof source !== 'string') return null;

  const segments = source.split('/').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;
  if (segments.some((s) => s === '..' || s.toLowerCase().includes('%2e%2e'))) return null;

  if (segments[0] !== 'config') segments.unshift('config');
  return '/' + segments.join('/');
}

/**
 * Collect the normalised sources of every valid ___import tag in a tree.
 */
export function collectImportSources(node, found = []) {
  if (!isObject(node)) return found;

  if (Array.isArray(node)) {
    node.forEach((item) => collectImportSources(item, found));
    return found;
  }

  const tag = node[IMPORT_KEY];
  if (isObject(tag) && !Array.isArray(tag)) {
    const source = normalizeSourcePath(tag.source);
    if (source) found.push(source);
  }

  for (const key of Object.keys(node)) {
    if (key !== IMPORT_KEY) collectImportSources(node[key], found);
  }
  return found;
}

/**
 * True if two config paths are equal or one is an ancestor of the other.
 */
export function pathsRelated(a, b) {
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}
