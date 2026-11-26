import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/helpdesk-password-client';
import { config } from '../config';

const requestClient = new AsyncLocalStorage<PrismaClient>();
let localClient: PrismaClient | undefined;

function createClient(connectionString: string) {
  const url = new URL(connectionString);
  const schema = url.searchParams.get('schema') ?? undefined;
  // Raw statements also need the selected schema on direct Node connections.
  if (schema && schema !== 'public' && !config.isWorker) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) throw new Error('Invalid PostgreSQL schema name');
    const options = url.searchParams.get('options');
    url.searchParams.set('options', [options, `-csearch_path="${schema}"`].filter(Boolean).join(' '));
  }
  const adapter = new PrismaPg({ connectionString: url.href }, { schema });
  return new PrismaClient({ adapter, log: ['error'] });
}

export async function withRequestDatabase<T>(connectionString: string, run: () => Promise<T>) {
  const client = createClient(connectionString);
  try {
    return await requestClient.run(client, run);
  } finally {
    await client.$disconnect();
  }
}

function getClient() {
  const client = requestClient.getStore();
  if (client) return client;
  if (config.isWorker) throw new Error('Missing request database binding');
  return localClient ??= createClient(config.database.url);
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default prisma;
