import app from './app';
import { config } from './config';

if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const server = app.listen(config.port, () => {
  console.log(`Helpdesk API running on http://localhost:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
