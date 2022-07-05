import {
  z,
  ZodTypeAny,
  ZodObject,
  ZodNullable,
  nullable,
  ZodNumber,
  ZodString,
  ZodBoolean,
  ZodArray,
} from 'zod';
import { Operators } from './operators';
import { UnionToIntersection } from './utils';

export type ColumnMethods<D extends string, Ops extends Operators> = {
  dataType: D;
  operators: Ops;
  isPrimaryKey: boolean;
  isHidden: boolean;
  primaryKey<T extends ZodTypeAny & ColumnMethods<any, any>>(
    this: T,
  ): T & { isPrimaryKey: true };
  hidden<T extends ZodTypeAny & ColumnMethods<any, any>>(
    this: T,
  ): T & { isHidden: true };
  nullable<T extends ZodTypeAny & ColumnMethods<any, any>>(
    this: T,
  ): ZodNullable<T> & ColumnMethods<T['dataType'], T['operators']>;
};

export type Column<
  T extends ZodTypeAny = ZodTypeAny,
  D extends string = string,
  Ops extends Operators = Operators,
> = Omit<T, 'nullable'> & ColumnMethods<D, Ops>;

export type ColumnsShape = Record<string, Column>;

export type ColumnsObject<Shape extends ColumnsShape> = Column<
  ZodObject<Shape>,
  'object'
>;

export type ColumnsArray<C extends Column> = Column<ZodArray<C>, 'array'>;

export type TableSchema<Shape extends ColumnsShape> = ZodObject<Shape> &
  SchemaMethods;

export type DataTypes = typeof dataTypes;

export type NumberColumn = Column<
  ZodNumber,
  'decimal',
  typeof Operators.number
>;

export type StringColumn = Column<ZodString, 'text', typeof Operators.text>;

export type BooleanColumn = Column<
  ZodBoolean,
  'bool',
  typeof Operators.boolean
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columnMethods: Omit<ColumnMethods<any, any>, 'dataType' | 'operators'> = {
  isPrimaryKey: false,
  isHidden: false,
  primaryKey<T extends ZodTypeAny>(this: T): T & { isPrimaryKey: true } {
    return Object.assign(this, { isPrimaryKey: true as const });
  },
  hidden<T extends ZodTypeAny>(this: T): T & { isHidden: true } {
    return Object.assign(this, { isHidden: true as const });
  },
  nullable<T extends ZodTypeAny & ColumnMethods<any, any>>(this: T) {
    return Object.assign(nullable(this), columnMethods, {
      dataType: this.dataType,
      operators: this.operators,
    });
  },
};

export type Output<S extends ColumnsShape> = {
  [K in keyof S]: z.infer<S[K]>;
};

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

type GetTypeFromKey<S extends ColumnsShape, T extends keyof S> = z.infer<S[T]>;

const column = <T extends ZodTypeAny, D extends string, Ops extends Operators>(
  type: T,
  dataType: D,
  operators: Ops,
): Column<T, D, Ops> => {
  return Object.assign(type, columnMethods, { dataType, operators });
};

export const dataTypes = {
  bigint: () => column(z.bigint(), 'bigint', Operators.number),
  bigserial: () => column(z.bigint(), 'bigserial', Operators.number),
  boolean: () => column(z.boolean(), 'boolean', Operators.boolean),
  date: () => column(z.date(), 'date', Operators.date),
  decimal: () => column(z.number(), 'decimal', Operators.number),
  float: () => column(z.number(), 'float', Operators.number),
  integer: () => column(z.number(), 'integer', Operators.number),
  text: () => column(z.string(), 'text', Operators.text),
  string: () => column(z.string(), 'text', Operators.text),
  smallint: () => column(z.number(), 'smallint', Operators.number),
  smallserial: () => column(z.number(), 'smallserial', Operators.number),
  time: () => column(z.number(), 'time', Operators.time),
  timestamp: () => column(z.date(), 'timestamp', Operators.date),
  timestamptz: () => column(z.date(), 'timestamptz', Operators.date),
  binary: () => column(z.string(), 'binary', Operators.any),
  serial: () => column(z.number(), 'serial', Operators.number),
};

const schemaMethods = {
  getPrimaryKeys<T extends ZodObject<ColumnsShape>>(
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

export const tableSchema = <Shape extends ColumnsShape>(
  shape: Shape,
): TableSchema<Shape> => {
  return Object.assign(z.object(shape), schemaMethods);
};
