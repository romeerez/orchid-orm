import { Column } from '../column';
import { joinTruthy } from '../../utils';
import { Code, ColumnToCodeCtx, dateDataToCode } from '../code';
import { columnCode } from '../code';
import { Operators } from '../operators';
import { DateColumnData } from '../column-data-types';
import { ColumnSchemaConfig } from '../column-schema';
import { PostgresInterval } from '../../adapters/driver-adapter-shared';
import { setColumnDefaultParse } from '../column.utils';

export type DateColumnInput = string | number | Date;

const dateToString = (value: Date): string => value.toISOString();

// encode string, number, or Date to a Date object,
const dateTimeEncode = (value: DateColumnInput) => {
  return typeof value === 'number' ? new Date(value) : value;
};

// In Bun, it is Date normally, but string in case of nested json
const parseStringOrDateToNumber = (value: unknown): number =>
  typeof value === 'string' ? Date.parse(value) : (value as Date).getTime();

export const getDateAsNumberFn = (column: {
  data: Column.Data;
  dateParsedByDriver?: boolean;
}) =>
  column.dateParsedByDriver
    ? parseStringOrDateToNumber
    : (Date.parse as (input: unknown) => number);

// parse a date string to date object, with respect to null
const parseDateToDate = (value: unknown): Date => new Date(value as string);

// In Bun, it is Date normally, but string in case of nested json
const parseStringOrDateToDate = (value: unknown): Date =>
  typeof value === 'string' ? new Date(value) : (value as Date);

export const getDateAsDateFn = (column: {
  data: Column.Data;
  dateParsedByDriver?: boolean;
}) => (column.dateParsedByDriver ? parseStringOrDateToDate : parseDateToDate);

// common class for Date and DateTime columns
export abstract class DateBaseColumn<
  Schema extends ColumnSchemaConfig,
> extends Column {
  declare __schema: Schema;
  declare __type: string;
  declare __inputType: DateColumnInput;
  declare inputSchema: ReturnType<Schema['stringNumberDate']>;
  declare data: DateColumnData;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: DateColumnInput;
  declare querySchema: ReturnType<Schema['stringNumberDate']>;
  operators = Operators.date;
  asNumber: Schema['dateAsNumber'];
  asDate: Schema['dateAsDate'];

  constructor(
    schema: Schema,
    public dateParsedByDriver?: boolean,
  ) {
    super(
      schema,
      schema.stringNumberDate() as never,
      schema.stringSchema() as never,
      schema.stringNumberDate() as never,
    );
    if (dateParsedByDriver) {
      this._parse = dateToString as never;
    }
    this.asNumber = schema.dateAsNumber;
    this.asDate = schema.dateAsDate;
    this.data.encode = dateTimeEncode;
  }
}

// date	4 bytes	date (no time of day)	4713 BC	5874897 AD 1 day
export class DateColumn<
  Schema extends ColumnSchemaConfig,
> extends DateBaseColumn<Schema> {
  dataType = 'date' as const;
  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(
      this,
      ctx,
      key,
      `date()${dateDataToCode(this.data, ctx.migration)}`,
    );
  }
}

export abstract class DateTimeBaseClass<
  Schema extends ColumnSchemaConfig,
> extends DateBaseColumn<Schema> {
  declare data: DateColumnData & { dateTimePrecision?: number };

  constructor(
    schema: Schema,
    dateTimePrecision?: number,
    dateParsedByDriver?: boolean,
  ) {
    super(schema, dateParsedByDriver);
    this.data.dateTimePrecision = dateTimePrecision;
  }

  toSQL() {
    return joinTruthy(
      this.dataType,
      this.data.dateTimePrecision !== undefined &&
        `(${this.data.dateTimePrecision})`,
    );
  }
}

export abstract class DateTimeTzBaseClass<
  Schema extends ColumnSchemaConfig,
> extends DateTimeBaseClass<Schema> {
  abstract baseDataType: string;

  toSQL() {
    return joinTruthy(
      this.baseDataType,
      this.data.dateTimePrecision !== undefined &&
        `(${this.data.dateTimePrecision})`,
      ' with time zone',
    );
  }
}

