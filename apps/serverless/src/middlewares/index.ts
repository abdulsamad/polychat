import { createMiddleware } from 'hono/factory';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { timingSafeEqual } from 'node:crypto';

import { AppContext } from '@/index';

// Clerk configuration
const ISSUER_URL = process.env.CLERK_ISSUER_BASE_URL;
if (!ISSUER_URL) {
  throw new Error('CLERK_ISSUER_BASE_URL is required');
}
const AUTHORIZED_PARTIES = process.env.CLERK_AUTHORIZED_PARTIES?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (!AUTHORIZED_PARTIES?.length) {
  throw new Error('CLERK_AUTHORIZED_PARTIES is required');
}

const JWKS_URI = `${ISSUER_URL}/.well-known/jwks.json`;
const PROXY_SECRET = process.env.LAMBDA_PROXY_SECRET;

if (process.env.AWS_LAMBDA_FUNCTION_NAME && !PROXY_SECRET) {
  throw new Error('LAMBDA_PROXY_SECRET is required in AWS Lambda');
}

// Create a Remote JWKS client
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

export const proxyMiddleware = createMiddleware<AppContext>(async (c, next) => {
  if (PROXY_SECRET) {
    const providedSecret = c.req.header('x-polychat-proxy-secret');
    const expected = Buffer.from(PROXY_SECRET);
    const provided = Buffer.from(providedSecret || '');

    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      console.warn('[AUTH] Request did not come through the trusted API proxy');
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  await next();
});

// JWT Authentication Middleware
export const authMiddleware = createMiddleware<AppContext>(async (c, next) => {

  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    console.warn(`[AUTH] Missing or invalid Authorization header`);
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.includes(' ')) {
    console.warn(`[AUTH] Missing or invalid bearer token`);
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    console.info(`[AUTH] Verifying JWT token`);

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER_URL,
      algorithms: ['RS256'],
    });

    if (!payload.sub) {
      console.warn(`[AUTH] Verified token is missing a subject`);
      return c.json({ error: 'Invalid token' }, 401);
    }

    if (typeof payload.azp !== 'string' || !AUTHORIZED_PARTIES.includes(payload.azp)) {
      console.warn('[AUTH] Verified token has an unauthorized party');
      return c.json({ error: 'Invalid token' }, 401);
    }

    const user = { id: payload.sub };
    c.set('user', user);
    c.set('payload', payload);

    console.info(`[AUTH] Authentication successful - User: ${user.id}`);

    await next();
  } catch (err) {
    console.log(err);
    console.error(
      `[AUTH] Token verification failed - ` +
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
    return c.json({ error: 'Invalid token' }, 401);
  }
});
