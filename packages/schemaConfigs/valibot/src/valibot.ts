import {
  ColumnSchemaGetterColumns,
  ColumnSchemaGetterTableClass,
  makeColumnNullable,
  setDataValue,
  StringData,
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
  actionIssue,
  actionOutput,
  array,
  ArraySchema,
  BaseSchema,
  BaseTransformation,
  BaseValidation,
  boolean,
  BooleanSchema,
  coerce,
  cuid2,
  date,
  DateSchema,
  email,
  emoji,
  endsWith,
  finite,
  includes,
  instance,
  InstanceSchema,
  integer,
  ipv4,
  ipv6,
  isoDateTime,
  length,
  maxLength,
  maxValue,
  minLength,
  minValue,
  never,
  NeverSchema,
  nullable,
  NullableSchema,
  number,
  NumberSchema,
  object,
  ObjectEntries,
  ObjectSchema,
  optional,
  OptionalSchema,
  Output,
  partial,
  pick,
  picklist,
  PicklistSchema,
  regex,
  required,
  startsWith,
  string,
  stringify,
  StringSchema,
  toLowerCase,
  toTrimmed,
  toUpperCase,
  ulid,
  union,
  unknown,
  UnknownSchema,
  UnionSchema,
  url,
  uuid,
} from 'valibot';

class ValibotJSONColumn<Schema extends BaseSchema> extends JSONColumn<
  Output<Schema>,
  ValibotSchemaConfig,
  Schema
> {
  constructor(schema: Schema) {
    super(valibotSchemaConfig, schema);
  }
}

function applyMethod(
  column: unknown,
  key: string,
  value: unknown,
  validation: (value: never, params?: string) => BaseValidation,
  params?: Column.Error.StringOrMessage,
) {
  const cloned = setDataValue(
    column as Column.Pick.Data,
    key,
    value,
    params,
  ) as Column;

  const v = validation(
    value as never,
    typeof params === 'object' ? params.message : params,
  );

  cloned.inputSchema.pipe.push(v);
  cloned.outputSchema.pipe.push(v);
  cloned.querySchema.pipe.push(v);

  return cloned as never;
}

