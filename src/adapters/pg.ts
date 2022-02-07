import { Pool, PoolConfig, QueryResultRow } from 'pg';

export const Pg = (config: PoolConfig) => {
  const pool = new Pool(config);

  return {
    async query<T extends QueryResultRow = any>(
      query: string
    ): Promise<{ rows: T[] }> {
      const client = await pool.connect();
      try {
        return await client.query<T>(query);
      } finally {
        client.release();
      }
    },
    destroy() {
      return pool.end();
    },
  };
};
