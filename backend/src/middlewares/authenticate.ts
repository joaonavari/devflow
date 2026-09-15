import type { RequestHandler } from 'express';
import { accessCookie, readCookie } from '../controllers/auth-cookies.js';
import { authenticatedUser } from '../services/auth.service.js';

export const authenticate: RequestHandler = async (request, response, next) => {
  const session = await authenticatedUser(readCookie(request, accessCookie));
  response.locals.user = session.user;
  response.locals.sessionId = session.id;
  next();
};
