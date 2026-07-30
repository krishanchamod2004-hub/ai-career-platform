import type { RedisOptions } from 'ioredis';

/**
 * Converts a `redis://` / `rediss://` URL into ioredis options.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on its connections (blocking
 * commands must not time out), and each Queue/Worker should own its connection —
 * so queues are configured with plain options rather than the shared app client.
 */
export function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const isSecure = parsed.protocol === 'rediss:';
  const dbSegment = parsed.pathname.replace('/', '');

  const options: RedisOptions = {
    host: parsed.hostname || 'localhost',
    port: parsed.port ? Number(parsed.port) : 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (parsed.username) {
    options.username = decodeURIComponent(parsed.username);
  }
  if (parsed.password) {
    options.password = decodeURIComponent(parsed.password);
  }
  if (dbSegment) {
    options.db = Number(dbSegment);
  }
  if (isSecure) {
    options.tls = {};
  }

  return options;
}
