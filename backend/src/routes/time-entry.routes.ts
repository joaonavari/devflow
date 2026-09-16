import { Router } from 'express';
import * as controller from '../controllers/time-entry.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const timeEntryRouter = Router();
timeEntryRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
timeEntryRouter.use(authenticate);
timeEntryRouter.get('/', controller.listGlobal);
timeEntryRouter.get('/:timeEntryId', controller.detail);
timeEntryRouter.patch('/:timeEntryId', controller.update);
timeEntryRouter.delete('/:timeEntryId', controller.remove);