function applySimpleMethod(
  column: unknown,
  key: string,
  validation: (...args: never[]) => BaseValidation | BaseTransformation,
  params?: Column.Error.StringOrMessage,
  ...args: unknown[]
) {
  const cloned = setDataValue(
    column as Column.Pick.Data,
    key,
    true,
    params,
  ) as Column;

  const v = validation(
    ...(args as never[]),
    (typeof params === 'object' ? params.message : params) as never,
  );

  cloned.inputSchema.pipe.push(v);
  cloned.outputSchema.pipe.push(v);
  cloned.querySchema.pipe.push(v);

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

const arrayMethods: ArrayMethods<number> = {
  min(value, params) {
    return applyMethod(this, 'min', value, minLength, params);
  },
  max(value, params) {
    return applyMethod(this, 'max', value, maxLength, params);
  },
  length(value, params) {
    return applyMethod(this, 'length', value, length, params);
  },
  nonEmpty(params) {
    return applyMethod(this, 'min', 1, minLength, params);
  },
};

interface ValibotArrayColumn<Item extends ArrayColumnValue>
  extends ArrayColumn<
      ValibotSchemaConfig,
      Item,
      ArraySchema<Item['inputSchema']>,
      ArraySchema<Item['outputSchema']>,
      ArraySchema<Item['querySchema']>
    >,
    ArrayMethods<number> {}

class ValibotArrayColumn<Item extends ArrayColumnValue> extends ArrayColumn<
  ValibotSchemaConfig,
  Item,
  ArraySchema<Item['inputSchema']>,
  ArraySchema<Item['outputSchema']>,
  ArraySchema<Item['querySchema']>
> {
  constructor(item: Item) {
    super(valibotSchemaConfig, item, array(item.inputSchema, []));
  }
}

Object.assign(ValibotArrayColumn.prototype, arrayMethods);

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

export type GtValidation<
  TInput extends string | number | bigint | boolean | Date,
  TRequirement extends TInput,
> = BaseValidation<TInput> & {
  /**
   * The validation type.
   */
  type: 'gt';
  /**
   * The maximum value.
   */
  requirement: TRequirement;
};

export function gt<
  TInput extends string | number | bigint | Date,
  TRequirement extends TInput,
>(
  requirement: TRequirement,
  message?: string,
): GtValidation<TInput, TRequirement> {
  return {
    type: 'gt',
    expects: `>${
      requirement instanceof Date
        ? requirement.toJSON()
        : stringify(requirement)
    }`,
    async: false,
    message,
    requirement,
    _parse(input) {
      if (input > this.requirement) {
        return actionOutput(input);
      }
      return actionIssue(
        this,
        gt,
        input,
        'value',
        input instanceof Date ? input.toJSON() : stringify(input),
      );
    },
  };
}

export type LtValidation<
  TInput extends string | number | bigint | boolean | Date,
  TRequirement extends TInput,
> = BaseValidation<TInput> & {
  /**
   * The validation type.
   */
  type: 'lt';
  /**
   * The maximum value.
   */
  requirement: TRequirement;
};

export function lt<
  TInput extends string | number | bigint | Date,
  TRequirement extends TInput,
>(
  requirement: TRequirement,
  message?: string,
): LtValidation<TInput, TRequirement> {
  return {
    type: 'lt',
    expects: `<${
      requirement instanceof Date
        ? requirement.toJSON()
        : stringify(requirement)
    }`,
    async: false,
    message,
    requirement,
    _parse(input) {
      if (input < this.requirement) {
        return actionOutput(input);
      }
      return actionIssue(
        this,
        lt,
        input,
        'value',
        input instanceof Date ? input.toJSON() : stringify(input),
      );
    },
  };
}

export type StepValidation<
  TInput extends number,
  TRequirement extends TInput,
> = BaseValidation<TInput> & {
  /**
   * The validation type.
   */
  type: 'step';
  /**
   * The maximum value.
   */
  requirement: TRequirement;
};

export function step<TInput extends number, TRequirement extends TInput>(
  requirement: TRequirement,
  message?: string,
): StepValidation<TInput, TRequirement> {
  return {
    type: 'step',
    expects: `a multiple of ${stringify(requirement)}`,
    async: false,
    message,
    requirement,
    _parse(input) {
      if (input % this.requirement === 0) {
        return actionOutput(input);
      }
      return actionIssue(this, step, input, 'value', stringify(input));
    },
  };
}

const numberMethods: NumberMethods = {
  // Require a value to be lower than a given number
  lt(value, params) {
    return applyMethod(this, 'lt', value, lt, params);
  },

  // Require a value to be lower than or equal to a given number (the same as `max`)
  lte(value, params) {
    return applyMethod(this, 'lte', value, maxValue, params);
  },

  // Require a value to be lower than or equal to a given number
  max(value, params) {
    return applyMethod(this, 'lte', value, maxValue, params);
  },

  // Require a value to be greater than a given number
  gt(value, params) {
    return applyMethod(this, 'gt', value, gt, params);
  },

  // Require a value to be greater than or equal to a given number (the same as `min`)
  gte(value, params) {
    return applyMethod(this, 'gte', value, minValue, params);
  },

  // Require a value to be greater than or equal to a given number
  min(value, params) {
    return applyMethod(this, 'gte', value, minValue, params);
  },

  // Require a value to be greater than 0
  positive(params) {
    return applyMethod(this, 'gt', 0, gt, params);
  },

  // Require a value to be greater than or equal to 0
  nonNegative(params) {
    return applyMethod(this, 'gte', 0, minValue, params);
  },

  // Require a value to be lower than 0
  negative(params) {
    return applyMethod(this, 'lt', 0, lt, params);
  },

  // Require a value to be lower than or equal to 0
  nonPositive(params) {
    return applyMethod(this, 'lte', 0, maxValue, params);
  },

  // Require a value to be a multiple of a given number
  step(value, params) {
    return applyMethod(this, 'step', value, step, params);
  },

  // Require a value to be an integer
  int(params) {
    return applySimpleMethod(this, 'int', integer, params);
  },

  // Exclude `Infinity` from being a valid value
  finite(params) {
    return applySimpleMethod(this, 'finite', finite, params);
  },

  // Require the value to be less than or equal to Number.MAX_SAFE_INTEGER
  safe(params) {
    return applySimpleMethod(
      applySimpleMethod(
        this,
        'safe',
        minValue,
        params,
        Number.MIN_SAFE_INTEGER,
      ),
      'safe',
      maxValue,
      params,
      Number.MAX_SAFE_INTEGER,
    );
  },
};

interface SmallIntColumnValibot
  extends SmallIntColumn<ValibotSchemaConfig>,
    NumberMethods {}

class SmallIntColumnValibot extends SmallIntColumn<ValibotSchemaConfig> {}
Object.assign(SmallIntColumnValibot.prototype, numberMethods);

interface IntegerColumnValibot
  extends IntegerColumn<ValibotSchemaConfig>,
    NumberMethods {}

class IntegerColumnValibot extends IntegerColumn<ValibotSchemaConfig> {}
Object.assign(IntegerColumnValibot.prototype, numberMethods);

interface RealColumnValibot
  extends RealColumn<ValibotSchemaConfig>,
    NumberMethods {}

class RealColumnValibot extends RealColumn<ValibotSchemaConfig> {}
Object.assign(RealColumnValibot.prototype, numberMethods);

interface SmallSerialColumnValibot
  extends SmallSerialColumn<ValibotSchemaConfig>,
    NumberMethods {}

class SmallSerialColumnValibot extends SmallSerialColumn<ValibotSchemaConfig> {}
Object.assign(SmallSerialColumnValibot.prototype, numberMethods);

interface SerialColumnValibot
  extends SerialColumn<ValibotSchemaConfig>,
    NumberMethods {}

class SerialColumnValibot extends SerialColumn<ValibotSchemaConfig> {}
Object.assign(SerialColumnValibot.prototype, numberMethods);

interface StringMethods extends ArrayMethods<number> {
  // Check a value to be a valid email
  email<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Check a value to be a valid url
  url<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Check a value to be an emoji
  emoji<T>(this: T, params?: Column.Error.StringOrMessage): T;

  // Check a value to be a valid uuid
  uuid<T>(this: T, params?: Column.Error.StringOrMessage): T;

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
    return applySimpleMethod(this, 'email', email, params);
  },

  url(params) {
    return applySimpleMethod(this, 'url', url, params);
  },

  emoji(params) {
    return applySimpleMethod(this, 'emoji', emoji, params);
  },

  uuid(params) {
    return applySimpleMethod(this, 'uuid', uuid, params);
  },

  cuid2(params) {
    return applySimpleMethod(this, 'cuid2', cuid2, params);
  },

  ulid(params) {
    return applySimpleMethod(this, 'ulid', ulid, params);
  },

  regex(value, params) {
    return applyMethod(this, 'regex', value, regex, params);
  },

  includes(value, params) {
    return applyMethod(this, 'includes', value, includes, params);
  },

  startsWith(value, params) {
    return applyMethod(this, 'startsWith', value, startsWith, params);
  },

  endsWith(value, params) {
    return applyMethod(this, 'endsWith', value, endsWith, params);
  },

  datetime(params) {
    return applySimpleMethod(this, 'datetime', isoDateTime, params);
  },

  ipv4(params = {}) {
    return applySimpleMethod(this, 'ipv4', ipv4, params);
  },

  ipv6(params = {}) {
    return applySimpleMethod(this, 'ipv6', ipv6, params);
  },

  trim(params) {
    return applySimpleMethod(this, 'trim', toTrimmed, params);
  },

  toLowerCase(params) {
    return applySimpleMethod(this, 'toLowerCase', toLowerCase, params);
  },

  toUpperCase(params) {
    return applySimpleMethod(this, 'toUpperCase', toUpperCase, params);
  },
};

