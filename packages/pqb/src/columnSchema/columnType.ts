import { Operator, Operators } from '../columnsOperators';
import { JSONTypeAny } from './json';
import { ColumnsShape } from './columnsSchema';
import { RawExpression, StringKey } from '../common';
import { MaybeArray, singleQuote, toArray } from '../utils';
import { Query } from '../query';

export type ColumnOutput<T extends ColumnType> = T['type'];

export type ColumnInput<T extends ColumnType> = T['inputType'];

export type NullableColumn<T extends ColumnType> = Omit<
  T,
  'type' | 'inputType' | 'operators'
> & {
  type: T['type'] | null;
  inputType: T['inputType'] | null;
  isNullable: true;
  operators: Omit<T['operators'], 'equals' | 'not'> & {
    equals: Operator<T['type'] | null>;
    not: Operator<T['type'] | null>;
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
  default?: unknown;
  validationDefault?: unknown;
  index?: Omit<SingleColumnIndexOptions, 'column'>;
  comment?: string;
  collate?: string;
  compression?: string;
  foreignKey?: ForeignKey<string, string[]>;
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

export type IndexColumnOptions = {
  column: string;
  expression?: number | string;
  collate?: string;
  operator?: string;
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

export type Code = string | Code[];

export const columnChainToCode = (
  chain: ColumnChain,
  t: string,
  code: Code,
  append: Code,
): Code => {
  const result = toArray(code) as Code[];
  if (typeof append === 'string') {
    if (append) {
      if (result.length === 1 && typeof result[0] === 'string') {
        result[0] += append;
      } else {
        result.push(append);
      }
    }
  } else {
    if (append.length) result.push(...append);
  }

  for (const item of chain) {
    if (item[0] === 'transform') {
      result.push(`.transform(${item[1].toString()})`);
    } else if (item[0] === 'to') {
      const type = toArray(item[2].toCode(t));
      result.push(`.to(${item[1].toString()}, `, ...type, ')');
    } else if (item[0] === 'refine') {
      result.push(`.refine(${item[1].toString()})`);
    } else if (item[0] === 'superRefine') {
      result.push(`.superRefine(${item[1].toString()})`);
    }
  }

  return result.length === 1 && typeof result[0] === 'string'
    ? result[0]
    : result;
};

export const columnCode = (type: ColumnType, t: string, code: Code): Code => {
  const append: Code[] = [];

  const { foreignKey, index, validationDefault } = type.data;

  if (type.isPrimaryKey) append.push('.primaryKey()');

  if (foreignKey) {
    append.push(`.foreignKey(`);
    if ('fn' in foreignKey) {
      append.push(foreignKey.fn.toString());
    } else {
      append.push(singleQuote(foreignKey.table));
    }
    append.push(`, ${singleQuote(foreignKey.columns[0])}`);

    const hasOptions =
      foreignKey.name ||
      foreignKey.match ||
      foreignKey.onUpdate ||
      foreignKey.onDelete;

    if (hasOptions) {
      const arr: string[] = [];

      if (foreignKey.name) arr.push(`name: ${singleQuote(foreignKey.name)},`);
      if (foreignKey.match)
        arr.push(`match: ${singleQuote(foreignKey.match)},`);
      if (foreignKey.onUpdate)
        arr.push(`onUpdate: ${singleQuote(foreignKey.onUpdate)},`);
      if (foreignKey.onDelete)
        arr.push(`onDelete: ${singleQuote(foreignKey.onDelete)},`);

      append.push(', {', arr, '}');
    }

    append.push(')');
  }

  if (type.isHidden) append.push('.hidden()');

  if (type.isNullable) append.push('.nullable()');

  if ('isNonEmpty' in type.data) append.push('.nonEmpty()');

  if (type.encodeFn) append.push(`.encode(${type.encodeFn.toString()})`);

  if (type.parseFn && !('hideFromCode' in type.parseFn))
    append.push(`.parse(${type.parseFn.toString()})`);

  if (type.data.as) append.push(`.as(${type.data.as.toCode(t)})`);

  if (type.data.default)
    append.push(`.default(${JSON.stringify(type.data.default)})`);

  if (index) {
    append.push(`.${index.unique ? 'unique' : 'index'}(`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const key in index) {
      if (key === 'unique') continue;

      const arr: string[] = [];

      if (index.expression)
        arr.push(
          `expression: ${
            typeof index.expression === 'string'
              ? singleQuote(index.expression)
              : index.expression
          },`,
        );
      if (index.collate) arr.push(`collate: ${singleQuote(index.collate)},`);
      if (index.operator) arr.push(`operator: ${singleQuote(index.operator)},`);
      if (index.order) arr.push(`order: ${singleQuote(index.order)},`);
      if (index.name) arr.push(`name: ${singleQuote(index.name)},`);
      if (index.unique) arr.push(`unique: true,`);
      if (index.using) arr.push(`using: ${singleQuote(index.using)},`);
      if (index.include)
        arr.push(
          `include: ${
            typeof index.include === 'string'
              ? singleQuote(index.include)
              : `[${index.include.map(singleQuote).join(', ')}]`
          },`,
        );
      if (index.with) arr.push(`with: ${singleQuote(index.with)},`);
      if (index.tablespace)
        arr.push(`tablespace: ${singleQuote(index.tablespace)},`);
      if (index.where) arr.push(`where: ${singleQuote(index.where)},`);

      append.push('{', arr, '}');
      break;
    }

    append.push(')');
  }

  if (type.data.comment)
    append.push(`.comment(${singleQuote(type.data.comment)})`);

  if (validationDefault) {
    append.push(
      `.validationDefault(${
        typeof validationDefault === 'function'
          ? validationDefault.toString()
          : typeof validationDefault === 'string'
          ? singleQuote(validationDefault)
          : JSON.stringify(validationDefault)
      })`,
    );
  }

  if (type.data.compression)
    append.push(`.compression(${singleQuote(type.data.compression)})`);

  if (type.data.collate)
    append.push(`.collate(${singleQuote(type.data.collate)})`);

  if (type.data.modifyQuery)
    append.push(`.modifyQuery(${type.data.modifyQuery.toString()})`);

  return columnChainToCode(type.chain, t, code, append);
};

export type ColumnChain = (
  | ['transform', (input: unknown, ctx: ValidationContext) => unknown]
  | ['to', (input: unknown) => JSONTypeAny | undefined, JSONTypeAny]
  | ['refine', (input: unknown) => unknown]
  | ['superRefine', (input: unknown, ctx: ValidationContext) => unknown]
)[];

export abstract class ColumnType<
  Type = unknown,
  Ops extends Operators = Operators,
  InputType = Type,
> {
  abstract dataType: string;
  abstract operators: Ops;
  abstract toCode(t: string): Code;

  type!: Type;
  inputType!: InputType;
  data = {} as ColumnData;
  isPrimaryKey = false;
  isHidden = false;
  isNullable = false;
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
    const cloned = Object.create(this);
    if (typeof fnOrTable === 'string') {
      cloned.data = {
        ...this.data,
        foreignKey: { table: fnOrTable, columns: [column], ...options },
      };
    } else {
      cloned.data = {
        ...this.data,
        foreignKey: { fn: fnOrTable, columns: [column], ...options },
      };
    }
    return cloned;
  }

  hidden<T extends ColumnType>(this: T): T & { isHidden: true } {
    return Object.assign(Object.create(this), { isHidden: true as const });
  }

  nullable<T extends ColumnType>(this: T): NullableColumn<T> {
    return Object.assign(Object.create(this), {
      isNullable: true,
    }) as unknown as NullableColumn<T>;
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
    C extends ColumnType<T['type'], Operators, T['inputType']>,
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
    return addColumnData(this, 'index', options);
  }

  unique<T extends ColumnType>(
    this: T,
    options: Omit<SingleColumnIndexOptions, 'column' | 'unique'> = {},
  ): T {
    return addColumnData(this, 'index', { ...options, unique: true });
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
