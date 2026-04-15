import { authHook } from '../middleware/auth.js';
import { authzHook } from '../middleware/authz.js';
import { normalizePathHook } from '../middleware/normalizePath.js';
import {
  getSubtree,
  listPaths,
  searchPaths,
  patchNode,
  putNode,
  deleteSubtree,
} from '../services/configService.js';

/**
 * Check if a path contains wildcard characters
 */
function hasWildcard(path) {
  return path.includes('*') || path.includes('?');
}

/**
 * Convert glob-style pattern to regex
 * Supports: * (any chars except /), ** (any chars including /), ? (single char)
 */
function globToRegex(pattern) {
  let regex = '^';
  const specialChars = '\\^$.|+()[]{}';

  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // ** matches anything including /
        regex += '.*';
        i += 2;
      } else {
        // * matches anything except /
        regex += '[^/]*';
        i++;
      }
    } else if (char === '?') {
      // ? matches single char except /
      regex += '[^/]';
      i++;
    } else if (specialChars.includes(char)) {
      // Escape regex special chars
      regex += '\\' + char;
      i++;
    } else {
      regex += char;
      i++;
    }
  }

  regex += '$';
  return new RegExp(regex);
}

/**
 * Check if an object matches all filter criteria
 * Supports nested paths via dot notation (e.g., "db.host=localhost")
 * Values are compared as strings, numbers, or booleans
 */
function matchesFilter(obj, filters) {
  if (!obj || typeof obj !== 'object') return false;

  for (const [key, expectedValue] of Object.entries(filters)) {
    // Support nested paths with dot notation
    const value = getNestedValue(obj, key);

    if (value === undefined) return false;

    // Compare as appropriate type
    if (!valuesMatch(value, expectedValue)) return false;
  }

  return true;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Compare values with type coercion
 * Query params are strings, so we try to match against the actual type
 */
function valuesMatch(actual, expected) {
  // Direct string match
  if (String(actual) === expected) return true;

  // Try parsing expected as number
  if (typeof actual === 'number') {
    const num = Number(expected);
    if (!isNaN(num) && actual === num) return true;
  }

  // Try parsing expected as boolean
  if (typeof actual === 'boolean') {
    if (expected === 'true' && actual === true) return true;
    if (expected === 'false' && actual === false) return true;
  }

  return false;
}

/**
 * Helper to check authorization inline (for routes with conditional auth)
 */
async function checkAuthz(request, reply, requiredAction) {
  const user = request.user;
  const requestedPath = request.configPath;

  if (!user || !requestedPath) {
    reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Authorization check failed: missing user or path',
    });
    return false;
  }

  const permissions = user.permissions || [];

  const hasAccess = permissions.some((perm) => {
    // Check if permission path is a valid prefix of the requested path
    if (perm.path !== requestedPath && !requestedPath.startsWith(perm.path + '/')) {
      return false;
    }
    const actions = perm.actions || [];
    return actions.includes(requiredAction);
  });

  if (!hasAccess) {
    reply.code(403).send({
      error: 'Forbidden',
      message: `Access denied: no ${requiredAction} permission for path ${requestedPath}`,
    });
    return false;
  }

  return true;
}

export default async function configRoutes(fastify) {
  // Common preHandler hooks for all routes
  const commonHooks = [authHook, normalizePathHook];

  // GET /config/*
  // If path ends with '/', returns list of paths (requires 'list' permission)
  //   - Supports wildcards: * (single segment), ** (multi-segment), ? (single char)
  //   - Example: GET /config/app*/db/ matches /config/app1/db and /config/app2/db
  // Otherwise, returns the full JSON subtree (requires 'read' permission)
  fastify.get('/*', {
    preHandler: [authHook, normalizePathHook],
  }, async (request, reply) => {
    const path = request.configPath;
    const originalUrl = request.url;

    // Check if this is a LIST request (path ends with /)
    const isListRequest = originalUrl.endsWith('/');

    if (isListRequest) {
      // Check list permission
      const authzResult = await checkAuthz(request, reply, 'list');
      if (authzResult === false) return;

      let paths;

      // Check for wildcard search
      if (hasWildcard(path)) {
        const regex = globToRegex(path);
        paths = await searchPaths(regex);
      } else {
        paths = await listPaths(path);
      }

      if (paths === null) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `No configuration found matching: ${path}`,
        });
      }

      return { keys: paths };
    } else {
      // Check read permission
      const authzResult = await checkAuthz(request, reply, 'read');
      if (authzResult === false) return;

      const tree = await getSubtree(path);

      if (tree === null) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `No configuration found at path: ${path}`,
        });
      }

      // Apply query parameter filters if any
      const filters = request.query;
      if (filters && Object.keys(filters).length > 0) {
        if (!matchesFilter(tree, filters)) {
          return reply.code(404).send({
            error: 'Not Found',
            message: `Configuration at path ${path} does not match filter criteria`,
          });
        }
      }

      return tree;
    }
  });

  /**
   * PATCH /config/*
   * Deep merge partial JSON into existing node (upsert)
   */
  fastify.patch('/*', {
    preHandler: [...commonHooks, authzHook('write')],
  }, async (request, reply) => {
    const path = request.configPath;
    const data = request.body;

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Request body must be a JSON object',
      });
    }

    const result = await patchNode(path, data);

    return {
      path,
      data: result,
      message: 'Configuration updated successfully',
    };
  });

  /**
   * PUT /config/*
   * Fully replace node data
   */
  fastify.put('/*', {
    preHandler: [...commonHooks, authzHook('write')],
  }, async (request, reply) => {
    const path = request.configPath;
    const data = request.body;

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Request body must be a JSON object',
      });
    }

    const result = await putNode(path, data);

    return {
      path,
      data: result,
      message: 'Configuration replaced successfully',
    };
  });

  /**
   * DELETE /config/*
   * Delete all documents under the specified path prefix
   */
  fastify.delete('/*', {
    preHandler: [...commonHooks, authzHook('write')],
  }, async (request, reply) => {
    const path = request.configPath;
    const deletedCount = await deleteSubtree(path);

    if (deletedCount === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `No configuration found at path: ${path}`,
      });
    }

    return {
      path,
      deletedCount,
      message: 'Configuration deleted successfully',
    };
  });
}
