// Applies migrations to the test database once before all tests.
// DIRECT_URL is set too: prisma would otherwise read it from .env and migrate the dev database.
import { execSync } from 'node:child_process';

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/online_training_test';
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url } });
}
