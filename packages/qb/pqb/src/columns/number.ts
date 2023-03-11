import { Operators } from './operators';
import { ColumnData, ColumnType } from './columnType';
import { assignMethodsToClass } from './utils';
import {
  numberTypeMethods,
  Code,
  RawExpression,
  joinTruthy,
  BaseNumberData,
  ColumnTypesBase,
} from 'orchid-core';
import { columnCode } from './code';

const numberDataToCode = (data: NumberBaseColumn['data']) => {
  let code = '';
  if (data.gte !== undefined) code += `.min(${data.gte})`;
  if (data.gt !== undefined) code += `.gt(${data.gt})`;
  if (data.lte !== undefined) code += `.max(${data.lte})`;
  if (data.lt !== undefined) code += `.lt(${data.lt})`;
  if (data.multipleOf !== undefined) code += `.step(${data.multipleOf})`;
  return code;
};

export type NumberColumn = ColumnType<number, typeof Operators.number>;

export type NumberColumnData = BaseNumberData;

export type SerialColumnData = NumberColumnData & {
  default: RawExpression;
};

type NumberMethods = typeof numberTypeMethods;

export interface NumberBaseColumn
  extends ColumnType<number, typeof Operators.number>,
    NumberMethods {}

export abstract class NumberBaseColumn extends ColumnType<
  number,
  typeof Operators.number
> {
  declare data: NumberColumnData;
  operators = Operators.number;
}

assignMethodsToClass(NumberBaseColumn, numberTypeMethods);

export abstract class IntegerBaseColumn extends NumberBaseColumn {
  declare data: NumberColumnData;
  constructor(types: ColumnTypesBase) {
    super(types);
    this.data.int = true;
  }
}

export abstract class NumberAsStringBaseColumn extends ColumnType<
  string,
  typeof Operators.number
> {
  operators = Operators.number;
}

export class DecimalBaseColumn<
  Precision extends number | undefined = undefined,
  Scale extends number | undefined = undefined,
> extends ColumnType<string, typeof Operators.number> {
  declare data: ColumnData & {
    numericPrecision: Precision;
    numericScale: Scale;
  };
  operators = Operators.number;
  dataType = 'decimal' as const;

  constructor(
    types: ColumnTypesBase,
    numericPrecision?: Precision,
    numericScale?: Scale,
  ) {
    super(types);
    this.data.numericPrecision = numericPrecision as Precision;
    this.data.numericScale = numericScale as Scale;
  }

  toCode(t: string): Code {
    const { numericPrecision, numericScale } = this.data;
    return columnCode(
      this,
      t,
      `decimal(${numericPrecision || ''}${
        numericScale ? `, ${numericScale}` : ''
      })`,
    );
  }

  toSQL() {
    const { numericPrecision, numericScale } = this.data;

    return joinTruthy(
      this.dataType,
      numericPrecision
        ? numericScale
          ? `(${numericPrecision}, ${numericScale})`
          : `(${numericPrecision})`
        : undefined,
    );
  }
}

// signed two-byte integer
export class SmallIntColumn extends IntegerBaseColumn {
  dataType = 'smallint' as const;
  parseItem = parseInt;
  toCode(t: string): Code {
    return columnCode(this, t, `smallint()${numberDataToCode(this.data)}`);
  }
}

// signed four-byte integer
export class IntegerColumn extends IntegerBaseColumn {
  dataType = 'integer' as const;
  parseItem = parseInt;
  toCode(t: string): Code {
    return columnCode(this, t, `integer()${numberDataToCode(this.data)}`);
  }
}

// signed eight-byte integer
export class BigIntColumn extends NumberAsStringBaseColumn {
  dataType = 'bigint' as const;
  toCode(t: string): Code {
    return columnCode(this, t, `bigint()`);
  }
}

// exact numeric of selectable precision
export class DecimalColumn<
  Precision extends number | undefined = undefined,
  Scale extends number | undefined = undefined,
> extends DecimalBaseColumn<Precision, Scale> {}

// single precision floating-point number (4 bytes)
export class RealColumn extends NumberBaseColumn {
  dataType = 'real' as const;
  parseItem = parseFloat;
  toCode(t: string): Code {
    return columnCode(this, t, `real()${numberDataToCode(this.data)}`);
  }
}

// double precision floating-point number (8 bytes)
export class DoublePrecisionColumn extends NumberAsStringBaseColumn {
  dataType = 'double precision' as const;
  toCode(t: string): Code {
    return columnCode(this, t, `doublePrecision()`);
  }
}

// autoincrementing two-byte integer
export class SmallSerialColumn extends IntegerBaseColumn {
  dataType = 'smallint' as const;
  parseItem = parseInt;
  declare data: SerialColumnData;

  constructor(types: ColumnTypesBase) {
    super(types);
    this.data.int = true;
  }

  toSQL() {
    return 'smallserial';
  }

  toCode(t: string): Code {
    return columnCode(this, t, `smallSerial()${numberDataToCode(this.data)}`);
  }
}

// autoincrementing four-byte integer
export class SerialColumn extends IntegerBaseColumn {
  dataType = 'integer' as const;
  parseItem = parseInt;
  declare data: SerialColumnData;

  constructor(types: ColumnTypesBase) {
    super(types);
    this.data.int = true;
  }

  toSQL() {
    return 'serial';
  }

  toCode(t: string): Code {
    return columnCode(this, t, `serial()${numberDataToCode(this.data)}`);
  }
}

// autoincrementing eight-byte integer
export class BigSerialColumn extends NumberAsStringBaseColumn {
  dataType = 'bigint' as const;
  declare data: SerialColumnData;

  toSql() {
    return 'bigserial';
  }

  toCode(t: string): Code {
    return columnCode(this, t, `bigSerial()`);
  }
}
