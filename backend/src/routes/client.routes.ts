import { Router } from 'express';
import * as controller from '../controllers/client.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const clientRouter = Router();
clientRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
clientRouter.use(authenticate);
clientRouter.get('/', controller.list);
clientRouter.post('/', controller.create);
clientRouter.get('/:clientId', controller.detail);
clientRouter.patch('/:clientId', controller.update);
clientRouter.patch('/:clientId/archive', controller.archive);
clientRouter.patch('/:clientId/restore', controller.restore);
clientRouter.delete('/:clientId', controller.remove);
