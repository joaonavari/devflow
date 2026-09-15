import { Router } from 'express';
import * as controller from '../controllers/project.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const projectRouter = Router();
projectRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
projectRouter.use(authenticate);
projectRouter.get('/', controller.list);
projectRouter.post('/', controller.create);
projectRouter.get('/:projectId', controller.detail);
projectRouter.patch('/:projectId', controller.update);
projectRouter.patch('/:projectId/archive', controller.archive);
projectRouter.patch('/:projectId/restore', controller.restore);
projectRouter.delete('/:projectId', controller.remove);
