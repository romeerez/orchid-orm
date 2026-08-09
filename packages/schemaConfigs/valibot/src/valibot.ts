import {
  Column,
  ArrayColumn,
  BigIntColumn,
  BigSerialColumn,
  CitextColumn,
  DateColumn,
  DecimalColumn,
  DoublePrecisionColumn,
  EnumColumn,
  IntegerColumn,
  JSONColumn,
  JSONTextColumn,
  MoneyColumn,
  RealColumn,
  SerialColumn,
  SmallIntColumn,
  SmallSerialColumn,
  StringColumn,
  TextColumn,
  TimestampColumn,
  TimestampTZColumn,
  VarCharColumn,
  ArrayColumnValue,
  ColumnSchemaGetterColumns,
  ColumnSchemaGetterTableClass,
  DateColumnInput,
  makeColumnNullable,
  setColumnEncode,
  setColumnParse,
  setColumnParseNull,
  setDataValue,
  StringData,
  ColumnSchemaConfig,
  AdapterSchemaConfigOptions,
  getDateAsNumberFn,
  getDateAsDateFn,
} from 'pqb/internal';
import {
  _addIssue,
  _stringify,
  array,
  ArraySchema as ValibotArraySchema,
  GenericSchema as BaseSchema,
  GenericTransformation as BaseTransformation,
  GenericValidation as BaseValidation,
  BrandAction,
  BaseIssue,
  boolean,
  BooleanSchema as ValibotBooleanSchema,
  cuid2,
  date,
  DateSchema as ValibotDateSchema,
  email,
  emoji,
  endsWith,
  finite,
  includes,
  instance,
  InstanceSchema as ValibotInstanceSchema,
  integer,
  IntegerAction,
  ipv4,
  ipv6,
  isoDateTime,
  length,
  maxLength,
  maxValue,
  message as setSchemaMessage,
  minLength,
  minValue,
  never,
  NeverSchema as ValibotNeverSchema,
  nullable,
  NullableSchema as ValibotNullableSchema,
  number,
  NumberSchema as ValibotNumberSchema,
  object,
  ObjectEntries,
  ObjectSchema as ValibotObjectSchema,
  optional,
  OptionalSchema as ValibotOptionalSchema,
  partial,
  pick,
  picklist,
  PicklistSchema as ValibotPicklistSchema,
  pipe,
  regex,
  required,
  startsWith,
  string,
  StringSchema as ValibotStringSchema,
  SchemaWithPipe,
  toLowerCase,
  trim,
  toUpperCase,
  toDate,
  ulid,
  union,
  unknown,
  UnknownSchema as ValibotUnknownSchema,
  UnionSchema as ValibotUnionSchema,
  url,
  uuid,
  InferOutput,
} from 'valibot';

type ArraySchema<Item extends BaseSchema> = ValibotArraySchema<Item, undefined>;
type BooleanSchema = ValibotBooleanSchema<undefined>;
type DateSchema = ValibotDateSchema<undefined>;
type InstanceSchema<Class extends new (...args: never[]) => object> =
  ValibotInstanceSchema<Class, undefined>;
type NeverSchema = ValibotNeverSchema<undefined>;
type NullableSchema<Schema extends BaseSchema> = ValibotNullableSchema<
  Schema,
  undefined
>;
type NumberSchema = ValibotNumberSchema<undefined>;
type ObjectSchema<Entries> = Entries extends ObjectEntries
  ? ValibotObjectSchema<Entries, undefined>
  : never;
type OptionalSchema<Schema extends BaseSchema> = ValibotOptionalSchema<
  Schema,
  undefined
>;
type PicklistSchema<Options extends readonly string[]> = ValibotPicklistSchema<
  Options,
  undefined
>;
type StringSchema = ValibotStringSchema<undefined>;
type UnionSchema<Options extends readonly BaseSchema[]> = ValibotUnionSchema<
  Options,
  undefined
>;
type UnknownSchema = ValibotUnknownSchema;
type Output<Schema extends BaseSchema> = InferOutput<Schema>;

class ValibotJSONColumn<Schema extends BaseSchema> extends JSONColumn<
  Output<Schema>,
  ValibotSchemaConfig,
  Schema
