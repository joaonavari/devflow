import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { unauthorized } from './auth-error.js';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const key = Buffer.from(env.JWT_SECRET, 'hex');
const issuer = 'devflow-api';
const audience = 'devflow-web';

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createRefreshToken(sessionId: string): string {
  return `${sessionId}.${randomBytes(32).toString('base64url')}`;
}

export function refreshSessionId(token: string | undefined): string {
  const parts = token?.split('.');
  if (
    parts?.length !== 2 ||
    !z.uuid().safeParse(parts[0]).success ||
    !/^[A-Za-z0-9_-]{43}$/.test(parts[1] ?? '')
  )
    throw unauthorized();
  return parts[0] ?? '';
}

export function createAccessToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${String(ACCESS_TTL_SECONDS)}s`)
    .sign(key);
}

export async function verifyAccessToken(token: string | undefined) {
  if (!token) throw unauthorized();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer,
      audience,
      typ: 'JWT',
      requiredClaims: ['sub', 'sid', 'iat', 'exp'],
      maxTokenAge: '15m',
    });
    return z.object({ sub: z.uuid(), sid: z.uuid() }).parse(payload);
  } catch {
    throw unauthorized();
  }
}
