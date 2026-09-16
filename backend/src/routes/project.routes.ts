import { Router } from 'express';
import * as controller from '../controllers/project.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import * as taskController from '../controllers/task.controller.js';
import * as timeEntryController from '../controllers/time-entry.controller.js';
import * as paymentController from '../controllers/payment.controller.js';

export const projectRouter = Router();
projectRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
projectRouter.use(authenticate);
projectRouter.get('/:projectId/tasks', taskController.listProject);
projectRouter.post('/:projectId/tasks', taskController.create);
projectRouter.get('/:projectId/time-entries', timeEntryController.listProject);
projectRouter.post('/:projectId/time-entries', timeEntryController.create);
projectRouter.get('/:projectId/payments', paymentController.listProject);
projectRouter.post('/:projectId/payments', paymentController.create);
projectRouter.get('/', controller.list);
projectRouter.post('/', controller.create);
projectRouter.get('/:projectId', controller.detail);
projectRouter.patch('/:projectId', controller.update);
projectRouter.patch('/:projectId/archive', controller.archive);
projectRouter.patch('/:projectId/restore', controller.restore);
projectRouter.delete('/:projectId', controller.remove);
