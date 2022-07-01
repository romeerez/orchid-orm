import { Pool, PoolConfig, QueryResultRow } from 'pg';
import { PostgresAdapter } from './orm';

export const Pg = (config: PoolConfig): PostgresAdapter => {
  const pool = new Pool(config);

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async query<T extends QueryResultRow = any>(
      query: string,
    ): Promise<{ rows: T[] }> {
      const client = await pool.connect();
      try {
        return await client.query<T>(query);
      } finally {
        client.release();
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async arrays<R extends any[] = any[]>(
      query: string,
    ): Promise<{ rows: R[] }> {
      const client = await pool.connect();
      try {
        return await client.query<R>({
          text: query,
          rowMode: 'array',
        });
      } finally {
        client.release();
      }
    },
    destroy() {
      return pool.end();
    },
  };
};
