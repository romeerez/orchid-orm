import { t } from 'tak';
import { Operators } from './queryBuilder/operators';
import { UnionToIntersection } from './utils';
import { RawExpression } from './queryBuilder/common';

type UnknownType = t.TakType<unknown>;

type ColumnMethods<D extends string, Ops extends Operators> = {
  dataType: D;
  operators: Ops;
  isPrimaryKey: boolean;
  isHidden: boolean;
  primaryKey<T extends UnknownType>(this: T): T & { isPrimaryKey: true };
  hidden<T extends UnknownType>(this: T): T & { isHidden: true };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columnMethods: Omit<ColumnMethods<any, any>, 'dataType' | 'operators'> = {
  isPrimaryKey: false,
  isHidden: false,
  primaryKey<T extends UnknownType>(this: T): T & { isPrimaryKey: true } {
    return Object.assign(this, { isPrimaryKey: true as const });
  },
  hidden<T extends UnknownType>(this: T): T & { isHidden: true } {
    return Object.assign(this, { isHidden: true as const });
  },
};

type Column<
  T extends UnknownType,
  D extends string,
  Ops extends Operators,
> = T & ColumnMethods<D, Ops>;

const column = <T extends UnknownType, D extends string, Ops extends Operators>(
  type: T,
  dataType: D,
  operators: Ops,
): Column<T, D, Ops> => {
  return Object.assign(type, columnMethods, { dataType, operators });
};

export type DataTypes = typeof dataTypes;
export const dataTypes = {
  bigint: () => column(t.bigint(), 'bigint', Operators.number),
  bigserial: () => column(t.bigint(), 'bigserial', Operators.number),
  boolean: () => column(t.boolean(), 'boolean', Operators.boolean),
  date: () => column(t.date(), 'date', Operators.date),
  decimal: () => column(t.number(), 'decimal', Operators.number),
  float: () => column(t.number(), 'float', Operators.number),
  integer: () => column(t.number(), 'integer', Operators.number),
  text: () => column(t.string(), 'text', Operators.text),
  string: () => column(t.string(), 'text', Operators.text),
  smallint: () => column(t.number(), 'smallint', Operators.number),
  smallserial: () => column(t.number(), 'smallserial', Operators.number),
  time: () => column(t.number(), 'time', Operators.time),
  timestamp: () => column(t.date(), 'timestamp', Operators.date),
  timestamptz: () => column(t.date(), 'timestamptz', Operators.date),
  binary: () => column(t.string(), 'binary', Operators.any),
  serial: () => column(t.number(), 'serial', Operators.number),
};

export type ColumnsShape = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UnknownType & ColumnMethods<any, any>
>;

type SchemaMethods = typeof schemaMethods;

// Converts union to overloaded function
type UnionToOvlds<S, U> = UnionToIntersection<
  U extends keyof S ? (f: U) => void : never
>;

type PopUnion<S extends ColumnsShape, U extends keyof S> = UnionToOvlds<
  S,
  U
> extends (a: infer A extends keyof S) => void
  ? A
  : never;

type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

export type UnionToArray<
  S extends ColumnsShape,
  T extends keyof S,
  A extends [...(keyof S)[]] = [],
> = IsUnion<T> extends true
  ? UnionToArray<S, Exclude<T, PopUnion<S, T>>, [PopUnion<S, T>, ...A]>
  : [T, ...A];

export type GetPrimaryKeys<S extends ColumnsShape> = UnionToArray<
  S,
  { [K in keyof S]: S[K] extends { isPrimaryKey: true } ? K : never }[keyof S]
>;

export type GetPrimaryTypes<
  S extends ColumnsShape,
  Keys extends [...(keyof S | string)[]],
> = GetTypesFromKeys<S, Keys>;

type GetTypesFromKeys<
  S extends ColumnsShape,
  T extends [...(keyof S)[]],
> = T extends [
  infer Head extends keyof S,
  ...infer Tail extends [...(keyof S)[]],
]
  ? [GetTypeFromKey<S, Head>, ...GetTypesFromKeys<S, Tail>]
  : [];

type GetTypeFromKey<S extends ColumnsShape, T extends keyof S> = S[T]['output'];

export type GetTypesOrRaw<T extends [...unknown[]]> = T extends [
  infer Head,
  ...infer Tail,
]
  ? [GetTypeOrRaw<Head>, ...GetTypesOrRaw<Tail>]
  : [];

type GetTypeOrRaw<T> = T | RawExpression;

const schemaMethods = {
  getPrimaryKeys<T extends t.TakObject<ColumnsShape>>(
    this: T,
  ): GetPrimaryKeys<T['shape']> {
    return (
      Object.entries(this.shape)
        .filter(([, column]) => {
          return column.isPrimaryKey;
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map(([key]) => key) as any
    );
  },
};

export type TableSchema<Shape extends ColumnsShape> = t.TakObject<Shape> &
  SchemaMethods;

export const tableSchema = <Shape extends ColumnsShape>(
  shape: Shape,
): TableSchema<Shape> => {
  return Object.assign(t.object(shape), schemaMethods);
};
