import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ACCESS_TTL_SECONDS } from '../services/auth-tokens.js';

const prefix = env.NODE_ENV === 'production' ? '__Secure-' : '';
export const accessCookie = `${prefix}devflow_access`;
export const refreshCookie = `${prefix}devflow_refresh`;
const common: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
};
const accessOptions = { ...common, path: '/api' };
const refreshOptions = { ...common, path: '/api/v1/auth' };

export function readCookie(request: Request, name: string): string | undefined {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== 'object' || cookies === null || !(name in cookies)) return undefined;
  const value: unknown = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

export function setAuthCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken: string; expiresAt: Date },
) {
  response.cookie(accessCookie, tokens.accessToken, {
    ...accessOptions,
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
  response.cookie(refreshCookie, tokens.refreshToken, {
    ...refreshOptions,
    expires: tokens.expiresAt,
  });
}

export function clearAuthCookies(response: Response) {
  response.clearCookie(accessCookie, accessOptions);
  response.clearCookie(refreshCookie, refreshOptions);
}