> {
  constructor(
    schemaConfig: ValibotSchemaConfig,
    schema: Schema,
    jsonEncodedByDriver?: boolean,
  ) {
    super(schemaConfig, schema, jsonEncodedByDriver);
  }
}

class ValibotJSONTextColumn<Schema extends BaseSchema> extends JSONTextColumn<
  Output<Schema>,
  ValibotSchemaConfig,
  Schema
> {
  constructor(schemaConfig: ValibotSchemaConfig, schema: Schema) {
    super(schemaConfig, schema);
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
  ) as unknown as Record<string, BaseSchema>;

  const v = validation(
    value as never,
    typeof params === 'object' ? params.message : params,
  );

  cloned.inputSchema = pipe(cloned.inputSchema, v);
  cloned.outputSchema = pipe(cloned.outputSchema, v);
  cloned.querySchema = pipe(cloned.querySchema, v);

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
  ) as unknown as Record<string, BaseSchema>;

  const v = validation(
    ...(args as never[]),
    (typeof params === 'object' ? params.message : params) as never,
  );

  cloned.inputSchema = pipe(cloned.inputSchema, v);
  cloned.outputSchema = pipe(cloned.outputSchema, v);
  cloned.querySchema = pipe(cloned.querySchema, v);

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
  extends
    ArrayColumn<
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
  constructor(schemaConfig: ValibotSchemaConfig, item: Item) {
    super(schemaConfig, item, array(item.inputSchema));
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
  kind: 'validation';
  reference: typeof gt;
  message?: string;
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
    kind: 'validation',
    type: 'gt',
    reference: gt,
    expects: `>${
      requirement instanceof Date
        ? requirement.toJSON()
        : _stringify(requirement)
    }`,
    async: false,
    message,
    requirement,
    '~run'(dataset, config) {
      if (dataset.typed && !(dataset.value > this.requirement)) {
        _addIssue(this, 'value', dataset, config, {
          received:
            dataset.value instanceof Date
              ? dataset.value.toJSON()
              : _stringify(dataset.value),
        });
      }
      return dataset;
    },
  };
}

export type LtValidation<
  TInput extends string | number | bigint | boolean | Date,
  TRequirement extends TInput,
> = BaseValidation<TInput> & {
  kind: 'validation';
  reference: typeof lt;
  message?: string;
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
    kind: 'validation',
    type: 'lt',
    reference: lt,
    expects: `<${
      requirement instanceof Date
        ? requirement.toJSON()
        : _stringify(requirement)
    }`,
    async: false,
    message,
    requirement,
    '~run'(dataset, config) {
      if (dataset.typed && !(dataset.value < this.requirement)) {
        _addIssue(this, 'value', dataset, config, {
          received:
            dataset.value instanceof Date
              ? dataset.value.toJSON()
              : _stringify(dataset.value),
        });
      }
      return dataset;
    },
  };
}

export type StepValidation<
  TInput extends number,
  TRequirement extends TInput,
> = BaseValidation<TInput> & {
  kind: 'validation';
  reference: typeof step;
  message?: string;
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
    kind: 'validation',
    type: 'step',
    reference: step,
    expects: `a multiple of ${_stringify(requirement)}`,
    async: false,
    message,
    requirement,
    '~run'(dataset, config) {
      if (dataset.typed && dataset.value % this.requirement !== 0) {
        _addIssue(this, 'value', dataset, config);
      }
      return dataset;
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
  extends SmallIntColumn<ValibotSchemaConfig>, NumberMethods {}

class SmallIntColumnValibot extends SmallIntColumn<ValibotSchemaConfig> {}
Object.assign(SmallIntColumnValibot.prototype, numberMethods);

interface IntegerColumnValibot
  extends IntegerColumn<ValibotSchemaConfig>, NumberMethods {}

class IntegerColumnValibot extends IntegerColumn<ValibotSchemaConfig> {}
Object.assign(IntegerColumnValibot.prototype, numberMethods);

interface RealColumnValibot
  extends RealColumn<ValibotSchemaConfig>, NumberMethods {}

class RealColumnValibot extends RealColumn<ValibotSchemaConfig> {}
Object.assign(RealColumnValibot.prototype, numberMethods);

interface SmallSerialColumnValibot
  extends SmallSerialColumn<ValibotSchemaConfig>, NumberMethods {}

class SmallSerialColumnValibot extends SmallSerialColumn<ValibotSchemaConfig> {}
Object.assign(SmallSerialColumnValibot.prototype, numberMethods);

interface SerialColumnValibot
  extends SerialColumn<ValibotSchemaConfig>, NumberMethods {}

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
    return applySimpleMethod(this, 'trim', trim, params);
  },

  toLowerCase(params) {
    return applySimpleMethod(this, 'toLowerCase', toLowerCase, params);
  },

  toUpperCase(params) {
    return applySimpleMethod(this, 'toUpperCase', toUpperCase, params);
  },
};