interface BigIntColumnValibot
  extends BigIntColumn<ValibotSchemaConfig>,
    StringMethods {}

class BigIntColumnValibot extends BigIntColumn<ValibotSchemaConfig> {}
Object.assign(BigIntColumnValibot.prototype, stringMethods);

interface DecimalColumnValibot
  extends DecimalColumn<ValibotSchemaConfig>,
    StringMethods {}

class DecimalColumnValibot extends DecimalColumn<ValibotSchemaConfig> {}
Object.assign(DecimalColumnValibot.prototype, stringMethods);

interface DoublePrecisionColumnValibot
  extends DoublePrecisionColumn<ValibotSchemaConfig>,
    StringMethods {}

class DoublePrecisionColumnValibot extends DoublePrecisionColumn<ValibotSchemaConfig> {}
Object.assign(DoublePrecisionColumnValibot.prototype, stringMethods);

interface BigSerialColumnValibot
  extends BigSerialColumn<ValibotSchemaConfig>,
    StringMethods {}

class BigSerialColumnValibot extends BigSerialColumn<ValibotSchemaConfig> {}
Object.assign(BigSerialColumnValibot.prototype, stringMethods);

interface MoneyColumnValibot
  extends MoneyColumn<ValibotSchemaConfig>,
    NumberMethods {}

