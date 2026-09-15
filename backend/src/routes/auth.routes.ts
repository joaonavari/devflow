import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const authRouter = Router();
authRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.',
    },
  },
});
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Muitas solicitações. Aguarde um minuto e tente novamente.',
    },
  },
});
authRouter.post('/register', credentialsLimiter, controller.register);
authRouter.post('/login', credentialsLimiter, controller.login);
authRouter.post('/refresh', refreshLimiter, controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', authenticate, controller.me);
