import { emptyObject } from '../core';
import { UnknownColumn } from './column-types/unknown';
import { Column } from './column';

export const anyShape = new Proxy(emptyObject, {
  get() {
    return UnknownColumn.instance;
  },
}) as Column.QueryColumnsInit;
