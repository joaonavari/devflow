import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes.js';
import { originGuard } from './middlewares/origin-guard.js';
import { errorHandler } from './middlewares/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { clientRouter } from './routes/client.routes.js';
import { projectRouter } from './routes/project.routes.js';
import { taskRouter } from './routes/task.routes.js';

export const app = express();

app.disable('x-powered-by');
app.use('/api', originGuard);
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/clients', clientRouter);
app.use('/api/v1/projects', projectRouter);
app.use('/api/v1/tasks', taskRouter);
app.use('/api/v1/health', healthRouter);

app.use((_request, response) => {
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' },
  });
});

app.use(errorHandler);
