import { JSONPath } from 'jsonpath-plus';
import { getSubtree } from './configService.js';
import { hasPermission } from '../middleware/authz.js';
import { mergeImport } from '../utils/tree.js';
import {
  IMPORT_KEY,
  PRIORITIES,
  ImportError,
  hasImports,
  normalizeSourcePath,
} from '../utils/imports.js';
import { config } from '../config.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Apply a JSONPath filter to a (resolved) source and return an object of the
 * selected keys/values. Each match contributes `{ <last path segment>: value }`;
 * a match on the root contributes its own keys.
 */
function applyFilter(sourceData, filter, ctx) {
  let matches;
  try {
    matches = JSONPath({ path: filter, json: sourceData, resultType: 'all' });
  } catch (err) {
    throw new ImportError(
      'INVALID_FILTER',
      `Invalid JSONPath filter "${filter}" in import of ${ctx.source} (in ${ctx.importedFrom}): ${err.message}`,
      ctx,
    );
  }

  let extracted = {};
  for (const match of matches || []) {
    if (match.parentProperty === undefined || match.parentProperty === null) {
      // Root match: import the object's own keys
      if (isPlainObject(match.value)) extracted = mergeImport(extracted, match.value, 'overwrite');
      continue;
    }
    extracted = mergeImport(extracted, { [String(match.parentProperty)]: match.value }, 'overwrite');
  }
  return extracted;
}

async function resolveTag(tag, ctx) {
  const importedFrom = ctx.stack[ctx.stack.length - 1];

  if (!isPlainObject(tag)) {
    throw new ImportError('INVALID_IMPORT_TAG', `${IMPORT_KEY} in ${importedFrom} must be an object`, { importedFrom });
  }

  const source = normalizeSourcePath(tag.source);
  if (!source) {
    throw new ImportError(
      'INVALID_IMPORT_TAG',
      `${IMPORT_KEY} in ${importedFrom} requires a valid "source" path`,
      { source: tag.source, importedFrom },
    );
  }

  const priority = tag.priority === undefined ? 'keep' : tag.priority;
  if (!PRIORITIES.includes(priority)) {
    throw new ImportError(
      'INVALID_IMPORT_TAG',
      `${IMPORT_KEY} of ${source} in ${importedFrom} has invalid priority "${tag.priority}" (expected keep or overwrite)`,
      { source, importedFrom },
    );
  }

  if (tag.filter !== undefined && (typeof tag.filter !== 'string' || tag.filter.trim() === '')) {
    throw new ImportError(
      'INVALID_FILTER',
      `${IMPORT_KEY} of ${source} in ${importedFrom} has a filter that is not a non-empty JSONPath string`,
      { source, importedFrom },
    );
  }

  const details = { source, importedFrom, chain: [...ctx.stack, source] };

  if (ctx.stack.includes(source)) {
    throw new ImportError(
      'CIRCULAR_IMPORT',
      `Circular import detected: ${details.chain.join(' -> ')}`,
      details,
    );
  }

  if (ctx.stack.length > config.imports.maxDepth) {
    throw new ImportError(
      'IMPORT_DEPTH_EXCEEDED',
      `Import depth limit (${config.imports.maxDepth}) exceeded: ${details.chain.join(' -> ')}`,
      details,
    );
  }

  if (!hasPermission(ctx.user, source, 'read')) {
    throw new ImportError(
      'FORBIDDEN_SOURCE',
      `Access denied: no read permission for imported source ${source} (imported from ${importedFrom})`,
      details,
    );
  }

  const sourceTree = await getSubtree(source);
  if (sourceTree === null) {
    throw new ImportError(
      'SOURCE_NOT_FOUND',
      `Import source not found: ${source} (imported from ${importedFrom})`,
      details,
    );
  }

  // Resolve imports inside the source first (nested imports)
  const resolvedSource = await resolveNode(sourceTree, { ...ctx, stack: [...ctx.stack, source] });

  const imported = tag.filter === undefined
    ? resolvedSource
    : applyFilter(resolvedSource, tag.filter, details);

  return { imported, priority };
}

async function resolveNode(node, ctx) {
  if (!hasImports(node)) return node;

  if (Array.isArray(node)) {
    return Promise.all(node.map((item) => resolveNode(item, ctx)));
  }

  const { [IMPORT_KEY]: tag, ...rest } = node;
  const hasTag = Object.prototype.hasOwnProperty.call(node, IMPORT_KEY);

  let result = {};
  for (const key of Object.keys(rest)) {
    result[key] = await resolveNode(rest[key], ctx);
  }

  if (hasTag) {
    const { imported, priority } = await resolveTag(tag, ctx);
    if (isPlainObject(imported)) {
      result = mergeImport(result, imported, priority);
    }
  }

  return result;
}

/**
 * Resolve all ___import tags in a tree read from `path`.
 * Never mutates `tree` (it may be a shared cached object); trees without
 * imports are returned as is.
 *
 * @param {object} tree - Raw tree
 * @param {{ path: string, user: object }} options
 * @returns {Promise<object>} resolved tree
 * @throws {ImportError}
 */
export async function resolveImports(tree, { path, user }) {
  if (!hasImports(tree)) return tree;
  return resolveNode(tree, { user, stack: [path] });
}
