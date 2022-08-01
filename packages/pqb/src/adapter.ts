import { Pool, PoolConfig, types } from 'pg';

export interface QueryResultRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [column: string]: any;
}

export type TypeParsers = Record<number, (input: string) => unknown>;

export type PostgresAdapter = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T extends QueryResultRow = any>(
    query: string,
    types?: TypeParsers,
  ): Promise<{ rows: T[] }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrays<R extends any[] = any[]>(
    query: string,
    types?: TypeParsers,
  ): Promise<{ rows: R[]; fields: { name: string }[] }>;
  destroy(): Promise<void>;
};

const defaultTypeParsers: TypeParsers = {};

for (const key in types.builtins) {
  const id = types.builtins[key as keyof typeof types.builtins];
  defaultTypeParsers[id] = types.getTypeParser(id);
}

[
  types.builtins.DATE,
  types.builtins.TIMESTAMP,
  types.builtins.TIMESTAMPTZ,
  types.builtins.TIME,
].forEach((id) => {
  delete defaultTypeParsers[id];
});

const returnArg = (arg: unknown) => arg;

export const Adapter = ({
  types: configTypes = defaultTypeParsers,
  ...config
}: Omit<PoolConfig, 'types'> & { types?: TypeParsers }): PostgresAdapter => {
  const pool = new Pool(config);

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async query<T extends QueryResultRow = any>(
      query: string,
      types: TypeParsers = configTypes,
    ): Promise<{ rows: T[] }> {
      const client = await pool.connect();
      try {
        return await client.query<T>({
          text: query,
          types: types && {
            getTypeParser(id) {
              return types[id] || returnArg;
            },
          },
        });
      } finally {
        client.release();
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async arrays<R extends any[] = any[]>(
      query: string,
      types: TypeParsers = configTypes,
    ): Promise<{ rows: R[]; fields: { name: string }[] }> {
      const client = await pool.connect();
      try {
        return await client.query<R>({
          text: query,
          rowMode: 'array',
          types: types && {
            getTypeParser(id) {
              return types[id] || returnArg;
            },
          },
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
