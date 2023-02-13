import { BaseOperators, Operator } from './operators';
import { Code } from './code';
import { RawExpression } from '../raw';
import { SetOptional, SomeIsTrue, StringKey } from '../utils';

// output type of the column
export type ColumnOutput<T extends ColumnTypeBase> = T['type'];

// input type of the column
export type ColumnInput<T extends ColumnTypeBase> = T['inputType'];

// base type of object with columns
export type ColumnsShapeBase = Record<string, ColumnTypeBase>;

// output of base shape of columns
export type ColumnShapeOutput<Shape extends ColumnsShapeBase> = {
  [K in keyof Shape]: ColumnOutput<Shape[K]>;
};

export type PrimaryKeyColumn<T extends ColumnTypeBase> = Omit<T, 'data'> & {
  data: Omit<T['data'], 'isPrimaryKey' | 'default'> & {
    isPrimaryKey: true;
    default: RawExpression;
  };
};

export type NullableColumn<T extends ColumnTypeBase> = Omit<
  T,
  'type' | 'inputType' | 'data' | 'operators'
> & {
  type: T['type'] | null;
  inputType: T['inputType'] | null;
  data: Omit<T['data'], 'isNullable'> & {
    isNullable: true;
  };
  operators: {
    [K in keyof T['operators']]: K extends 'equals' | 'not'
      ? Operator<T['type'] | null>
      : T['operators'][K];
  };
};

export type ColumnWithDefault<T extends ColumnTypeBase, Value> = Omit<
  T,
  'data'
> & {
  data: Omit<T['data'], 'default'> & {
    default: Value;
  };
};
export type HiddenColumn<T extends ColumnTypeBase> = Omit<T, 'data'> & {
  data: Omit<T['data'], 'isHidden'> & {
    isHidden: true;
  };
};

type OptionalColumnsForInput<Shape extends ColumnsShapeBase> = {
  [K in keyof Shape]: SomeIsTrue<
    [
      Shape[K]['data']['isNullable'],
      undefined extends Shape[K]['data']['default'] ? false : true,
    ]
  > extends true
    ? K
    : never;
}[keyof Shape];

export type ColumnShapeInput<Shape extends ColumnsShapeBase> = SetOptional<
  {
    [K in keyof Shape]: ColumnInput<Shape[K]>;
  },
  OptionalColumnsForInput<Shape>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyColumnType = ColumnTypeBase<any, Record<string, Operator<any>>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
export type AnyColumnTypeCreator = (...args: any[]) => AnyColumnType | {};

export type ColumnTypesBase = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  AnyColumnTypeCreator
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidationContext = any;

// resolves in string literal of single primary key
// if table has two or more primary keys it will resolve in never
export type SinglePrimaryKey<Shape extends ColumnsShapeBase> = StringKey<
  {
    [K in keyof Shape]: Shape[K]['data']['isPrimaryKey'] extends true
      ? [
          {
            [S in keyof Shape]: Shape[S]['data']['isPrimaryKey'] extends true
              ? S extends K
                ? never
                : S
              : never;
          }[keyof Shape],
        ] extends [never]
        ? K
        : never
      : never;
  }[keyof Shape]
>;

export type DefaultSelectColumns<S extends ColumnsShapeBase> = {
  [K in keyof S]: S[K]['data']['isHidden'] extends true ? never : K;
}[StringKey<keyof S>][];

export const setColumnData = <
  T extends ColumnTypeBase,
  K extends keyof T['data'],
>(
  q: T,
  key: K,
  value: T['data'][K],
): T => {
  const cloned = Object.create(q);
  cloned.data = { ...q.data, [key]: value };
  return cloned;
};

export const pushColumnData = <
  T extends ColumnTypeBase,
  K extends keyof T['data'],
>(
  q: T,
  key: K,
  value: unknown,
) => {
  const arr = q.data[key as keyof typeof q.data] as unknown[];
  return setColumnData(
    q,
    key,
    (arr ? [...arr, value] : [value]) as unknown as T['data'][K],
  );
};

// base data of column
export type ColumnDataBase = {
  // is null value allowed
  isNullable?: boolean;

  // is column a primary key in a database
  isPrimaryKey?: boolean;

  // if column has a default value, then it can be omitted in `create` method
  default?: unknown;

  // is column removed from default table selection
  isHidden?: boolean;
};

// base column type
export abstract class ColumnTypeBase<
  Type = unknown,
  Ops extends BaseOperators = BaseOperators,
  InputType = Type,
  Data extends ColumnDataBase = ColumnDataBase,
> {
  // name of the type in a database
  abstract dataType: string;

  // operators supported by the type, that are available in `where` method
  abstract operators: Ops;

  // turn the column into TS code, used for code generation
  abstract toCode(t: string): Code;

  // output type
  type!: Type;

  // input type
  inputType!: InputType;

  // data of the column that specifies column characteristics and validations
  data = {} as Data;

  // encode value passed to `create` to an appropriate value for a database
  encodeFn?: (input: any) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

  // parse value from a database into what is preferred by the app
  parseFn?: (input: unknown) => unknown;

  // parse value from a database when it is an element of database array type
  parseItem?: (input: string) => unknown;
}
