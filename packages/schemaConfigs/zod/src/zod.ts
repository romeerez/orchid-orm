import {
  ColumnSchemaGetterColumns,
  ColumnSchemaGetterTableClass,
  makeColumnNullable,
  setDataValue,
  StringData,
  setColumnData,
  RecordUnknown,
  ArrayColumn,
  ArrayColumnValue,
  BigIntColumn,
  BigSerialColumn,
  CitextColumn,
  Column,
  DateColumn,
  DecimalColumn,
  DoublePrecisionColumn,
  EnumColumn,
  IntegerColumn,
  JSONColumn,
  MoneyColumn,
  RealColumn,
  SerialColumn,
  setColumnEncode,
  setColumnParse,
  setColumnParseNull,
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
  ZodUnion,
  ZodUnknown,
  optional,
  core,
} from 'zod/v4';
import { $ZodErrorMap, $ZodType } from 'zod/v4/core';
import { ToEnum } from 'zod/v4/core/util';

interface ZodShape {
  [K: string]: $ZodType;
}

class ZodJSONColumn<ZodSchema extends ZodTypeAny> extends JSONColumn<
  ZodSchema['_output'],
  ZodSchemaConfig,
  ZodSchema
> {
  constructor(schema: ZodSchema) {
    super(zodSchemaConfig, schema);
  }
}

function applyMethod<T, Key extends string>(
  column: T,
  key: Key,
  value: unknown,
  params?: Column.Error.StringOrMessage,
) {
  const cloned = setDataValue(
    column as Column.Pick.Data,
    key,
    value,
    params,
  ) as Column;

  // Prevent zod from mutating `value` and `params`. It overwrites `message` to `error`.
  const p = typeof params === 'object' ? { ...params } : params;
  const v = value === params ? p : value;

  const c = column as Column;
  cloned.inputSchema = c.inputSchema[key](v, p);
  cloned.outputSchema = c.outputSchema[key](v, p);
  cloned.querySchema = c.querySchema[key](v, p);
  return cloned as never;
}

function applySimpleMethod<T, Key extends string>(
  column: T,
  key: Key,
  params?: Column.Error.StringOrMessage,
) {
  const c = column as Column;
  const cloned = setDataValue(c, key, true, params) as Column;
  cloned.inputSchema = c.inputSchema[key](params);
  cloned.outputSchema = c.outputSchema[key](params);
  cloned.querySchema = c.querySchema[key](params);
  return cloned as never;
}

interface ArrayMethods<Value> {
  // Require a minimum length (inclusive)
  min<T>(this: T, value: Value, params?: Column.Error.StringOrMessage): T;

  // Require a maximum length (inclusive)
  max<T>(this: T, value: Value, params?: Column.Error.StringOrMessage): T;

  // Require a specific length
  length<T>(this: T, value: Value, params?: Column.Error.StringOrMessage): T;

  // Require a value to be non-empty
  nonEmpty<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
    const column = this as Column;
    const cloned = setDataValue(column, 'nonEmpty', true, params) as Column;
    cloned.inputSchema = column.inputSchema.nonempty(params);
    cloned.outputSchema = column.outputSchema.nonempty(params);
    cloned.querySchema = column.querySchema.nonempty(params);
    return cloned as never;
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
  lt<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
  lte<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
  max<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
  gt<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
  gte<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
  min<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
  positive<T>(this: T, params?: Column.Error.StringOrMessage): T;
  nonNegative<T>(this: T, params?: Column.Error.StringOrMessage): T;
  negative<T>(this: T, params?: Column.Error.StringOrMessage): T;
  nonPositive<T>(this: T, params?: Column.Error.StringOrMessage): T;
  step<T>(this: T, value: number, params?: Column.Error.StringOrMessage): T;
  int<T>(this: T, params?: Column.Error.StringOrMessage): T;
  finite<T>(this: T, params?: Column.Error.StringOrMessage): T;
  safe<T>(this: T, params?: Column.Error.StringOrMessage): T;
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
  email<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Check a value to be a valid url
  url<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Check a value to be an emoji
  emoji<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Check a value to be a valid uuid
  uuid<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Check a value to be a valid cuid
  cuid<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Check a value to be a valid cuid2
  cuid2<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Check a value to be a valid ulid
  ulid<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Validate the value over the given regular expression
  regex<T>(this: T, value: RegExp, params?: Column.Error.StringOrMessage): T;

  // Check a value to include a given string
  includes<T, Value extends string>(
    this: T,
    value: Value,
    params?: Column.Error.StringOrMessage,
  ): T;

