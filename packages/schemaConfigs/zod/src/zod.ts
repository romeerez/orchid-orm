import {
  AsTypeArg,
  Code,
  ColumnSchemaGetterColumns,
  ColumnSchemaGetterTableClass,
  ColumnTypeBase,
  EncodeColumn,
  NullableColumn,
  ParseColumn,
  makeColumnNullable,
  ErrorMessage,
  setDataValue,
  StringTypeData,
  ErrorMessages,
  setColumnData,
  ColumnDataBase,
} from 'orchid-core';
import {
  ArrayColumn,
  ArrayColumnValue,
  BigIntColumn,
  BigSerialColumn,
  CharColumn,
  CitextColumn,
  columnCode,
  ColumnData,
  ColumnType,
  DateColumn,
  DecimalColumn,
  DoublePrecisionColumn,
  EnumColumn,
  IntegerColumn,
  MoneyColumn,
  Operators,
  OperatorsJson,
  RealColumn,
  SerialColumn,
  SmallIntColumn,
  SmallSerialColumn,
  StringColumn,
  TextColumn,
  TimestampColumn,
  TimestampTZColumn,
  VarCharColumn,
} from 'pqb';
import {
  z,
  ZodArray,
  ZodBoolean,
  ZodDate,
  ZodEnum,
  ZodNever,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodRawShape,
  ZodString,
  ZodType,
  ZodTypeAny,
  ZodUnknown,
} from 'zod';
import { ZodErrorMap } from 'zod/lib/ZodError';

// skip adding the default `encode` function to code
const toCodeSkip = { encodeFn: JSON.stringify };

class ZodJSONColumn<ZodSchema extends ZodTypeAny> extends ColumnType<
  ZodSchemaConfig,
  ZodSchema['_output'],
  ZodSchema,
  OperatorsJson
> {
  dataType = 'jsonb' as const;
  operators = Operators.json;
  declare data: ColumnData;

  constructor(schema: ZodSchema) {
    super(zodSchemaConfig, schema);
  }

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, [`json()`], m, this.data, toCodeSkip);
  }
}

// Encode data of both types with JSON.stringify
ZodJSONColumn.prototype.encodeFn = JSON.stringify;

type NumberMethodSchema<Key extends string> = {
  [K in Key]: (
    value: unknown,
    params?: ErrorMessage,
  ) => NumberMethodSchema<Key>;
};

function applyMethod<
  Key extends string,
  T extends {
    data: ColumnDataBase;
    inputSchema: NumberMethodSchema<Key>;
    outputSchema: NumberMethodSchema<Key>;
    querySchema: NumberMethodSchema<Key>;
  },
>(column: T, key: Key, value: unknown, params?: ErrorMessage) {
  const cloned = setDataValue(column, key, value, params);
  cloned.inputSchema = column.inputSchema[key](value, params);
  cloned.outputSchema = column.outputSchema[key](value, params);
  cloned.querySchema = column.querySchema[key](value, params);
  return cloned;
}

type NumberMethodSimpleSchema<Key extends string> = {
  [K in Key]: (params?: ErrorMessage) => NumberMethodSimpleSchema<Key>;
};

function applySimpleMethod<
  Key extends string,
  T extends {
    data: ColumnDataBase;
    inputSchema: NumberMethodSimpleSchema<Key>;
    outputSchema: NumberMethodSimpleSchema<Key>;
    querySchema: NumberMethodSimpleSchema<Key>;
  },
>(column: T, key: Key, params?: ErrorMessage) {
  const cloned = setDataValue(column, key, true, params);
  column.inputSchema = column.inputSchema[key](params);
  column.outputSchema = column.outputSchema[key](params);
  column.querySchema = column.querySchema[key](params);
  return cloned;
}

interface ArrayMethods<Value> {
  // Require a minimum length (inclusive)
  min<T extends ColumnTypeBase>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ): T;

  // Require a maximum length (inclusive)
  max<T extends ColumnTypeBase>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ): T;

  // Require a specific length
  length<T extends ColumnTypeBase>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ): T;

  // Require a value to be non-empty
  nonEmpty<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;
}

