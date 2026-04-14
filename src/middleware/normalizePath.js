/**
 * Path normalization hook.
 * Ensures consistent /config/... formatting and prevents path traversal.
 */
export async function normalizePathHook(request, reply) {
  // Get the path from URL params (Fastify wildcard captures everything after /config/)
  let path = request.params['*'] || '';

  // Remove leading/trailing slashes for processing
  path = path.replace(/^\/+|\/+$/g, '');

  // Check for path traversal attempts
  if (containsTraversal(path)) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: 'Path traversal is not allowed',
    });
  }

  // Normalize multiple consecutive slashes
  path = path.replace(/\/+/g, '/');

  // Build the final normalized path
  // Always prefix with /config
  const normalizedPath = path ? `/config/${path}` : '/config';

  // Validate path segments (no empty segments after split)
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.some((seg) => seg.trim() === '')) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: 'Invalid path format',
    });
  }

  // Attach normalized path to request
  request.configPath = normalizedPath;
}

/**
 * Check for path traversal patterns
 */
function containsTraversal(path) {
  const segments = path.split('/');

  for (const segment of segments) {
    // Check for .. traversal
    if (segment === '..') {
      return true;
    }

    // Check for encoded traversal
    if (segment.includes('%2e%2e') || segment.includes('%2E%2E')) {
      return true;
    }
  }

  return false;
}