interface BigIntColumnValibot
  extends BigIntColumn<ValibotSchemaConfig>, StringMethods {}

class BigIntColumnValibot extends BigIntColumn<ValibotSchemaConfig> {}
Object.assign(BigIntColumnValibot.prototype, stringMethods);

interface DecimalColumnValibot
  extends DecimalColumn<ValibotSchemaConfig>, StringMethods {}

class DecimalColumnValibot extends DecimalColumn<ValibotSchemaConfig> {}
Object.assign(DecimalColumnValibot.prototype, stringMethods);

interface DoublePrecisionColumnValibot
  extends DoublePrecisionColumn<ValibotSchemaConfig>, StringMethods {}

class DoublePrecisionColumnValibot extends DoublePrecisionColumn<ValibotSchemaConfig> {}
Object.assign(DoublePrecisionColumnValibot.prototype, stringMethods);

interface BigSerialColumnValibot
  extends BigSerialColumn<ValibotSchemaConfig>, StringMethods {}

class BigSerialColumnValibot extends BigSerialColumn<ValibotSchemaConfig> {}
Object.assign(BigSerialColumnValibot.prototype, stringMethods);

interface MoneyColumnValibot
  extends MoneyColumn<ValibotSchemaConfig>, NumberMethods {}

class MoneyColumnValibot extends MoneyColumn<ValibotSchemaConfig> {}
Object.assign(MoneyColumnValibot.prototype, numberMethods);

interface VarCharColumnValibot
  extends VarCharColumn<ValibotSchemaConfig>, StringMethods {}

class VarCharColumnValibot extends VarCharColumn<ValibotSchemaConfig> {}
Object.assign(VarCharColumnValibot.prototype, stringMethods);

interface TextColumnValibot
  extends TextColumn<ValibotSchemaConfig>, StringMethods {}

class TextColumnValibot extends TextColumn<ValibotSchemaConfig> {}
Object.assign(TextColumnValibot.prototype, stringMethods);

interface StringColumnValibot
  extends StringColumn<ValibotSchemaConfig>, StringMethods {}

class StringColumnValibot extends StringColumn<ValibotSchemaConfig> {}
Object.assign(StringColumnValibot.prototype, stringMethods);

interface CitextColumnValibot
  extends CitextColumn<ValibotSchemaConfig>, StringMethods {}

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
  extends DateColumn<ValibotSchemaConfig>, DateMethods {}

class DateColumnValibot extends DateColumn<ValibotSchemaConfig> {}
Object.assign(DateColumnValibot.prototype, dateMethods);

interface TimestampNoTzColumnValibot
  extends TimestampColumn<ValibotSchemaConfig>, DateMethods {}

class TimestampNoTzColumnValibot extends TimestampColumn<ValibotSchemaConfig> {}
Object.assign(TimestampNoTzColumnValibot.prototype, dateMethods);

interface TimestampColumnValibot
  extends TimestampTZColumn<ValibotSchemaConfig>, DateMethods {}

class TimestampColumnValibot extends TimestampTZColumn<ValibotSchemaConfig> {}
Object.assign(TimestampColumnValibot.prototype, dateMethods);

type PointSchemaValibot = ObjectSchema<{
  srid: OptionalSchema<NumberSchema>;
  lon: NumberSchema;
  lat: NumberSchema;
}>;

let pointSchema: PointSchemaValibot | undefined;

export interface ValibotSchemaConfig extends ColumnSchemaConfig {
  __schemaType: BaseSchema;

  parse<
    T extends Column.Pick.ForParse,
    OutputSchema extends BaseSchema,
    Out = Output<OutputSchema>,
  >(
    this: T,
    _schema: OutputSchema,
    fn: (input: T['__type']) => Out,
  ): Column.Parse<T, OutputSchema, Out>;

