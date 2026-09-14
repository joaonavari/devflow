import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

export function loadEnvironment(): void {
  // This path works in both src/config and compiled dist/config.
  const envPath = fileURLToPath(new URL('../../../.env', import.meta.url));

  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }
}
