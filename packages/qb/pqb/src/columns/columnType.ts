import { JSONTypeAny } from './json';
import { ColumnsShape } from './columnsSchema';
import { raw, RawExpression } from '../raw';
import { MaybeArray, StringKey } from '../utils';
import { Query } from '../query';
import { BaseOperators } from '../../../common/src/columns/operators';
import {
  ColumnDataBase,
  ColumnTypeBase,
  ColumnWithDefault,
  HiddenColumn,
  NullableColumn,
  ValidationContext,
} from '../../../common/src/columns/columnType';

export type ColumnData = ColumnDataBase & {
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

const setColumnData = <T extends ColumnType, K extends keyof ColumnData>(
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
  return setColumnData(
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

export type PrimaryKeyColumn<T extends ColumnTypeBase> = Omit<T, 'data'> & {
  data: Omit<T['data'], 'isPrimaryKey' | 'default'> & {
    isPrimaryKey: true;
    default: RawExpression;
  };
};

export abstract class ColumnType<
  Type = unknown,
  Ops extends BaseOperators = BaseOperators,
  InputType = Type,
> extends ColumnTypeBase<Type, Ops, InputType, ColumnData> {
  chain = [] as ColumnChain;

  primaryKey<T extends ColumnType>(this: T): PrimaryKeyColumn<T> {
    return setColumnData(
      this,
      'isPrimaryKey',
      true,
    ) as unknown as PrimaryKeyColumn<T>;
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

  hidden<T extends ColumnType>(this: T): HiddenColumn<T> {
    return setColumnData(this, 'isHidden', true) as HiddenColumn<T>;
  }

  nullable<T extends ColumnType>(this: T): NullableColumn<T> {
    return setColumnData(
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
    return setColumnData(this, 'as', column) as unknown as C;
  }

  toSQL() {
    return this.dataType;
  }

  default<T extends ColumnType, Value extends T['type'] | RawExpression>(
    this: T,
    value: Value,
  ): ColumnWithDefault<T, Value> {
    return setColumnData(
      this,
      'default',
      value as unknown,
    ) as ColumnWithDefault<T, Value>;
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
    return setColumnData(this, 'comment', comment);
  }

  validationDefault<T extends ColumnType>(this: T, value: T['type']): T {
    return setColumnData(this, 'validationDefault', value as unknown);
  }

  compression<T extends ColumnType>(this: T, compression: string): T {
    return setColumnData(this, 'compression', compression);
  }

  collate<T extends ColumnType>(this: T, collate: string): T {
    return setColumnData(this, 'collate', collate);
  }

  modifyQuery<T extends ColumnType>(this: T, cb: (q: Query) => void): T {
    return setColumnData(this, 'modifyQuery', cb);
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