  parseNull<
    T extends Column.Pick.ForParseNull,
    NullSchema extends BaseSchema,
    NullType = Output<NullSchema>,
  >(
    this: T,
    _schema: NullSchema,
    fn: () => NullType,
  ): Column.ParseNull<T, NullSchema, NullType>;

  encode<
    T extends Column.Pick.Type,
    InputSchema extends BaseSchema,
    In = Output<InputSchema>,
  >(
    this: T,
    _schema: InputSchema,
    fn: (input: In) => unknown,
  ): Column.Encode<T, InputSchema, In>;

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
      : K extends '__inputType'
        ? Types['input'] extends BaseSchema
          ? Output<Types['input']>
          : Type
        : K extends 'inputSchema'
          ? Types['input'] extends BaseSchema
            ? Types['input']
            : TypeSchema
          : K extends '__outputType'
            ? Types['output'] extends BaseSchema
              ? Output<Types['output']>
              : Type
            : K extends 'outputSchema'
              ? Types['output'] extends BaseSchema
                ? Types['output']
                : TypeSchema
              : K extends '__queryType'
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
      T['__inputType'] extends never
        ? T['__outputType'] & T['__queryType']
        : T['__inputType'] & T['__outputType'] & T['__queryType']
    >,
  >(
    this: T,
    types: Type,
  ): {
    [K in keyof T]: K extends '__inputType'
      ? T['__inputType'] extends never
        ? never
        : Output<Type>
      : K extends '__outputType' | '__queryType'
        ? Output<Type>
        : K extends 'inputSchema'
          ? T['__inputType'] extends never
            ? NeverSchema
            : Type
          : K extends 'outputSchema' | 'querySchema'
            ? Type
            : T[K];
  };

  narrowAllTypes<
    T extends Column.InputOutputQueryTypesWithSchemas,
    Types extends {
      input?: { '~types'?: { output: T['__inputType'] } };
      output?: { '~types'?: { output: T['__outputType'] } };
      query?: { '~types'?: { output: T['__queryType'] } };
    },
  >(
    this: T,
    types: Types,
  ): {
    [K in keyof T]: K extends '__inputType'
      ? Types['input'] extends BaseSchema
        ? Output<Types['input']>
        : T['__inputType']
      : K extends 'inputSchema'
        ? Types['input'] extends BaseSchema
          ? Types['input']
          : T['inputSchema']
        : K extends '__outputType'
          ? Types['output'] extends BaseSchema
            ? Output<Types['output']>
            : T['__outputType']
          : K extends 'outputSchema'
            ? Types['output'] extends BaseSchema
              ? Types['output']
              : T['outputSchema']
            : K extends '__queryType'
              ? Types['query'] extends BaseSchema
                ? Output<Types['query']>
                : T['querySchema']
              : K extends 'querySchema'
                ? Types['query'] extends BaseSchema
                  ? Types['query']
                  : T['querySchema']
                : T[K];
  };

  dateAsNumber<T extends Column.Pick.ForParse>(
    this: T,
  ): Column.Parse<T, NumberSchema, number>;

  dateAsDate<T extends Column.Pick.ForParse>(
    this: T,
  ): Column.Parse<T, DateSchema, Date>;

  enum<T extends readonly string[]>(
    dataType: string,
    type: T,
  ): EnumColumn<ValibotSchemaConfig, PicklistSchema<T>, T>;

  array<Item extends ArrayColumnValue>(item: Item): ValibotArrayColumn<Item>;

  nullable<T extends Column.Pick.ForNullable>(
    this: T,
  ): Column.NullableWithSchema<
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

  jsonText<Schema extends BaseSchema = UnknownSchema>(
    schema?: Schema,
  ): ValibotJSONTextColumn<Schema>;

