import { database } from '../config/database.js';

export async function checkDatabaseConnection(): Promise<void> {
  await database.$queryRaw`SELECT 1`;
}