const arrayMethods: ArrayMethods<Date> = {
  min(value, params) {
    return applyMethod(this, 'min', value, params);
  },
  max(value, params) {
    return applyMethod(this, 'max', value, params);
  },
  length(value, params) {
    return applyMethod(this, 'length', value, params);
  },
  nonEmpty(params) {
    const cloned = setDataValue(this, 'nonEmpty', true, params);
    this.inputSchema = this.inputSchema.nonempty(params);
    this.outputSchema = this.outputSchema.nonempty(params);
    this.querySchema = this.querySchema.nonempty(params);
    return cloned;
  },
};

interface ZodArrayColumn<Item extends ArrayColumnValue>
  extends ArrayColumn<
      ZodSchemaConfig,
      Item,
      ZodArray<Item['inputSchema']>,
      ZodArray<Item['outputSchema']>,
      ZodArray<Item['querySchema']>
    >,
    ArrayMethods<number> {}

class ZodArrayColumn<Item extends ArrayColumnValue> extends ArrayColumn<
  ZodSchemaConfig,
  Item,
  ZodArray<Item['inputSchema']>,
  ZodArray<Item['outputSchema']>,
  ZodArray<Item['querySchema']>
> {
  constructor(item: Item) {
    super(zodSchemaConfig, item, z.array(item.inputSchema));
  }
}

Object.assign(ZodArrayColumn.prototype, arrayMethods);

interface NumberMethods {
  lt<T extends ColumnTypeBase>(
    this: T,
    value: number,
    params?: ErrorMessage,
  ): T;
  lte<T extends ColumnTypeBase>(
    this: T,
    value: number,
    params?: ErrorMessage,
  ): T;
  max<T extends ColumnTypeBase>(
    this: T,
    value: number,
    params?: ErrorMessage,
  ): T;
  gt<T extends ColumnTypeBase>(
    this: T,
    value: number,
    params?: ErrorMessage,
  ): T;
  gte<T extends ColumnTypeBase>(
    this: T,
    value: number,
    params?: ErrorMessage,
  ): T;
  min<T extends ColumnTypeBase>(
    this: T,
    value: number,
    params?: ErrorMessage,
  ): T;
  positive<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;
  nonNegative<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;
  negative<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;
  nonPositive<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;
  step<T extends ColumnTypeBase>(
    this: T,
    value: number,
    params?: ErrorMessage,
  ): T;
  int<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;
  finite<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;
  safe<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;
}

const numberMethods: NumberMethods = {
  // Require a value to be lower than a given number
  lt(value, params) {
    return applyMethod(this, 'lt', value, params);
  },

  // Require a value to be lower than or equal to a given number (the same as `max`)
  lte(value, params) {
    return applyMethod(this, 'lte', value, params);
  },

  // Require a value to be lower than or equal to a given number
  max(value, params) {
    return applyMethod(this, 'lte', value, params);
  },

  // Require a value to be greater than a given number
  gt(value, params) {
    return applyMethod(this, 'gt', value, params);
  },

  // Require a value to be greater than or equal to a given number (the same as `min`)
  gte(value, params) {
    return applyMethod(this, 'gte', value, params);
  },

  // Require a value to be greater than or equal to a given number
  min(value, params) {
    return applyMethod(this, 'gte', value, params);
  },

  // Require a value to be greater than 0
  positive(params) {
    return applyMethod(this, 'gt', 0, params);
  },

  // Require a value to be greater than or equal to 0
  nonNegative(params) {
    return applyMethod(this, 'gte', 0, params);
  },

  // Require a value to be lower than 0
  negative(params) {
    return applyMethod(this, 'lt', 0, params);
  },

  // Require a value to be lower than or equal to 0
  nonPositive(params) {
    return applyMethod(this, 'lte', 0, params);
  },

  // Require a value to be a multiple of a given number
  step(value, params) {
    return applyMethod(this, 'step', value, params);
  },

  // Require a value to be an integer
  int(params) {
    return applySimpleMethod(this, 'int', params);
  },

  // Exclude `Infinity` from being a valid value
  finite(params) {
    return applySimpleMethod(this, 'finite', params);
  },

  // Require the value to be less than or equal to Number.MAX_SAFE_INTEGER
  safe(params) {
    return applySimpleMethod(this, 'safe', params);
  },
};

interface SmallIntColumnZod
  extends SmallIntColumn<ZodSchemaConfig>,
    NumberMethods {}

