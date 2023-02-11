import { BaseOperators, Operator } from './operators';
import { JSONTypeAny } from './json';
import { ColumnsShape } from './columnsSchema';
import { raw, RawExpression } from '../raw';
import { MaybeArray, StringKey } from '../utils';
import { Query } from '../query';
import { Code } from './code';

export type ColumnOutput<T extends ColumnType> = T['type'];

export type ColumnInput<T extends ColumnType> = T['inputType'];

export type NullableColumn<T extends ColumnType> = Omit<
  T,
  'type' | 'inputType' | 'operators'
> & {
  type: T['type'] | null;
  inputType: T['inputType'] | null;
  isNullable: true;
  operators: {
    [K in keyof T['operators']]: K extends 'equals' | 'not'
      ? Operator<T['type'] | null>
      : T['operators'][K];
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyColumnType = ColumnType<any, Record<string, Operator<any>>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
export type AnyColumnTypeCreator = (...args: any[]) => AnyColumnType | {};

export type ColumnTypesBase = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  AnyColumnTypeCreator
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidationContext = any;

export type ColumnData = {
  isNullable?: boolean;
  default?: unknown;
  maxChars?: number;
  numericPrecision?: number;
  numericScale?: number;
  dateTimePrecision?: number;
  validationDefault?: unknown;
  indexes?: Omit<SingleColumnIndexOptions, 'column'>[];
  comment?: string;
  collate?: string;
  compression?: string;
  foreignKeys?: ForeignKey<string, string[]>[];
  modifyQuery?: (q: Query) => void;
  as?: ColumnType;
};

type ForeignKeyMatch = 'FULL' | 'PARTIAL' | 'SIMPLE';

type ForeignKeyAction =
  | 'NO ACTION'
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT';

export type ForeignKey<Table extends string, Columns extends string[]> = (
  | {
      fn(): new () => { table: Table };
    }
  | {
      table: Table;
    }
) & {
  columns: Columns;
} & ForeignKeyOptions;

export type DropMode = 'CASCADE' | 'RESTRICT';

export type ForeignKeyOptions = {
  name?: string;
  match?: ForeignKeyMatch;
  onUpdate?: ForeignKeyAction;
  onDelete?: ForeignKeyAction;
  dropMode?: DropMode;
};

export type IndexColumnOptions = (
  | { column: string }
  | { expression: string }
) & {
  collate?: string;
  opclass?: string;
  order?: string;
};

export type IndexOptions = {
  name?: string;
  unique?: boolean;
  using?: string;
  include?: MaybeArray<string>;
  with?: string;
  tablespace?: string;
  where?: string;
  dropMode?: 'CASCADE' | 'RESTRICT';
};

export type SingleColumnIndexOptions = IndexColumnOptions & IndexOptions;

export type ForeignKeyTable = new () => {
  schema?: string;
  table: string;
};

export type ForeignKeyTableWithColumns = new () => {
  table: string;
  columns: { shape: ColumnsShape };
};

export type ColumnNameOfTable<Table extends ForeignKeyTableWithColumns> =
  StringKey<keyof InstanceType<Table>['columns']['shape']>;

const addColumnData = <T extends ColumnType, K extends keyof ColumnData>(
  q: T,
  key: K,
  value: T['data'][K],
): T => {
  const cloned = Object.create(q);
  cloned.data = { ...q.data, [key]: value };
  return cloned;
};

const pushColumnData = <T extends ColumnType, K extends keyof ColumnData>(
  q: T,
  key: K,
  value: unknown,
) => {
  const arr = q.data[key] as unknown[];
  return addColumnData(
    q,
    key,
    (arr ? [...arr, value] : [value]) as unknown as undefined,
  );
};

export type ColumnChain = (
  | ['transform', (input: unknown, ctx: ValidationContext) => unknown]
  | ['to', (input: unknown) => JSONTypeAny | undefined, JSONTypeAny]
  | ['refine', (input: unknown) => unknown]
  | ['superRefine', (input: unknown, ctx: ValidationContext) => unknown]
)[];

export type ColumnFromDbParams = {
  isNullable?: boolean;
  default?: string;
  maxChars?: number;
  numericPrecision?: number;
  numericScale?: number;
  dateTimePrecision?: number;
};

export const instantiateColumn = (
  klass: new (...args: never[]) => ColumnType,
  params: ColumnFromDbParams,
): ColumnType => {
  const column = new (klass as unknown as new () => ColumnType)();

  let data;
  if (params.default !== null && params.default !== undefined) {
    data = { ...params, default: raw(params.default) };
  } else {
    data = params;
  }

  Object.assign(column.data, data);
  return column as unknown as ColumnType;
};

export abstract class ColumnType<
  Type = unknown,
  Ops extends BaseOperators = BaseOperators,
  InputType = Type,
> {
  abstract dataType: string;
  abstract operators: Ops;
  abstract toCode(t: string): Code;

  type!: Type;
  inputType!: InputType;
  isNullable!: boolean;
  data = {} as ColumnData;
  isPrimaryKey = false;
  isHidden = false;
  hasDefault = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encodeFn?: (input: any) => unknown;
  parseFn?: (input: unknown) => unknown;
  // parse item in array:
  parseItem?: (input: string) => unknown;

  chain = [] as ColumnChain;

  primaryKey<T extends ColumnType>(this: T): T & { isPrimaryKey: true } {
    const cloned = Object.create(this);
    return Object.assign(cloned, { isPrimaryKey: true as const });
  }

  foreignKey<
    T extends ColumnType,
    Table extends ForeignKeyTableWithColumns,
    Column extends ColumnNameOfTable<Table>,
  >(
    this: T,
    fn: () => Table,
    column: Column,
    options?: ForeignKeyOptions,
  ): Omit<T, 'foreignKeyData'> & {
    foreignKeyData: ForeignKey<InstanceType<Table>['table'], [Column]>;
  };
  foreignKey<T extends ColumnType, Table extends string, Column extends string>(
    this: T,
    table: Table,
    column: Column,
    options?: ForeignKeyOptions,
  ): Omit<T, 'foreignKeyData'> & {
    foreignKeyData: ForeignKey<Table, [Column]>;
  };
  foreignKey(
    fnOrTable: (() => ForeignKeyTable) | string,
    column: string,
    options: ForeignKeyOptions = {},
  ) {
    const item =
      typeof fnOrTable === 'string'
        ? { table: fnOrTable, columns: [column], ...options }
        : { fn: fnOrTable, columns: [column], ...options };
    return pushColumnData(this, 'foreignKeys', item);
  }

  hidden<T extends ColumnType>(this: T): T & { isHidden: true } {
    return Object.assign(Object.create(this), { isHidden: true as const });
  }

  nullable<T extends ColumnType>(this: T): NullableColumn<T> {
    return addColumnData(
      this,
      'isNullable',
      true,
    ) as unknown as NullableColumn<T>;
  }

  encode<T extends ColumnType, Input>(
    this: T,
    fn: (input: Input) => unknown,
  ): Omit<T, 'inputType'> & { inputType: Input } {
    return Object.assign(Object.create(this), {
      encodeFn: fn,
    }) as unknown as Omit<T, 'inputType'> & { inputType: Input };
  }

  parse<T extends ColumnType, Output>(
    this: T,
    fn: (input: T['type']) => Output,
  ): Omit<T, 'type'> & { type: Output } {
    return Object.assign(Object.create(this), {
      parseFn: fn,
      parseItem: fn,
    }) as unknown as Omit<T, 'type'> & { type: Output };
  }

  as<
    T extends ColumnType,
    C extends ColumnType<T['type'], BaseOperators, T['inputType']>,
  >(this: T, column: C): C {
    return addColumnData(this, 'as', column) as unknown as C;
  }

  toSQL() {
    return this.dataType;
  }

  default<T extends ColumnType>(
    this: T,
    value: T['type'] | RawExpression,
  ): T & { hasDefault: true } {
    return addColumnData(this, 'default', value as unknown) as T & {
      hasDefault: true;
    };
  }

  index<T extends ColumnType>(
    this: T,
    options: Omit<SingleColumnIndexOptions, 'column'> = {},
  ): T {
    return pushColumnData(this, 'indexes', options);
  }

  unique<T extends ColumnType>(
    this: T,
    options: Omit<SingleColumnIndexOptions, 'column' | 'unique'> = {},
  ): T {
    return pushColumnData(this, 'indexes', { ...options, unique: true });
  }

  comment<T extends ColumnType>(this: T, comment: string): T {
    return addColumnData(this, 'comment', comment);
  }

  validationDefault<T extends ColumnType>(this: T, value: T['type']): T {
    return addColumnData(this, 'validationDefault', value as unknown);
  }

  compression<T extends ColumnType>(this: T, compression: string): T {
    return addColumnData(this, 'compression', compression);
  }

  collate<T extends ColumnType>(this: T, collate: string): T {
    return addColumnData(this, 'collate', collate);
  }

  modifyQuery<T extends ColumnType>(this: T, cb: (q: Query) => void): T {
    return addColumnData(this, 'modifyQuery', cb);
  }

  transform<T extends ColumnType, Transformed>(
    this: T,
    fn: (input: T['type'], ctx: ValidationContext) => Transformed,
  ): Omit<T, 'type'> & { type: Transformed } {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['transform', fn]];
    return cloned as Omit<T, 'type'> & { type: Transformed };
  }

  to<T extends ColumnType, ToType extends ColumnType>(
    this: T,
    fn: (input: T['type']) => ToType['type'] | undefined,
    type: ToType,
  ): ToType {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['to', fn, type], ...cloned.chain];
    return cloned as ToType;
  }

  refine<T extends ColumnType, RefinedOutput extends T['type']>(
    this: T,
    check: (arg: T['type']) => unknown,
  ): T & { type: RefinedOutput } {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['refine', check]];
    return cloned as T & { type: RefinedOutput };
  }

  superRefine<T extends ColumnType, RefinedOutput extends T['type']>(
    this: T,
    check: (arg: T['type'], ctx: ValidationContext) => unknown,
  ): T & { type: RefinedOutput } {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['superRefine', check]];
    return cloned as T & { type: RefinedOutput };
  }
}