const timestampToCode = (
  self:
    | TimestampColumn<ColumnSchemaConfig>
    | TimestampTZColumn<ColumnSchemaConfig>,
  ctx: ColumnToCodeCtx,
  key: string,
) => {
  const { dateTimePrecision: p } = self.data;

  const { defaultTimestamp } = self.data;
  // migrations should capture the current `nowSQL`, it can be changed by user later.
  if (!ctx.migration && defaultTimestamp) {
    const noTz = self instanceof TimestampColumn ? 'NoTZ' : '';

    const def = self.data.default;
    const modifyQuery = self.data.modifyQuery;
    self.data.default = undefined;
    self.data.modifyQuery = undefined;

    const code = columnCode(
      self,
      ctx,
      key,
      `timestamps${noTz}(${
        p && p !== 6 ? p : ''
      }).${defaultTimestamp}${dateDataToCode(self.data, ctx.migration)}`,
    );

    self.data.default = def;
    self.data.modifyQuery = modifyQuery;

    return code;
  } else {
    return columnCode(
      self,
      ctx,
      key,
      `${self instanceof TimestampColumn ? 'timestampNoTZ' : 'timestamp'}(${
        p && p !== 6 ? p : ''
      })${dateDataToCode(self.data, ctx.migration)}`,
    );
  }
};

// timestamp [ (p) ] [ without time zone ]	8 bytes	both date and time (no time zone)	4713 BC	294276 AD	1 microsecond
export class TimestampColumn<
  Schema extends ColumnSchemaConfig,
> extends DateTimeBaseClass<Schema> {
  dataType = 'timestamp' as const;
  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return timestampToCode(this, ctx, key);
  }
}

// timestamp [ (p) ] with time zone	8 bytes	both date and time, with time zone	4713 BC	294276 AD	1 microsecond
export class TimestampTZColumn<
  Schema extends ColumnSchemaConfig,
> extends DateTimeTzBaseClass<Schema> {
  dataType = 'timestamptz' as const;
  baseDataType = 'timestamp' as const;
  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return timestampToCode(this, ctx, key);
  }
}

// time [ (p) ] [ without time zone ]	8 bytes	time of day (no date)	00:00:00	24:00:00	1 microsecond
export class TimeColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  declare __type: string;
  declare __inputType: ReturnType<Schema['stringSchema']>;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare data: DateColumnData & { dateTimePrecision?: number };
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  dataType = 'time' as const;
  operators = Operators.time;

  constructor(schema: Schema, dateTimePrecision?: number) {
    super(schema, schema.stringSchema() as never);
    this.data.dateTimePrecision = dateTimePrecision;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    const { dateTimePrecision } = this.data;
    return columnCode(
      this,
      ctx,
      key,
      `time(${dateTimePrecision || ''})${dateDataToCode(
        this.data,
        ctx.migration,
      )}`,
    );
  }
}

const addIntervalPart = (
  parts: string[],
  value: number | undefined,
  unit: string,
) => {
  if (value) {
    parts.push(`${value} ${unit}`);
  }
};

const serializePostgresInterval = (
  input: Partial<PostgresInterval>,
): string => {
  const parts: string[] = [];

  addIntervalPart(parts, input.years, 'years');
  addIntervalPart(parts, input.months, 'months');
  addIntervalPart(parts, input.days, 'days');
  addIntervalPart(parts, input.hours, 'hours');
  addIntervalPart(parts, input.minutes, 'minutes');
  addIntervalPart(parts, input.seconds, 'seconds');
  addIntervalPart(parts, input.milliseconds, 'milliseconds');

  return parts.length ? parts.join(' ') : '0 seconds';
};

// interval [ fields ] [ (p) ]	16 bytes	time interval	-178000000 years	178000000 years	1 microsecond
export class IntervalColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  declare __type: PostgresInterval;
  declare data: Column.Data & { fields?: string; precision?: number };
  declare __inputType: Partial<PostgresInterval>;
  declare inputSchema: ReturnType<Schema['timeInterval']>;
  declare __outputType: PostgresInterval;
  declare outputSchema: ReturnType<Schema['timeInterval']>;
  declare __queryType: PostgresInterval;
  declare querySchema: ReturnType<Schema['timeInterval']>;
  dataType = 'interval' as const;
  operators = Operators.date;

  constructor(
    schema: Schema,
    fields?: string,
    precision?: number,
    parse?: (input: string) => PostgresInterval,
  ) {
    super(schema, schema.timeInterval() as never);
    this.data.fields = fields;
    this.data.precision = precision;
    if (parse) {
      setColumnDefaultParse(this, parse);
    }
    this.data.encode = serializePostgresInterval;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    const { fields, precision } = this.data;
    return columnCode(
      this,
      ctx,
      key,
      `interval(${[fields && `'${fields}'`, precision && String(precision)]
        .filter((part) => part)
        .join(', ')})`,
    );
  }

  toSQL() {
    return joinTruthy(
      this.dataType,
      this.data.fields && ` ${this.data.fields}`,
      this.data.precision !== undefined && ` (${this.data.precision})`,
    );
  }
}