class SmallIntColumnZod extends SmallIntColumn<ZodSchemaConfig> {}
Object.assign(SmallIntColumnZod.prototype, numberMethods);

interface IntegerColumnZod
  extends IntegerColumn<ZodSchemaConfig>,
    NumberMethods {}

class IntegerColumnZod extends IntegerColumn<ZodSchemaConfig> {}
Object.assign(IntegerColumnZod.prototype, numberMethods);

interface RealColumnZod extends RealColumn<ZodSchemaConfig>, NumberMethods {}

class RealColumnZod extends RealColumn<ZodSchemaConfig> {}
Object.assign(RealColumnZod.prototype, numberMethods);

interface SmallSerialColumnZod
  extends SmallSerialColumn<ZodSchemaConfig>,
    NumberMethods {}

class SmallSerialColumnZod extends SmallSerialColumn<ZodSchemaConfig> {}
Object.assign(SmallSerialColumnZod.prototype, numberMethods);

interface SerialColumnZod
  extends SerialColumn<ZodSchemaConfig>,
    NumberMethods {}

class SerialColumnZod extends SerialColumn<ZodSchemaConfig> {}
Object.assign(SerialColumnZod.prototype, numberMethods);

interface StringMethods extends ArrayMethods<number> {
  // Check a value to be a valid email
  email<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;

  // Check a value to be a valid url
  url<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;

  // Check a value to be an emoji
  emoji<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;

  // Check a value to be a valid uuid
  uuid<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;

  // Check a value to be a valid cuid
  cuid<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;

  // Check a value to be a valid cuid2
  cuid2<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;

  // Check a value to be a valid ulid
  ulid<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;

  // Validate the value over the given regular expression
  regex<T extends ColumnTypeBase>(
    this: T,
    value: RegExp,
    params?: ErrorMessage,
  ): T;

  // Check a value to include a given string
  includes<T extends ColumnTypeBase, Value extends string>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ): T;

  // Check a value to start with a given string
  startsWith<T extends ColumnTypeBase, Value extends string>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ): T;

  // Check a value to end with a given string
  endsWith<T extends ColumnTypeBase, Value extends string>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ): T;

  // Check a value have a valid datetime string
  datetime<T extends ColumnTypeBase>(
    this: T,
    params?: StringTypeData['datetime'] & Exclude<ErrorMessage, string>,
  ): T;

  // Check a value to be a valid ip address
  ip<T extends ColumnTypeBase>(
    this: T,
    params?: StringTypeData['ip'] & Exclude<ErrorMessage, string>,
  ): T;

  // Trim the value during a validation
  trim<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;

  // Transform value to a lower case during a validation
  toLowerCase<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;

  // Transform value to an upper case during a validation
  toUpperCase<T extends ColumnTypeBase>(this: T, params?: ErrorMessage): T;
}

const stringMethods: StringMethods = {
  ...(arrayMethods as unknown as ArrayMethods<number>),

  email(params) {
    return applySimpleMethod(this, 'email', params);
  },

  url(params) {
    return applySimpleMethod(this, 'url', params);
  },

  emoji(params) {
    return applySimpleMethod(this, 'emoji', params);
  },

  uuid(params) {
    return applySimpleMethod(this, 'uuid', params);
  },

  cuid(params) {
    return applySimpleMethod(this, 'cuid', params);
  },

  cuid2(params) {
    return applySimpleMethod(this, 'cuid2', params);
  },

  ulid(params) {
    return applySimpleMethod(this, 'ulid', params);
  },

  regex(value, params) {
    return applyMethod(this, 'regex', value, params);
  },

  includes(value, params) {
    return applyMethod(this, 'includes', value, params);
  },

  startsWith(value, params) {
    return applyMethod(this, 'startsWith', value, params);
  },

  endsWith(value, params) {
    return applyMethod(this, 'endsWith', value, params);
  },

  datetime(params = {}) {
    return applyMethod(this, 'datetime', params, params);
  },

  ip(params = {}) {
    return applyMethod(this, 'ip', params, params);
  },

  trim(params) {
    return applySimpleMethod(this, 'trim', params);
  },

  toLowerCase(params) {
    return applySimpleMethod(this, 'toLowerCase', params);
  },

  toUpperCase(params) {
    return applySimpleMethod(this, 'toUpperCase', params);
  },
};

