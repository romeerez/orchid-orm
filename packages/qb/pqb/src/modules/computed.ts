import { Query, SelectableFromShape } from '../query/query';
import {
  ColumnTypeBase,
  Expression,
  PickQueryTableMetaShape,
  QueryColumns,
} from 'orchid-core';

// Type of argument for computed columns, each value is a function returning an Expression.
export interface ComputedColumnsBase<T extends PickQueryTableMetaShape> {
  [K: string]: (q: T) => Expression;
}

// Map query type to apply computed columns to it.
// Computed columns are added to the query shape and to `selectable`.
// Not added to `result`, `then`, `catch`, so it doesn't return computed columns by default, only after explicit selecting.
export type QueryWithComputed<
  T extends PickQueryTableMetaShape,
  Computed extends ComputedColumnsBase<T>,
  Shape extends QueryColumns = {
    [K in keyof Computed]: ReturnType<Computed[K]>['_type'];
  },
> = {
  [K in keyof T]: K extends 'shape'
    ? T['shape'] & Shape
    : K extends 'meta'
    ? T['meta'] & {
        selectable: SelectableFromShape<Shape, T['table']>;
      }
    : T[K];
};

declare module 'orchid-core' {
  interface ColumnDataBase {
    // Computed columns have an Expression in their data, which will be used for building SQL.
    computed?: Expression;
  }
}

// Adds computed columns to the shape of query object.
export function addComputedColumns<
  T extends PickQueryTableMetaShape,
  Computed extends ComputedColumnsBase<T>,
>(q: T, computed: Computed): QueryWithComputed<T, Computed> {
  const { shape } = q as unknown as Query;
  for (const key in computed) {
    const expr = computed[key](q);
    (shape as QueryColumns)[key] = expr._type;
    (expr._type as ColumnTypeBase).data.computed = expr;
  }

  return q as never;
}
