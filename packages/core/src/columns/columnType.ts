import { BaseOperators, Operator } from './operators';
import { Code } from './code';
import { RawSQLBase } from '../raw';
import { SetOptional, SomeIsTrue, StringKey } from '../utils';
import { JSONTypeAny } from './json';
import { QueryCommon } from '../query';

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

// marks the column as a primary
export type PrimaryKeyColumn<T extends ColumnTypeBase> = Omit<T, 'data'> & {
  data: Omit<T['data'], 'isPrimaryKey' | 'default'> & {
    isPrimaryKey: true;
    default: RawSQLBase;
  };
};

// marks the column as a nullable, adds `null` type to `type` and `inputType`
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
    // allow `null` in .where({ column: { equals: null } }) and the same for `not`
    [K in keyof T['operators']]: K extends 'equals' | 'not'
      ? Operator<T['type'] | null>
      : T['operators'][K];
  };
};

// change the input type of the column
export type EncodeColumn<T extends ColumnTypeBase, Input> = {
  [K in keyof T]: K extends 'inputType' ? Input : T[K];
};

// change the output type of the column
export type ParseColumn<T extends ColumnTypeBase, Output> = {
  [K in keyof T]: K extends 'type' ? Output : T[K];
};

// adds default type to the column
export type ColumnWithDefault<T extends ColumnTypeBase, Value> = Omit<
  T,
  'data'
> & {
  data: Omit<T['data'], 'default'> & {
    default: Value;
  };
};

// marks the column as hidden
export type HiddenColumn<T extends ColumnTypeBase> = Omit<T, 'data'> & {
  data: Omit<T['data'], 'isHidden'> & {
    isHidden: true;
  };
};

// get union of column names (ex. 'col1' | 'col2' | 'col3') where column is nullable or has a default
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

// get columns object type where nullable columns or columns with a default are optional
export type ColumnShapeInput<Shape extends ColumnsShapeBase> = SetOptional<
  {
    [K in keyof Shape]: ColumnInput<Shape[K]>;
  },
  OptionalColumnsForInput<Shape>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyColumnType = ColumnTypeBase<any, Record<string, Operator<any>>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
export type AnyColumnTypeCreator = (...args: any) => AnyColumnType | {};

export type ColumnTypesBase = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  AnyColumnTypeCreator
> & {
  // snakeCaseKey may be present, but due to problems with TS it can't be listed here
  // [snakeCaseKey]?: boolean;
};

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

// type of columns selected by default, `hidden` columns are omitted
export type DefaultSelectColumns<S extends ColumnsShapeBase> = {
  [K in keyof S]: S[K]['data']['isHidden'] extends true ? never : K;
}[StringKey<keyof S>][];

// minimal table class type to use in the foreign key option
export type ForeignKeyTable = new () => {
  schema?: string;
  table: string;
  columns: { shape: ColumnsShapeBase };
};

// string union of available column names of the table
export type ColumnNameOfTable<Table extends ForeignKeyTable> = StringKey<
  keyof InstanceType<Table>['columns']['shape']
>;

// clone column type and set data to it
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

// clone column type and push data to array property of it
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
  // name of the column in the database, if different from the code
  name?: string;

  // is null value allowed
  isNullable?: boolean;

  // is column a primary key in a database
  isPrimaryKey?: boolean;

  // if column has a default value, then it can be omitted in `create` method
  default?: unknown;

  // is column removed from default table selection
  isHidden?: boolean;

  // parse and encode a column to use it `as` another column
  as?: ColumnTypeBase;

  // array of indexes info
  indexes?: { unique?: boolean }[];

  // hook for modifying base query object of the table
  // used for automatic updating of `updatedAt`
  modifyQuery?: (q: QueryCommon) => void;

  // raw database check expression
  check?: RawSQLBase;

  // if the column is of domain or other user-defined type
  isOfCustomType?: boolean;

  // error messages: key is camelCased version of Zod, like invalidType, and the value is the message
  errors?: Record<string, string>;
};

// chain of column refinements and transformations
export type ColumnChain = (
  | ['transform', (input: unknown, ctx: ValidationContext) => unknown]
  | ['to', (input: unknown) => JSONTypeAny | undefined, JSONTypeAny]
  | ['refine', (input: unknown) => unknown, ColumnTypeBase | JSONTypeAny]
  | ['superRefine', (input: unknown, ctx: ValidationContext) => unknown]
)[];

// current name of the column, set by `name` method
let currentName: string | undefined;

// set current name of the column
export function name<T extends ColumnTypesBase>(this: T, name: string): T {
  currentName = name;
  return this;
}