interface BigIntColumnZod
  extends BigIntColumn<ZodSchemaConfig>,
    StringMethods {}

class BigIntColumnZod extends BigIntColumn<ZodSchemaConfig> {}
Object.assign(BigIntColumnZod.prototype, stringMethods);

interface DecimalColumnZod
  extends DecimalColumn<ZodSchemaConfig>,
    StringMethods {}

class DecimalColumnZod extends DecimalColumn<ZodSchemaConfig> {}
Object.assign(DecimalColumnZod.prototype, stringMethods);

interface DoublePrecisionColumnZod
  extends DoublePrecisionColumn<ZodSchemaConfig>,
    StringMethods {}

class DoublePrecisionColumnZod extends DoublePrecisionColumn<ZodSchemaConfig> {}
Object.assign(DoublePrecisionColumnZod.prototype, stringMethods);

interface BigSerialColumnZod
  extends BigSerialColumn<ZodSchemaConfig>,
    StringMethods {}

class BigSerialColumnZod extends BigSerialColumn<ZodSchemaConfig> {}
Object.assign(BigSerialColumnZod.prototype, stringMethods);

interface MoneyColumnZod extends MoneyColumn<ZodSchemaConfig>, StringMethods {}

class MoneyColumnZod extends MoneyColumn<ZodSchemaConfig> {}
Object.assign(MoneyColumnZod.prototype, stringMethods);

interface VarCharColumnZod
  extends VarCharColumn<ZodSchemaConfig>,
    StringMethods {}

class VarCharColumnZod extends VarCharColumn<ZodSchemaConfig> {}
Object.assign(VarCharColumnZod.prototype, stringMethods);

interface CharColumnZod extends CharColumn<ZodSchemaConfig>, StringMethods {}

class CharColumnZod extends CharColumn<ZodSchemaConfig> {}
Object.assign(CharColumnZod.prototype, stringMethods);

interface TextColumnZod extends TextColumn<ZodSchemaConfig>, StringMethods {}

class TextColumnZod extends TextColumn<ZodSchemaConfig> {}
Object.assign(TextColumnZod.prototype, stringMethods);

interface StringColumnZod
  extends StringColumn<ZodSchemaConfig>,
    StringMethods {}

class StringColumnZod extends StringColumn<ZodSchemaConfig> {}
Object.assign(StringColumnZod.prototype, stringMethods);

interface CitextColumnZod
  extends CitextColumn<ZodSchemaConfig>,
    StringMethods {}

class CitextColumnZod extends CitextColumn<ZodSchemaConfig> {}
Object.assign(CitextColumnZod.prototype, stringMethods);

interface DateMethods {
  // Require a value to be greater than or equal to a given Date object
  min<T extends ColumnTypeBase>(this: T, value: Date, params?: ErrorMessage): T;

  // Require a value to be lower than or equal to a given Date object
  max<T extends ColumnTypeBase>(this: T, value: Date, params?: ErrorMessage): T;
}

const dateMethods: DateMethods = {
  min(value, params) {
    return applyMethod(this, 'min', value, params);
  },
  max(value, params) {
    return applyMethod(this, 'max', value, params);
  },
};

interface DateColumnZod extends DateColumn<ZodSchemaConfig>, DateMethods {}

class DateColumnZod extends DateColumn<ZodSchemaConfig> {}
Object.assign(DateColumnZod.prototype, dateMethods);

interface TimestampNoTzColumnZod
  extends TimestampColumn<ZodSchemaConfig>,
    DateMethods {}

class TimestampNoTzColumnZod extends TimestampColumn<ZodSchemaConfig> {}
Object.assign(TimestampNoTzColumnZod.prototype, dateMethods);

interface TimestampColumnZod
  extends TimestampTZColumn<ZodSchemaConfig>,
    DateMethods {}

class TimestampColumnZod extends TimestampTZColumn<ZodSchemaConfig> {}
Object.assign(TimestampColumnZod.prototype, dateMethods);

export interface ZodSchemaConfig {
  type: ZodTypeAny;

  parse<
    T extends { type: unknown },
    OutputSchema extends ZodTypeAny,
    Output = OutputSchema['_output'],
  >(
    this: T,
    _schema: OutputSchema,
    fn: (input: T['type']) => Output,
  ): ParseColumn<T, OutputSchema, Output>;