class MoneyColumnValibot extends MoneyColumn<ValibotSchemaConfig> {}
Object.assign(MoneyColumnValibot.prototype, numberMethods);

interface VarCharColumnValibot
  extends VarCharColumn<ValibotSchemaConfig>,
    StringMethods {}

class VarCharColumnValibot extends VarCharColumn<ValibotSchemaConfig> {}
Object.assign(VarCharColumnValibot.prototype, stringMethods);

interface TextColumnValibot
  extends TextColumn<ValibotSchemaConfig>,
    StringMethods {}

class TextColumnValibot extends TextColumn<ValibotSchemaConfig> {}
Object.assign(TextColumnValibot.prototype, stringMethods);

interface StringColumnValibot
  extends StringColumn<ValibotSchemaConfig>,
    StringMethods {}

class StringColumnValibot extends StringColumn<ValibotSchemaConfig> {}
Object.assign(StringColumnValibot.prototype, stringMethods);

interface CitextColumnValibot
  extends CitextColumn<ValibotSchemaConfig>,
    StringMethods {}

class CitextColumnValibot extends CitextColumn<ValibotSchemaConfig> {}
Object.assign(CitextColumnValibot.prototype, stringMethods);

interface DateMethods {
  // Require a value to be greater than or equal to a given Date object
  min<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;

  // Require a value to be lower than or equal to a given Date object
  max<T>(this: T, value: Date, params?: Column.Error.StringOrMessage): T;
}

const dateMethods: DateMethods = {
  min(value, params) {
    return applyMethod(this, 'min', value, minValue, params);
  },
  max(value, params) {
    return applyMethod(this, 'max', value, maxValue, params);
  },
};

interface DateColumnValibot
  extends DateColumn<ValibotSchemaConfig>,
    DateMethods {}

class DateColumnValibot extends DateColumn<ValibotSchemaConfig> {}
Object.assign(DateColumnValibot.prototype, dateMethods);

interface TimestampNoTzColumnValibot
  extends TimestampColumn<ValibotSchemaConfig>,
    DateMethods {}

class TimestampNoTzColumnValibot extends TimestampColumn<ValibotSchemaConfig> {}
Object.assign(TimestampNoTzColumnValibot.prototype, dateMethods);

interface TimestampColumnValibot
  extends TimestampTZColumn<ValibotSchemaConfig>,
    DateMethods {}

class TimestampColumnValibot extends TimestampTZColumn<ValibotSchemaConfig> {}
Object.assign(TimestampColumnValibot.prototype, dateMethods);

type PointSchemaValibot = ObjectSchema<{
  srid: OptionalSchema<NumberSchema>;
  lon: NumberSchema;
  lat: NumberSchema;
}>;

let pointSchema: PointSchemaValibot | undefined;

export interface ValibotSchemaConfig {
  type: BaseSchema;

  parse<
    T extends Column.Pick.ForParse,
    OutputSchema extends BaseSchema,
    Out = Output<OutputSchema>,
  >(
    this: T,
    _schema: OutputSchema,
    fn: (input: T['type']) => Out,
  ): Column.Modifiers.Parse<T, OutputSchema, Out>;

  parseNull<
    T extends Column.Pick.ForParseNull,
    NullSchema extends BaseSchema,
    NullType = Output<NullSchema>,
  >(
    this: T,
    _schema: NullSchema,
    fn: () => NullType,
  ): Column.Modifiers.ParseNull<T, NullSchema, NullType>;

  encode<
    T extends { type: unknown },
    InputSchema extends BaseSchema,
    In = Output<InputSchema>,
  >(
    this: T,
    _schema: InputSchema,
    fn: (input: In) => unknown,
  ): Column.Modifiers.Encode<T, InputSchema, In>;

