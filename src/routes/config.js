import { authHook } from '../middleware/auth.js';
import { authzHook } from '../middleware/authz.js';
import { normalizePathHook } from '../middleware/normalizePath.js';
import {
  getSubtree,
  patchNode,
  putNode,
  deleteSubtree,
} from '../services/configService.js';

export default async function configRoutes(fastify) {
  // Common preHandler hooks for all routes
  const commonHooks = [authHook, normalizePathHook];

  /**
   * GET /config/*
   * Returns the full JSON subtree under the specified path
   */
  fastify.get('/*', {
    preHandler: [...commonHooks, authzHook('read')],
  }, async (request, reply) => {
    const path = request.configPath;
    const tree = await getSubtree(path);

    if (tree === null) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `No configuration found at path: ${path}`,
      });
    }

    return tree;
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