  boolean(): BooleanSchema;
  buffer(): InstanceSchema<typeof Buffer>;
  unknown(): UnknownSchema;
  never(): NeverSchema;
  stringSchema(): StringSchema;
  stringMin(max: number): BaseSchema<string, string>;
  stringMax(max: number): BaseSchema<string, string>;
  stringMinMax(min: number, max: number): BaseSchema<string, string>;
  number(): NumberSchema;
  int(): SchemaWithPipe<
    readonly [NumberSchema, IntegerAction<number, undefined>]
  >;
  stringNumberDate(): BaseSchema<DateColumnInput, Date>;
  timeInterval(): ObjectSchema<{
    years: OptionalSchema<NumberSchema>;
    months: OptionalSchema<NumberSchema>;
    days: OptionalSchema<NumberSchema>;
    hours: OptionalSchema<NumberSchema>;
    minutes: OptionalSchema<NumberSchema>;
    seconds: OptionalSchema<NumberSchema>;
  }>;
  bit(max?: number): BaseSchema<string, string>;
  uuid(): BaseSchema<string, string>;

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

export const valibotSchemaConfig = (
  options?: AdapterSchemaConfigOptions,
): ValibotSchemaConfig => {
  const schemaConfig: ValibotSchemaConfig = {
    __schemaType: undefined as unknown as BaseSchema,
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
      // oxlint-disable-next-line typescript/no-explicit-any
      return (this as any).parse(
        number(),
        getDateAsNumberFn(this as never),
      ) as never;
    },
    dateAsDate() {
      // oxlint-disable-next-line typescript/no-explicit-any
      return (this as any).parse(
        date(),
        getDateAsDateFn(this as never),
      ) as never;
    },
    enum(dataType, type) {
      return new EnumColumn(schemaConfig, dataType, type, picklist(type));
    },
    array(item) {
      return new ValibotArrayColumn(schemaConfig, item);
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
      return new ValibotJSONColumn(
        schemaConfig,
        (schema ?? unknown()) as Schema,
        options?.jsonEncodedByDriver,
      );
    },
    jsonText<Schema extends BaseSchema = UnknownSchema>(schema?: Schema) {
      return new ValibotJSONTextColumn(
        schemaConfig,
        (schema ?? unknown()) as Schema,
      );
    },
    boolean: () => boolean(),
    buffer: () => instance(Buffer),
    unknown: () => unknown(),
    never: () => never(),
    stringSchema: () => string(),
    stringMin(min) {
      return pipe(string(), minLength(min));
    },
    stringMax(max) {
      return pipe(string(), maxLength(max));
    },
    stringMinMax(min, max) {
      return pipe(string(), minLength(min), maxLength(max));
    },
    number: () => number(),
    int: () => pipe(number(), integer()),

    stringNumberDate: () => pipe(union([string(), number(), date()]), toDate()),

    timeInterval: () =>
      object({
        years: optional(number()),
        months: optional(number()),
        days: optional(number()),
        hours: optional(number()),
        minutes: optional(number()),
        seconds: optional(number()),
      }),

    bit: (max?: number) =>
      max
        ? pipe(string(), maxLength(max), regex(/[10]/g))
        : pipe(string(), regex(/[10]/g)),

    uuid: () => pipe(string(), uuid()),

    inputSchema() {
      return mapSchema(this, 'inputSchema');
    },

    outputSchema() {
      return mapSchema(this, 'outputSchema');
    },

    querySchema() {
      return partial(mapSchema(this, 'querySchema') as never) as QuerySchema<
        typeof this
      >;
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
      const c = Object.create(this as object) as Column & {
        inputSchema: BaseSchema;
        outputSchema: BaseSchema;
        querySchema: BaseSchema;
      };
      c.inputSchema = setSchemaMessage(c.inputSchema, message);
      c.outputSchema = setSchemaMessage(c.outputSchema, message);
      c.querySchema = setSchemaMessage(c.querySchema, message);
      return c as never;
    },

    smallint: () => new SmallIntColumnValibot(schemaConfig),
    integer: () => new IntegerColumnValibot(schemaConfig),
    real: () => new RealColumnValibot(schemaConfig),
    smallSerial: () => new SmallSerialColumnValibot(schemaConfig),
    serial: () => new SerialColumnValibot(schemaConfig),

    bigint: () => new BigIntColumnValibot(schemaConfig),
    decimal: (precision, scale) =>
      new DecimalColumnValibot(schemaConfig, precision, scale),
    doublePrecision: () => new DoublePrecisionColumnValibot(schemaConfig),
    bigSerial: () => new BigSerialColumnValibot(schemaConfig),
    money: () => new MoneyColumnValibot(schemaConfig),
    varchar: (limit) => new VarCharColumnValibot(schemaConfig, limit),
    text: () => new TextColumnValibot(schemaConfig),
    string: (limit) => new StringColumnValibot(schemaConfig, limit),
    citext: () => new CitextColumnValibot(schemaConfig),

    date: () =>
      new DateColumnValibot(schemaConfig, options?.dateParsedByDriver),
    timestampNoTZ: (precision) =>
      new TimestampNoTzColumnValibot(
        schemaConfig,
        precision,
        options?.dateParsedByDriver,
      ),
    timestamp: (precision) =>
      new TimestampColumnValibot(
        schemaConfig,
        precision,
        options?.dateParsedByDriver,
      ),

    geographyPointSchema: () =>
      (pointSchema ??= object({
        srid: optional(number()),
        lon: number(),
        lat: number(),
      })),
  };
  return schemaConfig;
};

