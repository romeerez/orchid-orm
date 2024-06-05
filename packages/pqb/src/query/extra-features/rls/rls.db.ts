import { RawSqlBase } from '../../expressions/raw-sql';

export namespace RlsPolicy {
  export type PolicyMode = 'PERMISSIVE' | 'RESTRICTIVE';
  export type PolicyCommand = 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

  interface Base {
    name: string;
    to: string | string[];
  }

  export interface ForSelectOrDelete extends Base {
    for: 'SELECT' | 'DELETE';
    using: RawSqlBase;
    withCheck?: never;
  }

  export interface ForInsert extends Base {
    for: 'INSERT';
    using?: never;
    withCheck: RawSqlBase;
  }

  export interface ForAllOrUpdate extends Base {
    for?: 'ALL' | 'UPDATE';
    using: RawSqlBase;
    withCheck: RawSqlBase;
  }

  export type Policy = ForSelectOrDelete | ForInsert | ForAllOrUpdate;
}

export interface TableRlsConfig {
  enable?: boolean;
  force?: boolean;
  permit?: RlsPolicy.Policy[];
  restrict?: RlsPolicy.Policy[];
}

export interface DbRlsOptions {
  tableRlsDefaults?: TableRlsConfig;
}
