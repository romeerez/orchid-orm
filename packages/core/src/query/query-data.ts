import { QueryDataAliases } from './query-aliases';
import { QueryColumnsInit } from 'orchid-core';

export interface QueryDataBase extends QueryDataAliases {
  shape: QueryColumnsInit;
}