type MapSchema<
  T extends ColumnSchemaGetterTableClass,
  Key extends 'inputSchema' | 'outputSchema' | 'querySchema',
> = ObjectSchema<{
  readonly [K in keyof ColumnSchemaGetterColumns<T>]: ColumnValidationSchema<
    T,
    K,
    Key
  >;
}>;

type TableName<T extends ColumnSchemaGetterTableClass> = T['data'] extends {
  table: infer Table extends string;
}
  ? Table
  : T['data'] extends { name: infer Name extends string }
    ? Name
    : never;

// The default token is represented as `true | string` before table binding.
type ColumnBrand<
  T extends ColumnSchemaGetterTableClass,
  K extends keyof ColumnSchemaGetterColumns<T>,
> = true extends ColumnSchemaGetterColumns<T>[K]['data']['branded']
  ? `${TableName<T>}.${K & string}`
  : ColumnSchemaGetterColumns<T>[K]['data']['branded'] extends string
    ? ColumnSchemaGetterColumns<T>[K]['data']['branded'] & string
    : never;

type BrandedSchema<
  Schema extends BaseSchema<unknown, unknown, BaseIssue<unknown>>,
  Brand extends PropertyKey,
> = SchemaWithPipe<readonly [Schema, BrandAction<InferOutput<Schema>, Brand>]>;

type ColumnValidationSchema<
  T extends ColumnSchemaGetterTableClass,
  K extends keyof ColumnSchemaGetterColumns<T>,
  Key extends 'inputSchema' | 'outputSchema' | 'querySchema',
  Brand extends PropertyKey = ColumnBrand<T, K>,
> = SchemaOf<
  [Brand] extends [never]
    ? ColumnSchemaGetterColumns<T>[K][Key]
    : ColumnSchemaGetterColumns<T>[K][Key] extends BaseSchema<
          unknown,
          unknown,
          BaseIssue<unknown>
        >
      ? BrandedSchema<ColumnSchemaGetterColumns<T>[K][Key], Brand>
      : ColumnSchemaGetterColumns<T>[K][Key]
>;

type SchemaOf<Schema> = Schema extends BaseSchema ? Schema : never;

type QuerySchema<T extends ColumnSchemaGetterTableClass> = ObjectSchema<{
  readonly [K in keyof ColumnSchemaGetterColumns<T>]: OptionalSchema<
    ColumnValidationSchema<T, K, 'querySchema'>
  >;
}>;

type CreateSchema<T extends ColumnSchemaGetterTableClass> = ObjectSchema<{
  readonly [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string
    ? never
    : K]: ColumnSchemaGetterColumns<T>[K]['data']['isNullable'] extends true
    ? OptionalSchema<ColumnValidationSchema<T, K, 'inputSchema'>>
    : ColumnSchemaGetterColumns<T>[K]['data']['default'] extends true
      ? OptionalSchema<ColumnValidationSchema<T, K, 'inputSchema'>>
      : ColumnValidationSchema<T, K, 'inputSchema'>;
}>;

type UpdateSchema<T extends ColumnSchemaGetterTableClass> = ObjectSchema<{
  readonly [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string
    ? never
    : K]: OptionalSchema<ColumnValidationSchema<T, K, 'inputSchema'>>;
}>;

type PkeySchema<T extends ColumnSchemaGetterTableClass> = ObjectSchema<{
  readonly [K in keyof ColumnSchemaGetterColumns<T> as ColumnSchemaGetterColumns<T>[K]['data']['primaryKey'] extends string
    ? K
    : never]: ColumnValidationSchema<T, K, 'inputSchema'>;
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
