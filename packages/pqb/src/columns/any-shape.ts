import { UnknownColumn } from './column-types/unknown';
import { Column } from './column';
import { emptyObject } from '../utils';

export const anyShape = new Proxy(emptyObject, {
  get() {
    return UnknownColumn.instance;
  },
}) as Column.QueryColumnsInit;
