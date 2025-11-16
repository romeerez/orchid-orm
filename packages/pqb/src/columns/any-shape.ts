import { emptyObject, QueryColumnsInit } from '../core';
import { UnknownColumn } from './column-types/unknown';

export const anyShape = new Proxy(emptyObject, {
  get() {
    return UnknownColumn.instance;
  },
}) as QueryColumnsInit;
