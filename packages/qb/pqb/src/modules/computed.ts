import {
  EmptyObject,
  Expression,
  FnUnknownToUnknown,
  MaybePromise,
  QueryColumn,
  QueryColumns,
  QueryMetaBase,
  RecordUnknown,
} from 'orchid-core';
import { Query, QueryOrExpression } from '../query/query';
import { ExpressionMethods, SqlMethod } from '../queryMethods';
import { RelationsBase } from '../relations';
import { ColumnType } from '../columns';

declare module 'orchid-core' {
  interface ColumnDataBase {
    // SQL computed columns have an Expression in their data, which will be used for building SQL.
    computed?: Expression;
  }
}

export type ComputedColumnsFromOptions<
  T extends ComputedOptionsFactory<never, never> | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = T extends (...args: any[]) => any
  ? {
      [K in keyof ReturnType<T>]: ReturnType<T>[K]['result']['value'];
    }
  : EmptyObject;

export type ComputedOptionsFactory<ColumnTypes, Shape extends QueryColumns> = (
  t: ComputedMethods<ColumnTypes, Shape>,
) => { [K: string]: QueryOrExpression<unknown> };

export interface RuntimeComputedQueryColumn<OutputType> extends QueryColumn {
  dataType: 'runtimeComputed';
  type: never;
  outputType: OutputType;
  queryType: undefined;
  operators: { cannotQueryRuntimeComputed: never };
}

export interface ComputedMethods<ColumnTypes, Shape extends QueryColumns>
  extends QueryComputedArg<ColumnTypes, Shape> {
  computeAtRuntime<Deps extends keyof Shape, OutputType>(
    dependsOn: Deps[],
    fn: (record: Pick<Shape, Deps>) => OutputType,
  ): { result: { value: RuntimeComputedQueryColumn<OutputType> } };

  computeBatchAtRuntime<Deps extends keyof Shape, OutputType>(
    dependsOn: Deps[],
    fn: (record: Pick<Shape, Deps>[]) => MaybePromise<OutputType[]>,
  ): { result: { value: RuntimeComputedQueryColumn<OutputType> } };
}

export class ComputedColumn {
  constructor(
    public kind: 'one' | 'many',
    public deps: string[],
    public fn: FnUnknownToUnknown,
  ) {}
}

export interface ComputedColumns {
  [K: string]: ComputedColumn;
}

const computeAtRuntime = (deps: string[], fn: () => void) =>
  new ComputedColumn('one', deps, fn);
const computeBatchAtRuntime = (deps: string[], fn: () => void) =>
  new ComputedColumn('many', deps, fn);

export interface QueryComputedArg<ColumnTypes, Shape extends QueryColumns>
  extends ExpressionMethods,
    SqlMethod<ColumnTypes> {
  shape: Shape;
  columnTypes: ColumnTypes;
  windows: EmptyObject;
  relations: RelationsBase;
  result: EmptyObject;
  meta: Omit<QueryMetaBase, 'selectable'> & {
    selectable: { [K in keyof Shape]: { as: string; column: QueryColumn } };
  };
}

export const applyComputedColumns = (
  q: Query,
  fn: ComputedOptionsFactory<never, never>,
) => {
  (q as unknown as RecordUnknown).computeAtRuntime = computeAtRuntime;
  (q as unknown as RecordUnknown).computeBatchAtRuntime = computeBatchAtRuntime;

  const computed = fn(q as never);
  for (const key in computed) {
    const item = computed[key];
    if (item instanceof ComputedColumn) {
      (q.q.computeds ??= {})[key] = item;
    } else {
      (
        ((q.shape as QueryColumns)[key] = item.result
          .value as never) as ColumnType
      ).data.computed = item as Expression;
    }
  }

  (q as unknown as RecordUnknown).computeAtRuntime = (
    q as unknown as RecordUnknown
  ).computeBatchAtRuntime = undefined;
};
