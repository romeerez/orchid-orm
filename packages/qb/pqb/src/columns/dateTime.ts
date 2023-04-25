import { ColumnData, ColumnType } from './columnType';
import { Operators } from './operators';
import {
  dateTypeMethods,
  Code,
  joinTruthy,
  DateColumnData,
  dateDataToCode,
  EncodeColumn,
  ParseColumn,
} from 'orchid-core';
import { assignMethodsToClass } from './utils';
import { IntegerColumn } from './number';
import { columnCode } from './code';

type DateMethods = typeof dateTypeMethods;

export interface DateBaseColumn
  extends ColumnType<string, typeof Operators.date, string | number | Date>,
    DateMethods {}

const dateTimeEncode = (input: string | number | Date) => {
  return typeof input === 'object' ? input : new Date(input);
};

const skip = { encodeFn: dateTimeEncode };

export abstract class DateBaseColumn extends ColumnType<
  string,
  typeof Operators.date,
  string | number | Date
> {
  declare data: DateColumnData;
  operators = Operators.date;
  encodeFn = dateTimeEncode;

  asNumber() {
    return this.parse(Date.parse).as(
      new IntegerColumn() as never,
    ) as unknown as EncodeColumn<IntegerColumn, string | number | Date>;
  }

  asDate<T extends ColumnType>(this: T): ParseColumn<T, Date> {
    return this.parse((input) => new Date(input as string));
  }
}

assignMethodsToClass(DateBaseColumn, dateTypeMethods);

// date	4 bytes	date (no time of day)	4713 BC	5874897 AD 1 day
export class DateColumn extends DateBaseColumn {
  dataType = 'date' as const;
  toCode(t: string): Code {
    return columnCode(
      this,
      t,
      `date()${dateDataToCode(this.data)}`,
      this.data,
      skip,
    );
  }
}

export abstract class DateTimeBaseClass<
  Precision extends number | undefined = undefined,
> extends DateBaseColumn {
  declare data: DateColumnData & { dateTimePrecision: Precision };

  constructor(dateTimePrecision?: Precision) {
    super();
    this.data.dateTimePrecision = dateTimePrecision as Precision;
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
  Precision extends number | undefined = undefined,
> extends DateTimeBaseClass<Precision> {
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

const timestampToCode = <P extends number>(
  self: TimestampColumn<P> | TimestampTzColumn<P>,
  t: string,
) => {
  const { dateTimePrecision: p } = self.data;
  return columnCode(
    self,
    t,
    `${
      self instanceof TimestampColumn ? 'timestampWithoutTimeZone' : 'timestamp'
    }(${p && p !== 6 ? p : ''})${dateDataToCode(self.data)}`,
    self.data,
    skip,
  );
};

// timestamp [ (p) ] [ without time zone ]	8 bytes	both date and time (no time zone)	4713 BC	294276 AD	1 microsecond
export class TimestampColumn<
  Precision extends number,
> extends DateTimeBaseClass<Precision> {
  dataType = 'timestamp' as const;
  toCode(t: string): Code {
    return timestampToCode(this, t);
  }
}

// timestamp [ (p) ] with time zone	8 bytes	both date and time, with time zone	4713 BC	294276 AD	1 microsecond
export class TimestampTzColumn<
  Precision extends number,
> extends DateTimeTzBaseClass<Precision> {
  dataType = 'timestamptz' as const;
  baseDataType = 'timestamp' as const;
  toCode(t: string): Code {
    return timestampToCode(this, t);
  }
}

// time [ (p) ] [ without time zone ]	8 bytes	time of day (no date)	00:00:00	24:00:00	1 microsecond
export class TimeColumn<
  Precision extends number | undefined = undefined,
> extends DateTimeBaseClass<Precision> {
  dataType = 'time' as const;
  toCode(t: string): Code {
    const { dateTimePrecision } = this.data;
    return columnCode(
      this,
      t,
      `time(${dateTimePrecision || ''})${dateDataToCode(this.data)}`,
      this.data,
      skip,
    );
  }
}

export type TimeInterval = {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};

// interval [ fields ] [ (p) ]	16 bytes	time interval	-178000000 years	178000000 years	1 microsecond
export class IntervalColumn<
  Fields extends string | undefined = undefined,
  Precision extends number | undefined = undefined,
> extends ColumnType<TimeInterval, typeof Operators.date> {
  dataType = 'interval' as const;
  declare data: ColumnData & { fields: Fields; precision: Precision };
  operators = Operators.date;

  constructor(fields?: Fields, precision?: Precision) {
    super();
    this.data.fields = fields as Fields;
    this.data.precision = precision as Precision;
  }

  toCode(t: string): Code {
    const { fields, precision } = this.data;
    return columnCode(
      this,
      t,
      `interval(${[fields && `'${fields}'`, precision && String(precision)]
        .filter((part) => part)
        .join(', ')})`,
      this.data,
      skip,
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
