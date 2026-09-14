import type { Request, Response } from 'express';
import { checkDatabaseConnection } from '../services/health.service.js';

export function getHealth(_request: Request, response: Response): void {
  response.status(200).json({ status: 'ok', service: 'devflow-api' });
}

export async function getReadiness(_request: Request, response: Response): Promise<void> {
  try {
    await checkDatabaseConnection();
    response.status(200).json({ status: 'ok', database: 'up' });
  } catch {
    response.status(503).json({ status: 'error', database: 'down' });
  }
}
