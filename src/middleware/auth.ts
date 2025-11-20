/**
 * Authentication middleware for admin routes
 *
 * Requires Bearer token authentication for sensitive operations
 */

import { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

/**
 * Verify Bearer token from Authorization header
 *
 * @param c - Hono context
 * @param next - Next middleware
 * @returns 401 if unauthorized, otherwise continues
 */
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    logger.warn({ path: c.req.path }, 'Missing Authorization header');
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Missing Authorization header',
      },
      401
    );
  }

  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    logger.warn({ path: c.req.path }, 'Invalid Authorization header format');
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Invalid Authorization header format. Expected: Bearer <token>',
      },
      401
    );
  }

  const expectedToken = process.env.ADMIN_SECRET;

  if (!expectedToken) {
    logger.error('ADMIN_SECRET environment variable not set');
    return c.json(
      {
        error: 'Server Configuration Error',
        message: 'Authentication not configured',
      },
      500
    );
  }

  if (token !== expectedToken) {
    logger.warn({ path: c.req.path }, 'Invalid token provided');
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Invalid authentication token',
      },
      401
    );
  }

  logger.debug({ path: c.req.path }, 'Authentication successful');
  await next();
}
