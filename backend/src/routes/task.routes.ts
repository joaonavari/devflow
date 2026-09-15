import { Router } from 'express';
import * as controller from '../controllers/task.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const taskRouter = Router();
taskRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
taskRouter.use(authenticate);
taskRouter.get('/', controller.listGlobal);
taskRouter.get('/:taskId', controller.detail);
taskRouter.patch('/:taskId', controller.update);
taskRouter.patch('/:taskId/move', controller.move);
taskRouter.delete('/:taskId', controller.remove);
