import * as jose from 'jose';
import { config } from '../config.js';

let jwks = null;

async function getJWKS() {
  if (jwks) return jwks;

  jwks = jose.createRemoteJWKSet(new URL(config.oidc.jwksUri));
  return jwks;
}

/**
 * Check if a string looks like a JWT (three base64url segments separated by dots)
 */
function isJwtFormat(value) {
  const parts = value.split('.');
  return parts.length === 3;
}

/**
 * Parse a header value as JSON (supports base64 or plain JSON)
 */
function parseJsonHeaderValue(headerValue) {
  if (!headerValue) return null;

  try {
    // Try base64 decode first (common for proxied claims)
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    // Try plain JSON
    try {
      return JSON.parse(headerValue);
    } catch {
      return null;
    }
  }
}

/**
 * Build JWT verify options based on config
 */
function getJwtVerifyOptions() {
  const options = {
    algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
  };

  if (config.oidc.audience) {
    options.audience = config.oidc.audience;
  }

  return options;
}

/**
 * Parse and verify a JWT header value, returning the payload claims
 */
async function parseJwtHeaderValue(headerValue, keySet) {
  if (!headerValue) return null;

  const { payload } = await jose.jwtVerify(headerValue, keySet, getJwtVerifyOptions());
  return payload;
}

/**
 * Parse a header value - auto-detects JWT vs JSON/base64 format
 * JWTs are verified using the JWKS, JSON values are parsed directly
 */
async function parseHeaderValue(headerValue, keySet) {
  if (!headerValue) return null;

  // Check if it looks like a JWT
  if (isJwtFormat(headerValue)) {
    return parseJwtHeaderValue(headerValue, keySet);
  }

  // Otherwise try JSON/base64
  return parseJsonHeaderValue(headerValue);
}

/**
 * Extract and merge claims from configured header chain.
 * Headers are processed in order, with later headers taking precedence.
 * JWT headers are verified, JSON/base64 headers are parsed directly.
 */
async function extractClaimsFromHeaders(request, keySet) {
  const claimsHeaders = config.oidc.claimsHeaders;
  if (!claimsHeaders || claimsHeaders.length === 0) return null;

  let mergedClaims = null;

  for (const headerName of claimsHeaders) {
    const headerValue = request.headers[headerName.toLowerCase()];
    const claims = await parseHeaderValue(headerValue, keySet);

    if (claims) {
      if (mergedClaims === null) {
        mergedClaims = claims;
      } else {
        // Merge claims, later headers override earlier ones
        mergedClaims = { ...mergedClaims, ...claims };
      }
    }
  }

  return mergedClaims;
}

/**
 * Authentication hook - validates JWT and attaches user to request
 */
export async function authHook(request, reply) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing Authorization header',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected: Bearer <token>',
    });
  }

  const token = parts[1];

  try {
    const keySet = await getJWKS();
    const { payload } = await jose.jwtVerify(token, keySet, getJwtVerifyOptions());

    // Check for claims in separate headers (e.g., from a proxy that extracts id_token claims)
    // JWT-format headers are verified, JSON/base64 headers are parsed directly
    const externalClaims = await extractClaimsFromHeaders(request, keySet);
    const claims = externalClaims || payload;

    // Attach user info to request
    request.user = {
      sub: claims.sub || payload.sub,
      permissions: claims.config_permissions || [],
      claims,
    };
  } catch (error) {
    console.error('JWT verification failed:', error.message);

    if (error.code === 'ERR_JWT_EXPIRED') {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Token has expired',
      });
    }

    if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Token validation failed',
      });
    }

    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  }
}
