import { Router } from 'express';
import { getHealth, getReadiness } from '../controllers/health.controller.js';

export const healthRouter = Router();

healthRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});

healthRouter.get('/', getHealth);
healthRouter.get('/ready', getReadiness);