  encode<
    T extends { type: unknown },
    InputSchema extends ZodTypeAny,
    Input = InputSchema['_output'],
  >(
    this: T,
    _schema: InputSchema,
    fn: (input: Input) => unknown,
  ): EncodeColumn<T, InputSchema, Input>;

  asType<
    T,
    Types extends AsTypeArg<ZodTypeAny>,
    TypeSchema extends ZodTypeAny = Types extends { type: ZodTypeAny }
      ? Types['type']
      : never,
    Type = TypeSchema['_output'],
  >(
    this: T,
    types: Types,
  ): {
    [K in keyof T]: K extends 'type'
      ? Type
      : K extends 'inputType'
      ? Types['input'] extends ZodTypeAny
        ? Types['input']['_output']
        : Type
      : K extends 'inputSchema'
      ? Types['input'] extends ZodTypeAny
        ? Types['input']
        : TypeSchema
      : K extends 'outputType'
      ? Types['output'] extends ZodTypeAny
        ? Types['output']['_output']
        : Type
      : K extends 'outputSchema'
      ? Types['output'] extends ZodTypeAny
        ? Types['output']
        : TypeSchema
      : K extends 'queryType'
      ? Types['query'] extends ZodTypeAny
        ? Types['query']['_output']
        : Type
      : K extends 'querySchema'
      ? Types['query'] extends ZodTypeAny
        ? Types['query']
        : TypeSchema
      : T[K];
  };

  dateAsNumber<T extends ColumnType<ZodSchemaConfig>>(
    this: T,
  ): ParseColumn<T, ZodNumber, number>;

  dateAsDate<T extends ColumnType<ZodSchemaConfig>>(
    this: T,
  ): ParseColumn<T, ZodDate, Date>;

  enum<U extends string, T extends readonly [U, ...U[]]>(
    dataType: string,
    type: T,
  ): EnumColumn<
    ZodSchemaConfig,
    // remove readonly flag for Zod
    ZodEnum<{
      -readonly [P in keyof T]: T[P];
    }>,
    U,
    T
  >;

  array<Item extends ArrayColumnValue>(item: Item): ZodArrayColumn<Item>;

  nullable<T extends ColumnTypeBase>(
    this: T,
  ): NullableColumn<
    T,
    ZodNullable<T['inputSchema']>,
    ZodNullable<T['outputSchema']>,
    ZodNullable<T['querySchema']>
  >;

  json<ZodSchema extends ZodTypeAny = ZodUnknown>(
    schema?: ZodSchema,
  ): ZodJSONColumn<ZodSchema>;

  boolean(): ZodBoolean;
  buffer(): ZodType<Buffer>;
  unknown(): ZodUnknown;
  never(): ZodNever;
  stringSchema(): ZodString;
  stringMin(max: number): ZodString;
  stringMax(max: number): ZodString;
  stringMinMax(min: number, max: number): ZodString;
  number(): ZodNumber;
  int(): ZodNumber;
  stringNumberDate(): ZodDate;
  timeInterval(): ZodObject<{
    years: ZodOptional<ZodNumber>;
    months: ZodOptional<ZodNumber>;
    days: ZodOptional<ZodNumber>;
    hours: ZodOptional<ZodNumber>;
    minutes: ZodOptional<ZodNumber>;
    seconds: ZodOptional<ZodNumber>;
  }>;
  bit(max: number): ZodString;
  uuid(): ZodString;

  inputSchema<T extends ColumnSchemaGetterTableClass>(
    this: T,
  ): MapSchema<T, 'inputSchema'>;

  outputSchema<T extends ColumnSchemaGetterTableClass>(
    this: T,
  ): MapSchema<T, 'outputSchema'>;

  querySchema<T extends ColumnSchemaGetterTableClass>(
    this: T,
  ): MapSchema<T, 'querySchema'>;

  updateSchema<T extends ColumnSchemaGetterTableClass>(
    this: T,
  ): UpdateSchema<T>;

  pkeySchema<T extends ColumnSchemaGetterTableClass>(this: T): PkeySchema<T>;

  error<T extends ColumnTypeBase>(this: T, error: ErrorMessages): T;

