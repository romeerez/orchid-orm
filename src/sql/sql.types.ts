export interface QueryResultRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [column: string]: any;
}

export type SqlOrm = {
  adapter: SqlAdapter;
  destroy(): Promise<void>;
};

export type SqlAdapter = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T extends QueryResultRow = any>(query: string): Promise<{ rows: T[] }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrays<R extends any[] = any[]>(query: string): Promise<{ rows: R[] }>;
  destroy(): Promise<void>;
};
