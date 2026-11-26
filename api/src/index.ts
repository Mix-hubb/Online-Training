// Server entry: loads config, builds the app, starts listening.
// Shutdown (2026-11-26): Railway sends SIGTERM on every redeploy. Stop taking new connections, let the
// requests in flight finish (up to 10 s), close the DB pool, then exit.
// A crash (uncaught exception) is logged and the process exits so Railway restarts it in a clean state;
// a rejected promise nobody handled is only logged (Express already turns route errors into 500s).
import { createApp } from './app.js';
import { prisma } from './db.js';

const port = Number(process.env.PORT ?? 4000);

const server = createApp().listen(port, () => {
  console.log(`API listening on :${port}`);
});

let closing = false;
function shutdown(reason: string, code = 0) {
  if (closing) return;
  closing = true;
  console.log(`Shutting down (${reason})`);
  const force = setTimeout(() => process.exit(code), 10_000);
  force.unref();
  server.close(() => {
    prisma
      .$disconnect()
      .catch(() => undefined)
      .finally(() => process.exit(code));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException', 1);
});
