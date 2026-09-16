import { Router } from 'express';
import * as controller from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/authenticate.js';

export const paymentRouter = Router();
paymentRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
paymentRouter.use(authenticate);
paymentRouter.get('/', controller.listGlobal);
paymentRouter.get('/:paymentId', controller.detail);
paymentRouter.patch('/:paymentId', controller.update);
paymentRouter.patch('/:paymentId/pay', controller.pay);
paymentRouter.patch('/:paymentId/reopen', controller.reopen);
paymentRouter.delete('/:paymentId', controller.remove);