  smallint(): SmallIntColumnZod;
  integer(): IntegerColumnZod;
  real(): RealColumnZod;
  smallSerial(): SmallSerialColumnZod;
  serial(): SerialColumnZod;

  bigint(): BigIntColumnZod;
  decimal(precision?: number, scale?: number): DecimalColumnZod;
  doublePrecision(): DoublePrecisionColumnZod;
  bigSerial(): BigSerialColumnZod;
  money(): MoneyColumnZod;
  varchar(limit?: number): VarCharColumnZod;
  char(limit?: number): CharColumnZod;
  text(min: number, max: number): TextColumnZod;
  string(limit?: number): StringColumnZod;
  citext(min: number, max: number): CitextColumnZod;

  date(): DateColumnZod;
  timestampNoTZ(precision?: number): TimestampNoTzColumnZod;
  timestamp(precision?: number): TimestampColumnZod;
}

// parse a date string to number, with respect to null
const parseDateToNumber = (value: unknown) =>
  (value ? Date.parse(value as string) : value) as number;

// parse a date string to date object, with respect to null
const parseDateToDate = (value: unknown) =>
  (value ? new Date(value as string) : value) as Date;

(parseDateToNumber as unknown as { hideFromCode: boolean }).hideFromCode = (
  parseDateToDate as unknown as { hideFromCode: boolean }
).hideFromCode = true;