  // Check a value to start with a given string
  startsWith<T, Value extends string>(
    this: T,
    value: Value,
    params?: Column.Error.StringOrMessage,
  ): T;

  // Check a value to end with a given string
  endsWith<T, Value extends string>(
    this: T,
    value: Value,
    params?: Column.Error.StringOrMessage,
  ): T;

  // Check a value have a valid datetime string
  datetime<T>(
    this: T,
    params?: StringData['datetime'] &
      Exclude<Column.Error.StringOrMessage, string>,
  ): T;

  // Check a value to be a valid ipv4 address
  ipv4<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;

  // Check a value to be a valid ipv6 address
  ipv6<T>(this: T, params?: Exclude<Column.Error.StringOrMessage, string>): T;

  // Trim the value during a validation
  trim<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Transform value to a lower case during a validation
  toLowerCase<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Transform value to an upper case during a validation
  toUpperCase<T>(this: T, params?: Column.Error.StringOrMessage): T;
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

  ipv4(params) {
    return applyMethod(this, 'ipv4', params, params);
  },

  ipv6(params) {
    return applyMethod(this, 'ipv6', params, params);
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

interface MoneyColumnZod extends MoneyColumn<ZodSchemaConfig>, NumberMethods {}

class MoneyColumnZod extends MoneyColumn<ZodSchemaConfig> {}
Object.assign(MoneyColumnZod.prototype, numberMethods);

interface VarCharColumnZod
  extends VarCharColumn<ZodSchemaConfig>,
    StringMethods {}

class VarCharColumnZod extends VarCharColumn<ZodSchemaConfig> {}
Object.assign(VarCharColumnZod.prototype, stringMethods);

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
  min<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;

  // Require a value to be lower than or equal to a given Date object
  max<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;
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

type PointSchemaZod = ZodObject<{
  srid: ZodOptional<ZodNumber>;
  lon: ZodNumber;
  lat: ZodNumber;
}>;

let pointSchema: PointSchemaZod | undefined;

export interface BareZodType {
  _output: unknown;
}

export interface ZodSchemaConfig {
  type: ZodTypeAny;

  parse<
    T extends Column.Pick.ForParse,
    OutputSchema extends ZodTypeAny,
    Output = OutputSchema['_output'],
  >(
    this: T,
    _schema: OutputSchema,
    fn: (input: T['type']) => Output,
  ): Column.Modifiers.Parse<T, OutputSchema, Output>;

  parseNull<
    T extends Column.Pick.ForParseNull,
    NullSchema extends ZodTypeAny,
    NullType = NullSchema['_output'],
  >(
    this: T,
    _schema: NullSchema,
    fn: () => NullType,
  ): Column.Modifiers.ParseNull<T, NullSchema, NullType>;

  encode<
    T extends { type: unknown },
    InputSchema extends ZodTypeAny,
    Input = InputSchema['_output'],
  >(
    this: T,
    _schema: InputSchema,
    fn: (input: Input) => unknown,
  ): Column.Modifiers.Encode<T, InputSchema, Input>;

  /**
   * @deprecated use narrowType instead
   */
  asType<
    T,
    Types extends Column.AsTypeArg<ZodTypeAny>,
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

  narrowType<
    T extends Column.InputOutputQueryTypesWithSchemas,
    Type extends {
      _output: T['inputType'] extends never
        ? T['outputType'] & T['queryType']
        : T['inputType'] & T['outputType'] & T['queryType'];
    },
  >(
    this: T,
    type: Type,
  ): {
    [K in keyof T]: K extends 'inputType'
      ? T['inputType'] extends never
        ? never
        : Type['_output']
      : K extends 'outputType' | 'queryType'
      ? Type['_output']
      : K extends 'inputSchema'
      ? T['inputType'] extends never
        ? ZodNever
        : Type
      : K extends 'outputSchema' | 'querySchema'
      ? Type
      : T[K];
  };

  narrowAllTypes<
    T extends Column.InputOutputQueryTypesWithSchemas,
    Types extends {
      input?: { _output: T['inputType'] };
      output?: { _output: T['outputType'] };
      query?: { _output: T['queryType'] };
    },
  >(
    this: T,
    types: Types,
  ): {
    [K in keyof T]: K extends 'inputType'
      ? Types['input'] extends BareZodType
        ? Types['input']['_output']
        : T['inputType']
      : K extends 'inputSchema'
      ? Types['input'] extends BareZodType
        ? Types['input']
        : T['inputSchema']
      : K extends 'outputType'
      ? Types['output'] extends BareZodType
        ? Types['output']['_output']
        : T['outputType']
      : K extends 'outputSchema'
      ? Types['output'] extends BareZodType
        ? Types['output']
        : T['outputSchema']
      : K extends 'queryType'
      ? Types['query'] extends BareZodType
        ? Types['query']['_output']
        : T['queryType']
      : K extends 'querySchema'
      ? Types['query'] extends BareZodType
        ? Types['query']
        : T['querySchema']
      : T[K];
  };

  dateAsNumber<T extends Column<ZodSchemaConfig>>(
    this: T,
  ): Column.Modifiers.Parse<T, ZodNumber, number>;

  dateAsDate<T extends Column<ZodSchemaConfig>>(
    this: T,
  ): Column.Modifiers.Parse<T, ZodDate, Date>;

  enum<T extends readonly string[]>(
    dataType: string,
    type: T,
  ): EnumColumn<ZodSchemaConfig, ZodEnum<ToEnum<T[number]>>, T>;

  array<Item extends ArrayColumnValue>(item: Item): ZodArrayColumn<Item>;

  nullable<T extends Column.Pick.ForNullable>(
    this: T,
  ): Column.Modifiers.Nullable<
    T,
    ZodNullable<T['inputSchema']>,
    T['nullSchema'] extends ZodTypeAny
      ? ZodUnion<[T['outputSchema'], T['nullSchema']]>
      : ZodNullable<T['outputSchema']>,
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

  querySchema<T extends ColumnSchemaGetterTableClass>(this: T): QuerySchema<T>;

  createSchema<T extends ColumnSchemaGetterTableClass>(
    this: T,
  ): CreateSchema<T>;

  updateSchema<T extends ColumnSchemaGetterTableClass>(
    this: T,
  ): UpdateSchema<T>;

  pkeySchema<T extends ColumnSchemaGetterTableClass>(this: T): PkeySchema<T>;

  error<T>(this: T, error: Column.Error.Messages): T;

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
  text(): TextColumnZod;
  string(limit?: number): StringColumnZod;
  citext(): CitextColumnZod;

  date(): DateColumnZod;
  timestampNoTZ(precision?: number): TimestampNoTzColumnZod;
  timestamp(precision?: number): TimestampColumnZod;

  geographyPointSchema(): PointSchemaZod;
}

// parse a date string to date object, with respect to null
const parseDateToDate = (value: unknown) => new Date(value as string);

export const zodSchemaConfig: ZodSchemaConfig = {
  type: undefined as unknown as ZodTypeAny,
  parse(schema, fn) {
    return setColumnParse(this as never, fn, schema);
  },
  parseNull(schema, fn) {
    return setColumnParseNull(this as never, fn, schema);
  },
  encode(schema, fn) {
    return setColumnEncode(this as never, fn, schema);
  },
  asType(_types) {
    return this as never;
  },
  narrowType(type) {
    const c = Object.create(this);
    if ((c as Column.Pick.Data).data.generated) {
      c.outputSchema = c.querySchema = type;
    } else {
      c.inputSchema = c.outputSchema = c.querySchema = type;
    }
    return c as never;
  },
  narrowAllTypes(types) {
    const c = Object.create(this);
    if (types.input) {
      c.inputSchema = types.input;
    }
    if (types.output) {
      c.outputSchema = types.output;
    }
    if (types.query) {
      c.querySchema = types.query;
    }
    return c as never;
  },
  dateAsNumber() {
    return this.parse(z.number(), Date.parse as never) as never;
  },
  dateAsDate() {
    return this.parse(z.date(), parseDateToDate) as never;
  },
  enum(dataType, type) {
    return new EnumColumn(
      zodSchemaConfig,
      dataType,
      Object.values(type),
      z.enum(type),
    ) as never;
  },
  array(item) {
    return new ZodArrayColumn(item);
  },
  nullable() {
    return makeColumnNullable(
      this as never,
      z.nullable(this.inputSchema),
      this.nullSchema
        ? this.outputSchema.or(this.nullSchema)
        : z.nullable(this.outputSchema),
      z.nullable(this.querySchema),
    ) as never;
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
    const shape: RecordUnknown = {};
    const { shape: columns } = this.prototype.columns;

    for (const key in columns) {
      const column = columns[key] as Column;
      if (columns[key].dataType) {
        shape[key] = column.querySchema.optional();
      }
    }

    return z.object(shape) as never;
  },

  createSchema<T extends ColumnSchemaGetterTableClass>(this: T) {
    const input = this.inputSchema() as ZodObject<ZodRawShape>;

    const shape: ZodShape = {};
    const { shape: columns } = this.prototype.columns;

    for (const key in columns) {
      const column = columns[key];
      if (column.dataType && !column.data.primaryKey) {
        shape[key] = input.shape[key];

        if (column.data.isNullable || column.data.default !== undefined) {
          shape[key] = optional(shape[key]);
        }
      }
    }

    return z.object(shape) as unknown as CreateSchema<T>;
  },

  updateSchema<T extends ColumnSchemaGetterTableClass>(this: T) {
    return (this.createSchema() as ZodObject<ZodRawShape>).partial() as never;
  },

  pkeySchema<T extends ColumnSchemaGetterTableClass>(this: T) {
    const pkeys: Record<string, true> = {};

    const {
      columns: { shape },
    } = this.prototype;
    for (const key in shape) {
      if (shape[key].dataType && shape[key].data.primaryKey) {
        pkeys[key] = true;
      }
    }

    return (this.querySchema() as ZodObject<ZodRawShape>)
      .pick(pkeys)
      .required() as never;
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
    const c = this as Column;
    const { errors: old } = c.data;
    const newErrors = old ? { ...old, ...errors } : errors;
    const { required, invalidType } = newErrors;

    const errorMap: $ZodErrorMap = (iss) => {
      if (iss.code === 'invalid_type') {
        return iss.input === undefined ? required : invalidType;
      }
      // not sure if this is correct to return undefined for other errors,
      // let's wait for an issue.
      return;
    };

    (c.inputSchema as ZodTypeAny).def.error =
      (c.outputSchema as ZodTypeAny).def.error =
      (c.querySchema as ZodTypeAny).def.error =
        errorMap;

    return setColumnData(c, 'errors', newErrors as never) as never;
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
  text: () => new TextColumnZod(zodSchemaConfig),
  string: (limit) => new StringColumnZod(zodSchemaConfig, limit),
  citext: () => new CitextColumnZod(zodSchemaConfig),

  date: () => new DateColumnZod(zodSchemaConfig),
  timestampNoTZ: (precision) =>
    new TimestampNoTzColumnZod(zodSchemaConfig, precision),
  timestamp: (precision) => new TimestampColumnZod(zodSchemaConfig, precision),

  geographyPointSchema: () =>
    (pointSchema ??= z.object({
      srid: z.number().optional(),
      lon: z.number(),
      lat: z.number(),
    })),
};

type MapSchema<
  T extends ColumnSchemaGetterTableClass,
  Key extends 'inputSchema' | 'outputSchema' | 'querySchema',
> = ZodObject<
  {
    [K in keyof ColumnSchemaGetterColumns<T>]: ColumnSchemaGetterColumns<T>[K][Key];
  },
  core.$strict
>;

type QuerySchema<T extends ColumnSchemaGetterTableClass> = ZodObject<
  {
    [K in keyof ColumnSchemaGetterColumns<T>]: ZodOptional<
      ColumnSchemaGetterColumns<T>[K]['querySchema']
    >;
  },
  core.$strict
>;

type CreateSchema<T extends ColumnSchemaGetterTableClass> = ZodObject<
  {
    [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string
      ? never
      : K]: ColumnSchemaGetterColumns<T>[K]['data']['isNullable'] extends true
      ? ZodOptional<ColumnSchemaGetterColumns<T>[K]['inputSchema']>
      : undefined extends ColumnSchemaGetterColumns<T>[K]['data']['default']
      ? ColumnSchemaGetterColumns<T>[K]['inputSchema']
      : ZodOptional<ColumnSchemaGetterColumns<T>[K]['inputSchema']>;
  },
  core.$strict
>;

type UpdateSchema<T extends ColumnSchemaGetterTableClass> = ZodObject<
  {
    [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string
      ? never
      : K]: ZodOptional<ColumnSchemaGetterColumns<T>[K]['inputSchema']>;
  },
  core.$strict
>;

type PkeySchema<T extends ColumnSchemaGetterTableClass> = ZodObject<
  {
    [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string
      ? K
      : never]: ColumnSchemaGetterColumns<T>[K]['inputSchema'];
  },
  core.$strict
>;

function mapSchema<
  T extends ColumnSchemaGetterTableClass,
  Key extends 'inputSchema' | 'outputSchema' | 'querySchema',
>(klass: T, schemaKey: Key): MapSchema<T, Key> {
  const shape: ZodShape = {};
  const { shape: columns } = klass.prototype.columns;

  for (const key in columns) {
    if (columns[key].dataType) {
      shape[key] = columns[key][schemaKey];
    }
  }

  return z.object(shape) as MapSchema<T, Key>;
}