  /**
   * @deprecated use narrowType instead
   */
  asType<
    T,
    Types extends Column.AsTypeArg<BaseSchema>,
    TypeSchema extends BaseSchema = Types extends { type: BaseSchema }
      ? Types['type']
      : never,
    Type = Output<TypeSchema>,
  >(
    this: T,
    types: Types,
  ): {
    [K in keyof T]: K extends 'type'
      ? Type
      : K extends 'inputType'
      ? Types['input'] extends BaseSchema
        ? Output<Types['input']>
        : Type
      : K extends 'inputSchema'
      ? Types['input'] extends BaseSchema
        ? Types['input']
        : TypeSchema
      : K extends 'outputType'
      ? Types['output'] extends BaseSchema
        ? Output<Types['output']>
        : Type
      : K extends 'outputSchema'
      ? Types['output'] extends BaseSchema
        ? Types['output']
        : TypeSchema
      : K extends 'queryType'
      ? Types['query'] extends BaseSchema
        ? Output<Types['query']>
        : Type
      : K extends 'querySchema'
      ? Types['query'] extends BaseSchema
        ? Types['query']
        : TypeSchema
      : T[K];
  };

  narrowType<
    T extends Column.InputOutputQueryTypesWithSchemas,
    Type extends BaseSchema<
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any,
      T['inputType'] extends never
        ? T['outputType'] & T['queryType']
        : T['inputType'] & T['outputType'] & T['queryType']
    >,
  >(
    this: T,
    types: Type,
  ): {
    [K in keyof T]: K extends 'inputType'
      ? T['inputType'] extends never
        ? never
        : Output<Type>
      : K extends 'outputType' | 'queryType'
      ? Output<Type>
      : K extends 'inputSchema'
      ? T['inputType'] extends never
        ? NeverSchema
        : Type
      : K extends 'outputSchema' | 'querySchema'
      ? Type
      : T[K];
  };

  narrowAllTypes<
    T extends Column.InputOutputQueryTypesWithSchemas,
    Types extends {
      input?: { _types?: { output: T['inputType'] } };
      output?: { _types?: { output: T['outputType'] } };
      query?: { _types?: { output: T['queryType'] } };
    },
  >(
    this: T,
    types: Types,
  ): {
    [K in keyof T]: K extends 'inputType'
      ? Types['input'] extends BaseSchema
        ? Output<Types['input']>
        : T['inputType']
      : K extends 'inputSchema'
      ? Types['input'] extends BaseSchema
        ? Types['input']
        : T['inputSchema']
      : K extends 'outputType'
      ? Types['output'] extends BaseSchema
        ? Output<Types['output']>
        : T['outputType']
      : K extends 'outputSchema'
      ? Types['output'] extends BaseSchema
        ? Types['output']
        : T['outputSchema']
      : K extends 'queryType'
      ? Types['query'] extends BaseSchema
        ? Output<Types['query']>
        : T['querySchema']
      : K extends 'querySchema'
      ? Types['query'] extends BaseSchema
        ? Types['query']
        : T['querySchema']
      : T[K];
  };

  dateAsNumber<T extends Column<ValibotSchemaConfig>>(
    this: T,
  ): Column.Modifiers.Parse<T, NumberSchema, number>;

  dateAsDate<T extends Column<ValibotSchemaConfig>>(
    this: T,
  ): Column.Modifiers.Parse<T, DateSchema, Date>;

  enum<T extends readonly string[]>(
    dataType: string,
    type: T,
  ): EnumColumn<ValibotSchemaConfig, PicklistSchema<T>, T>;

  array<Item extends ArrayColumnValue>(item: Item): ValibotArrayColumn<Item>;

  nullable<T extends Column.Pick.ForNullable>(
    this: T,
  ): Column.Modifiers.Nullable<
    T,
    NullableSchema<T['inputSchema']>,
    T['nullSchema'] extends BaseSchema
      ? UnionSchema<[T['outputSchema'], T['nullSchema']]>
      : NullableSchema<T['outputSchema']>,
    NullableSchema<T['querySchema']>
  >;

  json<Schema extends BaseSchema = UnknownSchema>(
    schema?: Schema,
  ): ValibotJSONColumn<Schema>;