export const zodSchemaConfig: ZodSchemaConfig = {
  type: undefined as unknown as ZodTypeAny,
  parse(schema, fn) {
    return Object.assign(Object.create(this), {
      outputSchema: schema,
      parseFn: fn,
      parseItem: fn,
    });
  },
  encode(schema, fn) {
    return Object.assign(Object.create(this), {
      inputSchema: schema,
      encodeFn: fn,
    });
  },
  asType(_types) {
    return this as never;
  },
  dateAsNumber() {
    return this.parse(z.number(), parseDateToNumber) as never;
  },
  dateAsDate() {
    return this.parse(z.date(), parseDateToDate) as never;
  },
  enum(dataType, type) {
    return new EnumColumn(zodSchemaConfig, dataType, type, z.enum(type));
  },
  array(item) {
    return new ZodArrayColumn(item);
  },
  nullable() {
    return makeColumnNullable(
      this,
      z.nullable(this.inputSchema),
      z.nullable(this.outputSchema),
      z.nullable(this.querySchema),
    );
  },
  json<ZodSchema extends ZodTypeAny = ZodUnknown>(schema?: ZodSchema) {
    return new ZodJSONColumn((schema ?? z.unknown()) as ZodSchema);
  },
  boolean: () => z.boolean(),
  buffer: () => z.instanceof(Buffer),
  unknown: () => z.unknown(),
  never: () => z.never(),
  stringSchema: () => z.string(),
  stringMin(min) {
    return z.string().min(min);
  },
  stringMax(max) {
    return z.string().max(max);
  },
  stringMinMax(min, max) {
    return z.string().min(min).max(max);
  },
  number: () => z.number(),
  int: () => z.number().int(),

  stringNumberDate: () => z.coerce.date(),

  timeInterval: () =>
    z.object({
      years: z.number().optional(),
      months: z.number().optional(),
      days: z.number().optional(),
      hours: z.number().optional(),
      minutes: z.number().optional(),
      seconds: z.number().optional(),
    }),

  bit: (max?: number) =>
    (max ? z.string().max(max) : z.string()).regex(/[10]/g),

  uuid: () => z.string().uuid(),

  inputSchema() {
    return mapSchema(this, 'inputSchema');
  },

  outputSchema() {
    return mapSchema(this, 'outputSchema');
  },

  querySchema() {
    return mapSchema(this, 'querySchema');
  },

  updateSchema<T extends ColumnSchemaGetterTableClass>(this: T) {
    return (
      this.inputSchema() as ZodObject<ZodRawShape>
    ).partial() as UpdateSchema<T>;
  },

  pkeySchema<T extends ColumnSchemaGetterTableClass>(this: T) {
    const pkeys: Record<string, true> = {};

    const {
      columns: { shape },
    } = this.prototype;
    for (const key in shape) {
      if (shape[key].data.primaryKey) {
        pkeys[key] = true;
      }
    }

    return (this.querySchema() as ZodObject<ZodRawShape>).pick(
      pkeys,
    ) as PkeySchema<T>;
  },

  /**
   * `error` allows to specify two following validation messages:
   *
   * ```ts
   * t.text().error({
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
   *       .error({ required: 'One is required' })
   *       .min(5, 'Must be 5 or more characters long'),
   *     two: j
   *       .string()
   *       .error({ invalidType: 'Two should be a string' })
   *       .max(5, 'Must be 5 or fewer characters long'),
   *     three: j.string().length(5, 'Must be exactly 5 characters long'),
   *   }),
   * );
   * ```
   *
   * @param errors - object, key is either 'required' or 'invalidType', value is an error message
   */
  error(errors) {
    const { errors: old } = this.data;
    const newErrors = old ? { ...old, ...errors } : errors;
    const { required, invalidType } = newErrors;

    const errorMap: ZodErrorMap = (iss, ctx) => {
      if (iss.code !== 'invalid_type') return { message: ctx.defaultError };
      if (typeof ctx.data === 'undefined') {
        return { message: required ?? ctx.defaultError };
      }
      return { message: invalidType ?? ctx.defaultError };
    };

    (this.inputSchema as ZodTypeAny)._def.errorMap =
      (this.outputSchema as ZodTypeAny)._def.errorMap =
      (this.querySchema as ZodTypeAny)._def.errorMap =
        errorMap;

    return setColumnData(this, 'errors', newErrors);
  },

  smallint: () => new SmallIntColumnZod(zodSchemaConfig),
  integer: () => new IntegerColumnZod(zodSchemaConfig),
  real: () => new RealColumnZod(zodSchemaConfig),
  smallSerial: () => new SmallSerialColumnZod(zodSchemaConfig),
  serial: () => new SerialColumnZod(zodSchemaConfig),

  bigint: () => new BigIntColumnZod(zodSchemaConfig),
  decimal: (precision, scale) =>
    new DecimalColumnZod(zodSchemaConfig, precision, scale),
  doublePrecision: () => new DoublePrecisionColumnZod(zodSchemaConfig),
  bigSerial: () => new BigSerialColumnZod(zodSchemaConfig),
  money: () => new MoneyColumnZod(zodSchemaConfig),
  varchar: (limit) => new VarCharColumnZod(zodSchemaConfig, limit),
  char: (limit) => new CharColumnZod(zodSchemaConfig, limit),
  text: (min, max) => new TextColumnZod(zodSchemaConfig, min, max),
  string: (limit) => new StringColumnZod(zodSchemaConfig, limit),
  citext: (min, max) => new CitextColumnZod(zodSchemaConfig, min, max),

  date: () => new DateColumnZod(zodSchemaConfig),
  timestampNoTZ: (precision) =>
    new TimestampNoTzColumnZod(zodSchemaConfig, precision),
  timestamp: (precision) => new TimestampColumnZod(zodSchemaConfig, precision),
};

type MapSchema<
  T extends ColumnSchemaGetterTableClass,
  Key extends 'inputSchema' | 'outputSchema' | 'querySchema',
> = ZodObject<
  {
    [K in keyof ColumnSchemaGetterColumns<T>]: ColumnSchemaGetterColumns<T>[K][Key];
  },
  'strip'
>;

type UpdateSchema<T extends ColumnSchemaGetterTableClass> = ZodObject<
  {
    [K in keyof ColumnSchemaGetterColumns<T>]: ZodOptional<
      ColumnSchemaGetterColumns<T>[K]['inputSchema']
    >;
  },
  'strip'
>;

type PkeySchema<T extends ColumnSchemaGetterTableClass> = ZodObject<
  {
    [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string
      ? K
      : never]: ColumnSchemaGetterColumns<T>[K]['inputSchema'];
  },
  'strip'
>;

function mapSchema<
  T extends ColumnSchemaGetterTableClass,
  Key extends 'inputSchema' | 'outputSchema' | 'querySchema',
>(klass: T, schemaKey: Key): MapSchema<T, Key> {
  const shape: ZodRawShape = {};
  const { shape: columns } = klass.prototype.columns;

  for (const key in columns) {
    shape[key] = columns[key][schemaKey];
  }

  return z.object(shape) as MapSchema<T, Key>;
}