// consume column name: reset current name and return the value it contained
export const consumeColumnName = () => {
  const name = currentName;
  currentName = undefined;
  return name;
};

// by default, updatedAt and createdAt timestamps are defaulted to now()
const defaultNowFn = 'now()';

// stores SQL to use as default for updatedAt and createdAt
let currentNowFn = defaultNowFn;

// change default SQL for updatedAt and createdAt
export const setDefaultNowFn = (sql: string) => {
  currentNowFn = `(${sql})`; // sql should be wrapped into parenthesis to work properly in migrations
};

// get default SQL for updatedAt and createdAt
export const getDefaultNowFn = () => currentNowFn;

// reset default SQL for updatedAt and createdAt to now()
export const resetDefaultNowFn = () => {
  currentNowFn = defaultNowFn;
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
  abstract toCode(t: string, migration?: boolean): Code;

  // format the column into the database type
  abstract toSQL(): string;

  // output type
  type!: Type;

  // input type
  inputType!: InputType;

  // data of the column that specifies column characteristics and validations
  data: Data;

  // chain of transformations and validations of the column
  chain = [] as ColumnChain;

  constructor() {
    this.data = {} as Data;
    const name = consumeColumnName();
    if (name) {
      this.data.name = name;
    }
  }

  // encode value passed to `create` to an appropriate value for a database
  encodeFn?: (input: any) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

  // parse value from a database into what is preferred by the app
  parseFn?: (input: unknown) => unknown;

  // parse value from a database when it is an element of database array type
  parseItem?: (input: string) => unknown;

  /**
   * Set a default value to a column. Columns that have defaults become optional when creating a record.
   *
   * If you provide a value or a raw SQL, such default should be set on the column in migration to be applied on a database level.
   *
   * Or you can specify a callback that returns a value. This function will be called for each creating record. Such a default won't be applied to a database.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     // values as defaults:
   *     int: t.integer().default(123),
   *     text: t.text().default('text'),
   *
   *     // raw SQL default:
   *     timestamp: t.timestamp().default(t.sql`now()`),
   *
   *     // runtime default, each new records gets a new random value:
   *     random: t.numeric().default(() => Math.random()),
   *   }));
   * }
   * ```
   *
   * @param value - default value or a function returning a value
   */
  default<
    T extends ColumnTypeBase,
    Value extends T['type'] | null | RawSQLBase | (() => T['type']),
  >(this: T, value: Value): ColumnWithDefault<T, Value> {
    return setColumnData(
      this,
      'default',
      value as unknown,
    ) as ColumnWithDefault<T, Value>;
  }

  /**
   * Set a database-level validation check to a column. `check` accepts a raw SQL.
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('table', (t) => ({
   *     // validate rank to be from 1 to 10
   *     rank: t.integer().check(t.sql`1 >= "rank" AND "rank" <= 10`),
   *   }));
   * });
   * ```
   *
   * @param value - raw SQL expression
   */
  check<T extends ColumnTypeBase>(this: T, value: RawSQLBase): T {
    return setColumnData(this, 'check', value);
  }

  /**
   * `errors` allows to specify two following validation messages:
   *
   * ```ts
   * t.text().errors({
   *   required: 'This column is required',
   *   invalidType: 'This column must be an integer',
   * });
   * ```
   *
   * It will be converted into `Zod`'s messages:
   *
   * ```ts
   * z.string({
   *   required_error: 'This column is required',
   *   invalid_type_error: 'This column must be an integer',
   * });
   * ```
   *
   * Each validation method can accept an error message as a string:
   *
   * ```ts
   * t.text().min(5, 'Must be 5 or more characters long');
   * t.text().max(5, 'Must be 5 or fewer characters long');
   * t.text().length(5, 'Must be exactly 5 characters long');
   * t.text().email('Invalid email address');
   * t.text().url('Invalid url');
   * t.text().emoji('Contains non-emoji characters');
   * t.text().uuid('Invalid UUID');
   * t.text().includes('tuna', 'Must include tuna');
   * t.text().startsWith('https://', 'Must provide secure URL');
   * t.text().endsWith('.com', 'Only .com domains allowed');
   * ```
   *
   * Except for `text().datetime()` and `text().ip()`:
   *
   * these methods can have their own parameters, so the error message is passed in object.
   *
   * ```ts
   * t.text().datetime({ message: 'Invalid datetime string! Must be UTC.' });
   * t.text().ip({ message: 'Invalid IP address' });
   * ```
   *
   * Error messages are supported for a JSON schema as well:
   *
   * ```ts
   * t.json((j) =>
   *   j.object({
   *     one: j
   *       .string()
   *       .errors({ required: 'One is required' })
   *       .min(5, 'Must be 5 or more characters long'),
   *     two: j
   *       .string()
   *       .errors({ invalidType: 'Two should be a string' })
   *       .max(5, 'Must be 5 or fewer characters long'),
   *     three: j.string().length(5, 'Must be exactly 5 characters long'),
   *   }),
   * );
   * ```
   *
   * @param errorMessages - object, key is either 'required' or 'invalidType', value is an error message
   */
  errors<T extends ColumnTypeBase>(
    this: T,
    errorMessages: { [K in 'required' | 'invalidType']?: string },
  ): T {
    const { errors } = this.data;
    return setColumnData(
      this,
      'errors',
      errors ? { ...errors, ...errorMessages } : errorMessages,
    );
  }

  /**
   * Use `nullable` to mark the column as nullable. By default, all columns are required.
   *
   * Nullable columns are optional when creating records.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     name: t.integer().nullable(),
   *   }));
   * }
   * ```
   */
  nullable<T extends ColumnTypeBase>(this: T): NullableColumn<T> {
    return setColumnData(
      this,
      'isNullable',
      true,
    ) as unknown as NullableColumn<T>;
  }

  /**
   * This method changes a column type without modifying its behavior.
   * This is needed when converting columns to a validation schema, the converter will pick a different type specified by `.as`.
   *
   * Before calling `.as` need to use `.encode` with the input of the same type as the input of the target column,
   * and `.parse` which returns the correct type.
   *
   * ```ts
   * // column has the same type as t.integer()
   * const column = t
   *   .text(1, 100)
   *   .encode((input: number) => input)
   *   .parse((text) => parseInt(text))
   *   .as(t.integer());
   * ```
   *
   * @param column - other column type to inherit from
   */
  as<
    T extends ColumnTypeBase,
    C extends ColumnTypeBase<T['type'], BaseOperators, T['inputType']>,
  >(this: T, column: C): C {
    return setColumnData(this, 'as', column) as unknown as C;
  }

  /**
   * Set a custom function to process value for the column when creating or updating a record.
   *
   * The type of `input` argument will be used as the type of the column when creating and updating.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     // encode boolean, number, or string to text before saving
   *     column: t
   *       .text(3, 100)
   *       .encode((input: boolean | number | string) => String(input)),
   *   }));
   * }
   *
   * // numbers and booleans will be converted to a string:
   * await db.table.create({ column: 123 });
   * await db.table.create({ column: true });
   * await db.table.where({ column: 'true' }).update({ column: false });
   * ```
   *
   * @param fn - function to encode value for a database, argument type is specified by you, return type must be compatible with a database
   */
  encode<T extends ColumnTypeBase, Input>(
    this: T,
    fn: (input: Input) => unknown,
  ): EncodeColumn<T, Input> {
    return Object.assign(Object.create(this), {
      encodeFn: fn,
    }) as unknown as EncodeColumn<T, Input>;
  }

  /**
   * Set a custom function to process value after loading it from a database.
   *
   * The type of input is the type of column before `.parse`, the resulting type will replace the type of column.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     // parse text to integer
   *     column: t.text(3, 100).parse((input) => parseInt(input)),
   *   }));
   * }
   *
   * // column will be parsed to a number
   * const value: number = await db.table.get('column');
   * ```
   *
   * If the column is `nullable`, the `input` type will also have `null` and you should handle this case.
   * This allows using `parse` to set a default value after loading from the database.
   *
   * ```ts
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     // return a default image URL if it is null
   *     // this allows to change the defaultImageURL without modifying a database
   *     imageURL: t
   *       .text(5, 300)
   *       .nullable()
   *       .parse((url) => url ?? defaultImageURL),
   *   }));
   * }
   * ```
   *
   * @param fn - function to parse a value from the database, argument is the type of this column, return type is up to you
   */
  parse<T extends ColumnTypeBase, Output>(
    this: T,
    fn: (input: T['type']) => Output,
  ): ParseColumn<T, Output> {
    return Object.assign(Object.create(this), {
      parseFn: fn,
      parseItem: fn,
    }) as unknown as ParseColumn<T, Output>;
  }

  /**
   * @deprecated this feature is in a draft state
   *
   * Remove the column from the default selection. For example, the password of the user may be marked as hidden, and then this column won't load by default, only when specifically listed in `.select`.
   */
  hidden<T extends ColumnTypeBase>(this: T): HiddenColumn<T> {
    return setColumnData(this, 'isHidden', true) as HiddenColumn<T>;
  }
}
