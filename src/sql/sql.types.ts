export interface QueryResultRow {
  [column: string]: any;
}

export type SqlOrm = {
  adapter: SqlAdapter
  destroy(): Promise<void>
}

export type SqlAdapter = {
  query<T extends QueryResultRow = any>(query: string): Promise<{ rows: T[] }>;
  arrays<R extends any[] = any[]>(query: string): Promise<{ rows: R[] }>;
  destroy(): Promise<void>;
};
