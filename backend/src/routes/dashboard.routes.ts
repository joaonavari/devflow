import { Router } from 'express';
import * as controller from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const dashboardRouter = Router();
dashboardRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
dashboardRouter.use(authenticate);
dashboardRouter.get('/', controller.detail);
