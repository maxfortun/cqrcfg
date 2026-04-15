import { authHook } from '../middleware/auth.js';
import { authzHook } from '../middleware/authz.js';
import { normalizePathHook } from '../middleware/normalizePath.js';
import {
  getSubtree,
  getSubtreeWithFilter,
  listPaths,
  searchPaths,
  patchNode,
  putNode,
  deleteSubtree,
} from '../services/configService.js';
import { hasWildcard } from '../storage/interface.js';

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

      // Check for wildcard search - pattern conversion happens in storage layer
      if (hasWildcard(path)) {
        paths = await searchPaths(path);
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

      // Apply query parameter filters at storage layer if any
      const filters = request.query;
      const hasFilters = filters && Object.keys(filters).length > 0;

      const tree = hasFilters
        ? await getSubtreeWithFilter(path, filters)
        : await getSubtree(path);

      if (tree === null) {
        const message = hasFilters
          ? `Configuration at path ${path} does not match filter criteria`
          : `No configuration found at path: ${path}`;
        return reply.code(404).send({
          error: 'Not Found',
          message,
        });
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
