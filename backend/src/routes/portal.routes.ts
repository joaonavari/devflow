import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as controller from '../controllers/portal.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
export const portalPrivacy: RequestHandler = (_req, res, next) => {
  res.set({
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  });
  next();
};
export const portalRouter = Router();
portalRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Muitas solicitações. Aguarde um minuto e tente novamente.',
      },
    },
  }),
);
portalRouter.get('/:token', controller.read);
export const stageRouter = Router();
stageRouter.use(portalPrivacy, authenticate);
stageRouter.patch('/:stageId', controller.updateStage);
stageRouter.patch('/:stageId/move', controller.moveStage);
stageRouter.delete('/:stageId', controller.deleteStage);
