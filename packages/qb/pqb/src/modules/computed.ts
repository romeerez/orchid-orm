import {
  EmptyObject,
  Expression,
  FnUnknownToUnknown,
  MaybePromise,
  QueryColumn,
  QueryColumns,
  QueryMetaBase,
  QueryReturnType,
  RecordString,
  RecordUnknown,
} from 'orchid-core';
import { Query, QueryOrExpression } from '../query/query';
import {
  ExpressionMethods,
  QueryBatchResult,
  SqlMethod,
} from '../queryMethods';
import { RelationsBase } from '../relations';
import { ColumnType, UnknownColumn } from '../columns';
import { QueryData } from '../sql';
import {
  applyBatchTransforms,
  finalizeNestedHookSelect,
} from '../common/queryResultProcessing';

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
        ((q.shape as QueryColumns)[key] =
          item.result.value || UnknownColumn.instance) as ColumnType
      ).data.computed = item as Expression;
    }
  }

  (q as unknown as RecordUnknown).computeAtRuntime = (
    q as unknown as RecordUnknown
  ).computeBatchAtRuntime = undefined;
};

export const processComputedResult = (query: QueryData, result: unknown) => {
  let promises: Promise<void>[] | undefined;

  for (const key in query.selectedComputeds) {
    const computed = query.selectedComputeds[key];
    if (computed.kind === 'one') {
      for (const record of result as RecordUnknown[]) {
        record[key] = computed.fn(record);
      }
    } else {
      const res = computed.fn(result);
      if (Array.isArray(res)) {
        saveBatchComputed(key, result, res);
      } else {
        (promises ??= []).push(
          (res as Promise<unknown[]>).then((res) =>
            saveBatchComputed(key, result, res),
          ),
        );
      }
    }
  }

  if (!promises) return;
  return Promise.all(promises);
};

export const processComputedBatches = (
  query: QueryData,
  batches: QueryBatchResult[],
  originalReturnType: QueryReturnType,
  returnType: QueryReturnType,
  tempColumns: Set<string> | undefined,
  renames: RecordString | undefined,
  key: string,
) => {
  let promises: Promise<void>[] | undefined;

  for (const key in query.selectedComputeds) {
    const computed = query.selectedComputeds[key];
    if (computed.kind === 'one') {
      for (const { data } of batches) {
        for (const record of data) {
          if (record) {
            record[key] = computed.fn(record);
          }
        }
      }
    } else {
      for (const { data } of batches) {
        let present;
        let blanks: Set<number> | undefined;
        if (!returnType || returnType === 'all') {
          present = data;
        } else {
          present = [];
          blanks = new Set<number>();
          for (let i = 0; i < data.length; i++) {
            if (data[i]) {
              present.push(data[i]);
            } else {
              blanks.add(i);
            }
          }
        }

        const res = computed.fn(present);
        if (Array.isArray(res)) {
          saveBatchComputed(key, data, res, blanks);
        } else {
          (promises ??= []).push(
            (res as Promise<unknown[]>).then((res) =>
              saveBatchComputed(key, data, res, blanks),
            ),
          );
        }
      }
    }
  }

  if (!promises) return;

  return Promise.all(promises).then(() => {
    finalizeNestedHookSelect(
      batches,
      originalReturnType,
      tempColumns,
      renames,
      key,
    );

    applyBatchTransforms(query, batches);
  });
};

const saveBatchComputed = (
  key: string,
  result: unknown,
  res: unknown[],
  blanks?: Set<number>,
) => {
  const len = (result as unknown[]).length;
  const actual = res.length + (blanks?.size || 0);
  if (len !== actual) {
    throw new Error(
      `Incorrect length of batch computed result for column ${key}. Expected ${len}, received ${actual}.`,
    );
  }

  if (blanks) {
    for (let i = 0, r = 0; i < len; i++) {
      if (!blanks.has(i)) {
        (result as RecordUnknown[])[i][key] = res[r++];
      }
    }
  } else {
    for (let i = 0; i < len; i++) {
      (result as RecordUnknown[])[i][key] = res[i];
    }
  }
};
