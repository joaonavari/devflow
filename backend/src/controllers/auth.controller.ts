import type { RequestHandler } from 'express';
import * as auth from '../services/auth.service.js';
import { loginSchema, registerSchema } from '../validators/auth.schemas.js';
import {
  accessCookie,
  clearAuthCookies,
  readCookie,
  refreshCookie,
  setAuthCookies,
} from './auth-cookies.js';

export const register: RequestHandler = async (request, response) => {
  const result = await auth.register(registerSchema.parse(request.body));
  setAuthCookies(response, result);
  response.status(201).json({ user: result.user });
};

export const login: RequestHandler = async (request, response) => {
  const input = loginSchema.parse(request.body);
  const result = await auth.login(input.email, input.password);
  setAuthCookies(response, result);
  response.json({ user: result.user });
};

export const refresh: RequestHandler = async (request, response) => {
  const result = await auth.refresh(readCookie(request, refreshCookie));
  setAuthCookies(response, result);
  response.json({ user: result.user });
};

export const logout: RequestHandler = async (request, response) => {
  await auth.logout(readCookie(request, refreshCookie), readCookie(request, accessCookie));
  clearAuthCookies(response);
  response.sendStatus(204);
};

export const me: RequestHandler = (_request, response) => {
  const user: unknown = response.locals.user;
  response.json({ user });
};