  boolean(): BooleanSchema;
  buffer(): InstanceSchema<typeof Buffer>;
  unknown(): UnknownSchema;
  never(): NeverSchema;
  stringSchema(): StringSchema;
  stringMin(max: number): StringSchema;
  stringMax(max: number): StringSchema;
  stringMinMax(min: number, max: number): StringSchema;
  number(): NumberSchema;
  int(): NumberSchema;
  stringNumberDate(): DateSchema;
  timeInterval(): ObjectSchema<{
    years: OptionalSchema<NumberSchema>;
    months: OptionalSchema<NumberSchema>;
    days: OptionalSchema<NumberSchema>;
    hours: OptionalSchema<NumberSchema>;
    minutes: OptionalSchema<NumberSchema>;
    seconds: OptionalSchema<NumberSchema>;
  }>;
  bit(max: number): StringSchema;
  uuid(): StringSchema;

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

  error<T>(this: T, message: string): T;

  smallint(): SmallIntColumnValibot;
  integer(): IntegerColumnValibot;
  real(): RealColumnValibot;
  smallSerial(): SmallSerialColumnValibot;
  serial(): SerialColumnValibot;

  bigint(): BigIntColumnValibot;
  decimal(precision?: number, scale?: number): DecimalColumnValibot;
  doublePrecision(): DoublePrecisionColumnValibot;
  bigSerial(): BigSerialColumnValibot;
  money(): MoneyColumnValibot;
  varchar(limit?: number): VarCharColumnValibot;
  text(): TextColumnValibot;
  string(limit?: number): StringColumnValibot;
  citext(): CitextColumnValibot;

  date(): DateColumnValibot;
  timestampNoTZ(precision?: number): TimestampNoTzColumnValibot;
  timestamp(precision?: number): TimestampColumnValibot;

  geographyPointSchema(): PointSchemaValibot;
}

// parse a date string to date object, with respect to null
const parseDateToDate = (value: unknown) => new Date(value as string);

export const valibotSchemaConfig: ValibotSchemaConfig = {
  type: undefined as unknown as BaseSchema,
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
    return this.parse(number([]), Date.parse as never);
  },
  dateAsDate() {
    return this.parse(date([]), parseDateToDate);
  },
  enum(dataType, type) {
    return new EnumColumn(valibotSchemaConfig, dataType, type, picklist(type));
  },
  array(item) {
    return new ValibotArrayColumn(item);
  },
  nullable() {
    return makeColumnNullable(
      this as never,
      nullable(this.inputSchema),
      this.nullSchema
        ? union([this.outputSchema, this.nullSchema])
        : nullable(this.outputSchema),
      nullable(this.querySchema),
    ) as never;
  },
  json<Schema extends BaseSchema = UnknownSchema>(schema?: Schema) {
    return new ValibotJSONColumn((schema ?? unknown([])) as Schema);
  },
  boolean: () => boolean([]),
  buffer: () => instance(Buffer, []),
  unknown: () => unknown([]),
  never: () => never(),
  stringSchema: () => string([]),
  stringMin(min) {
    return string([minLength(min)]);
  },
  stringMax(max) {
    return string([maxLength(max)]);
  },
  stringMinMax(min, max) {
    return string([minLength(min), maxLength(max)]);
  },
  number: () => number([]),
  int: () => number([integer()]),

  stringNumberDate: () =>
    coerce(date([]), (input) => new Date(input as string)),

  timeInterval: () =>
    object(
      {
        years: optional(number()),
        months: optional(number()),
        days: optional(number()),
        hours: optional(number()),
        minutes: optional(number()),
        seconds: optional(number()),
      },
      [],
    ),

  bit: (max?: number) =>
    max ? string([maxLength(max), regex(/[10]/g)]) : string([regex(/[10]/g)]),

  uuid: () => string([uuid()]),

  inputSchema() {
    return mapSchema(this, 'inputSchema');
  },

  outputSchema() {
    return mapSchema(this, 'outputSchema');
  },

  querySchema() {
    return partial(mapSchema(this, 'querySchema'));
  },

  createSchema<T extends ColumnSchemaGetterTableClass>(this: T) {
    const input = this.inputSchema() as ObjectSchema<ObjectEntries>;

    const shape: ObjectEntries = {};
    const { shape: columns } = this.prototype.columns;

    for (const key in columns) {
      const column = columns[key];
      if (column.dataType && !column.data.primaryKey) {
        shape[key] = input.entries[key];

        if (column.data.isNullable || column.data.default !== undefined) {
          shape[key] = optional(shape[key]);
        }
      }
    }

    return object(shape) as CreateSchema<T>;
  },

  updateSchema<T extends ColumnSchemaGetterTableClass>(this: T) {
    return partial(this.createSchema() as never) as UpdateSchema<T>;
  },

  pkeySchema<T extends ColumnSchemaGetterTableClass>(this: T) {
    const keys: string[] = [];

    const {
      columns: { shape },
    } = this.prototype;
    for (const key in shape) {
      if (shape[key].data.primaryKey) {
        keys.push(key);
      }
    }

    return required(
      pick(this.querySchema() as never, keys as never),
    ) as PkeySchema<T>;
  },

  error(message: string) {
    const c = this as Column;
    c.inputSchema.message =
      c.outputSchema.message =
      c.querySchema.message =
        message;
    return c as never;
  },

  smallint: () => new SmallIntColumnValibot(valibotSchemaConfig),
  integer: () => new IntegerColumnValibot(valibotSchemaConfig),
  real: () => new RealColumnValibot(valibotSchemaConfig),
  smallSerial: () => new SmallSerialColumnValibot(valibotSchemaConfig),
  serial: () => new SerialColumnValibot(valibotSchemaConfig),

  bigint: () => new BigIntColumnValibot(valibotSchemaConfig),
  decimal: (precision, scale) =>
    new DecimalColumnValibot(valibotSchemaConfig, precision, scale),
  doublePrecision: () => new DoublePrecisionColumnValibot(valibotSchemaConfig),
  bigSerial: () => new BigSerialColumnValibot(valibotSchemaConfig),
  money: () => new MoneyColumnValibot(valibotSchemaConfig),
  varchar: (limit) => new VarCharColumnValibot(valibotSchemaConfig, limit),
  text: () => new TextColumnValibot(valibotSchemaConfig),
  string: (limit) => new StringColumnValibot(valibotSchemaConfig, limit),
  citext: () => new CitextColumnValibot(valibotSchemaConfig),

  date: () => new DateColumnValibot(valibotSchemaConfig),
  timestampNoTZ: (precision) =>
    new TimestampNoTzColumnValibot(valibotSchemaConfig, precision),
  timestamp: (precision) =>
    new TimestampColumnValibot(valibotSchemaConfig, precision),

  geographyPointSchema: () =>
    (pointSchema ??= object({
      srid: optional(number()),
      lon: number(),
      lat: number(),
    })),
};

