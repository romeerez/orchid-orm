import { ColumnData, ColumnType } from './columnType';
import { Operators } from './operators';
import {
  dateTypeMethods,
  Code,
  joinTruthy,
  DateColumnData,
  nameKey,
  ColumnTypesBase,
} from 'orchid-core';
import { assignMethodsToClass } from './utils';
import { IntegerColumn } from './number';
import { columnCode } from './code';

type DateMethods = typeof dateTypeMethods;

export interface DateBaseColumn
  extends ColumnType<string, typeof Operators.date, string | Date>,
    DateMethods {}

export abstract class DateBaseColumn extends ColumnType<
  string,
  typeof Operators.date,
  string | Date
> {
  declare data: DateColumnData;
  operators = Operators.date;

  asNumber() {
    return this.encode((input: number) => new Date(input))
      .parse(Date.parse)
      .as(
        new IntegerColumn({ [nameKey]: this.data.name }) as never,
      ) as unknown as IntegerColumn;
  }

  asDate<T extends ColumnType>(this: T) {
    return this.parse((input) => new Date(input as string));
  }
}

assignMethodsToClass(DateBaseColumn, dateTypeMethods);

const dateDataToCode = (data: DateColumnData) => {
  let code = '';

  if (data.min) code += `.min(new Date('${data.min.toISOString()}'))`;
  if (data.max) code += `.max(new Date('${data.max.toISOString()}'))`;

  return code;
};

// date	4 bytes	date (no time of day)	4713 BC	5874897 AD 1 day
export class DateColumn extends DateBaseColumn {
  dataType = 'date' as const;
  toCode(t: string): Code {
    return columnCode(this, t, `date()${dateDataToCode(this.data)}`);
  }
}

export abstract class DateTimeBaseClass<
  Precision extends number | undefined = undefined,
> extends DateBaseColumn {
  declare data: DateColumnData & { dateTimePrecision: Precision };

  constructor(types: ColumnTypesBase, dateTimePrecision?: Precision) {
    super(types);
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

export abstract class DateTimeWithTimeZoneBaseClass<
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
  self: TimestampColumn<P> | TimestampWithTimeZoneColumn<P>,
  t: string,
) => {
  const { dateTimePrecision: p } = self.data;
  return columnCode(
    self,
    t,
    `${
      self instanceof TimestampColumn ? 'timestamp' : 'timestampWithTimeZone'
    }(${p && p !== 6 ? p : ''})${dateDataToCode(self.data)}`,
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
export class TimestampWithTimeZoneColumn<
  Precision extends number,
> extends DateTimeWithTimeZoneBaseClass<Precision> {
  dataType = 'timestamp with time zone' as const;
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
    );
  }
}

// time [ (p) ] with time zone	12 bytes	time of day (no date), with time zone	00:00:00+1559	24:00:00-1559	1 microsecond
export class TimeWithTimeZoneColumn<
  Precision extends number | undefined = undefined,
> extends DateTimeWithTimeZoneBaseClass<Precision> {
  dataType = 'time with time zone' as const;
  baseDataType = 'time' as const;
  toCode(t: string): Code {
    const { dateTimePrecision } = this.data;
    return columnCode(
      this,
      t,
      `timeWithTimeZone(${dateTimePrecision || ''})${dateDataToCode(
        this.data,
      )}`,
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

  constructor(types: ColumnTypesBase, fields?: Fields, precision?: Precision) {
    super(types);
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
