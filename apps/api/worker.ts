import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import app from './src/app';
import { withRequestDatabase } from './src/lib/prisma';

interface Env {
  HYPERDRIVE: { connectionString: string };
}

const handler = httpServerHandler(createServer(app));

export default {
  fetch(request: Request, env: Env, context: Parameters<typeof handler.fetch>[2]) {
    return withRequestDatabase(env.HYPERDRIVE.connectionString, () => handler.fetch(request, env, context));
  },
};
