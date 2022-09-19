import { ColumnInput, ColumnOutput, ColumnType } from './columnType';
import { Operators } from '../operators';
import { UnionToIntersection } from '../utils';

export type ColumnsShape = Record<string, ColumnType>;

export type ColumnShapeOutput<Shape extends ColumnsShape> = {
  [K in keyof Shape]: ColumnOutput<Shape[K]>;
};

export type ColumnShapeInput<Shape extends ColumnsShape> = {
  [K in keyof Shape]: ColumnInput<Shape[K]>;
};

export class ColumnsObject<Shape extends ColumnsShape> extends ColumnType<
  { [K in keyof Shape]: Shape[K]['type'] },
  typeof Operators.any
> {
  dataType = 'object';
  operators = Operators.any;

  constructor(public shape: Shape) {
    super();
  }
}

export class ArrayOfColumnsObjects<
  Shape extends ColumnsShape,
> extends ColumnType<
  { [K in keyof Shape]: Shape[K]['type'] }[],
  typeof Operators.any
> {
  dataType = 'array';
  operators = Operators.any;

  constructor(public shape: Shape) {
    super();
  }
}

type UnionKeyofToOvlds<S, U> = UnionToIntersection<
  U extends keyof S ? (f: U) => void : never
>;

type PopKeyofColumnShapeUnion<
  S extends ColumnsShape,
  U extends keyof S,
> = UnionKeyofToOvlds<S, U> extends (a: infer A extends keyof S) => void
  ? A
  : never;

type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

export type UnionToArray<
  S extends ColumnsShape,
  T extends keyof S,
  A extends [...(keyof S)[]] = [],
> = IsUnion<T> extends true
  ? UnionToArray<
      S,
      Exclude<T, PopKeyofColumnShapeUnion<S, T>>,
      [PopKeyofColumnShapeUnion<S, T>, ...A]
    >
  : [T, ...A];

type GetPrimaryKeys<S extends ColumnsShape> = UnionToArray<
  S,
  { [K in keyof S]: S[K] extends { isPrimaryKey: true } ? K : never }[keyof S]
>;

type GetPrimaryTypes<
  S extends ColumnsShape,
  Keys extends [...(keyof S | string)[]] = GetPrimaryKeys<S>,
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

type GetTypeFromKey<S extends ColumnsShape, T extends keyof S> = S[T]['type'];

export class TableSchema<Shape extends ColumnsShape> {
  primaryKeys: string extends keyof Shape ? string[] : GetPrimaryKeys<Shape>;
  primaryTypes!: GetPrimaryTypes<Shape>;

  constructor(public shape: Shape) {
    this.primaryKeys = Object.entries(this.shape)
      .filter(([, column]) => {
        return column.isPrimaryKey;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map(([key]) => key) as any;
  }
}
