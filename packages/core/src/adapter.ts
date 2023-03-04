export type QueryInput = string | { text: string; values?: unknown[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResultRow = Record<string, any>;

export type AdapterBase = {
  query(query: QueryInput): Promise<unknown>;
  arrays(query: QueryInput): Promise<unknown>;
  transaction(cb: (adapter: AdapterBase) => Promise<unknown>): Promise<unknown>;
  close(): Promise<void>;
};
