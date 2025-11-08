import { ColumnData, ColumnType } from './columnType';
import {
  Code,
  ColumnSchemaConfig,
  ColumnToCodeCtx,
  DateColumnData,
  dateDataToCode,
  joinTruthy,
  TimeInterval,
} from 'orchid-core';
import { columnCode } from './code';
import { Operators, OperatorsDate, OperatorsTime } from './operators';

export type DateColumnInput = string | number | Date;

// encode string, number, or Date to a Date object,
const dateTimeEncode = (input: DateColumnInput) => {
  return typeof input === 'number' ? new Date(input) : input;
};

// common class for Date and DateTime columns
export abstract class DateBaseColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringNumberDate']>,
  OperatorsDate,
  DateColumnInput,
  string,
  ReturnType<Schema['stringSchema']>
> {
  declare data: DateColumnData;
  operators = Operators.date;
  asNumber: Schema['dateAsNumber'];
  asDate: Schema['dateAsDate'];

  constructor(schema: Schema) {
    super(
      schema,
      schema.stringNumberDate() as never,
      schema.stringSchema() as never,
      schema.stringNumberDate() as never,
    );
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

  constructor(schema: Schema, dateTimePrecision?: number) {
    super(schema);
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
  if (defaultTimestamp) {
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
export class TimeColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsTime
> {
  declare data: DateColumnData & { dateTimePrecision?: number };
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

// interval [ fields ] [ (p) ]	16 bytes	time interval	-178000000 years	178000000 years	1 microsecond
export class IntervalColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  TimeInterval,
  ReturnType<Schema['timeInterval']>,
  OperatorsDate
> {
  declare data: ColumnData & { fields?: string; precision?: number };
  dataType = 'interval' as const;
  operators = Operators.date;

  constructor(schema: Schema, fields?: string, precision?: number) {
    super(schema, schema.timeInterval() as never);
    this.data.fields = fields;
    this.data.precision = precision;
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
