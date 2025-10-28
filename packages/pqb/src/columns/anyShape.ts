import { emptyObject, QueryColumnsInit } from '../core';
import { UnknownColumn } from './unknown';

export const anyShape = new Proxy(emptyObject, {
  get() {
    return UnknownColumn.instance;
  },
}) as QueryColumnsInit;