type MapSchema<
  T extends ColumnSchemaGetterTableClass,
  Key extends 'inputSchema' | 'outputSchema' | 'querySchema',
> = ObjectSchema<{
  [K in keyof ColumnSchemaGetterColumns<T>]: ColumnSchemaGetterColumns<T>[K][Key];
}>;

type QuerySchema<T extends ColumnSchemaGetterTableClass> = ObjectSchema<{
  [K in keyof ColumnSchemaGetterColumns<T>]: OptionalSchema<
    ColumnSchemaGetterColumns<T>[K]['querySchema']
  >;
}>;

type CreateSchema<T extends ColumnSchemaGetterTableClass> = ObjectSchema<{
  [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string
    ? never
    : K]: ColumnSchemaGetterColumns<T>[K]['data']['isNullable'] extends true
    ? OptionalSchema<ColumnSchemaGetterColumns<T>[K]['inputSchema']>
    : undefined extends ColumnSchemaGetterColumns<T>[K]['data']['default']
    ? ColumnSchemaGetterColumns<T>[K]['inputSchema']
    : OptionalSchema<ColumnSchemaGetterColumns<T>[K]['inputSchema']>;
}>;

type UpdateSchema<T extends ColumnSchemaGetterTableClass> = ObjectSchema<{
  [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string
    ? never
    : K]: OptionalSchema<ColumnSchemaGetterColumns<T>[K]['inputSchema']>;
}>;

type PkeySchema<T extends ColumnSchemaGetterTableClass> = ObjectSchema<{
  [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string
    ? K
    : never]: ColumnSchemaGetterColumns<T>[K]['inputSchema'];
}>;

function mapSchema<
  T extends ColumnSchemaGetterTableClass,
  Key extends 'inputSchema' | 'outputSchema' | 'querySchema',
>(klass: T, schemaKey: Key): MapSchema<T, Key> {
  const shape: ObjectEntries = {};
  const { shape: columns } = klass.prototype.columns;

  for (const key in columns) {
    if (columns[key].dataType) {
      shape[key] = columns[key][schemaKey];
    }
  }

  return object(shape) as MapSchema<T, Key>;
}
