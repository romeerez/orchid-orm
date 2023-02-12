import { Operators } from './operators';
import { ColumnData, ColumnType } from './columnType';
import { joinTruthy } from '../utils';
import { assignMethodsToClass } from './utils';
import { numberTypeMethods } from './commonMethods';
import { columnCode } from './code';
import { Code } from '../../../common/src/columns/code';

export type BaseNumberData = ColumnData & {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  multipleOf?: number;
  int?: boolean;
};

const numberDataToCode = (data: NumberBaseColumn['data']) => {
  let code = '';
  if (data.gte !== undefined) code += `.min(${data.gte})`;
  if (data.gt !== undefined) code += `.gt(${data.gt})`;
  if (data.lte !== undefined) code += `.max(${data.lte})`;
  if (data.lt !== undefined) code += `.lt(${data.lt})`;
  if (data.multipleOf !== undefined) code += `.step(${data.multipleOf})`;
  return code;
};

export type NumberColumn = ColumnType<number>;

export type NumberColumnData = BaseNumberData;

type NumberMethods = typeof numberTypeMethods;

export interface NumberBaseColumn
  extends ColumnType<number, typeof Operators.number>,
    NumberMethods {}

export abstract class NumberBaseColumn extends ColumnType<
  number,
  typeof Operators.number
> {
  data = {} as NumberColumnData;
  operators = Operators.number;
}

assignMethodsToClass(NumberBaseColumn, numberTypeMethods);

export abstract class IntegerBaseColumn extends NumberBaseColumn {
  data = { int: true } as NumberColumnData;
}

export abstract class NumberAsStringBaseColumn extends ColumnType<
  string,
  typeof Operators.number
> {
  data = {};
  operators = Operators.number;
}

export class DecimalBaseColumn<
  Precision extends number | undefined = undefined,
  Scale extends number | undefined = undefined,
> extends ColumnType<string, typeof Operators.number> {
  data: ColumnData & { numericPrecision: Precision; numericScale: Scale };
  operators = Operators.number;
  dataType = 'decimal' as const;

  constructor(numericPrecision?: Precision, numericScale?: Scale) {
    super();

    this.data = {
      numericPrecision,
      numericScale,
    } as { numericPrecision: Precision; numericScale: Scale };
  }

  toCode(t: string): Code {
    const { numericPrecision, numericScale } = this.data;
    return columnCode(
      this,
      t,
      `${t}.decimal(${numericPrecision || ''}${
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
    return columnCode(this, t, `${t}.smallint()${numberDataToCode(this.data)}`);
  }
}

// signed four-byte integer
export class IntegerColumn extends IntegerBaseColumn {
  dataType = 'integer' as const;
  parseItem = parseInt;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.integer()${numberDataToCode(this.data)}`);
  }
}

// signed eight-byte integer
export class BigIntColumn extends NumberAsStringBaseColumn {
  dataType = 'bigint' as const;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.bigint()`);
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
    return columnCode(this, t, `${t}.real()${numberDataToCode(this.data)}`);
  }
}

// double precision floating-point number (8 bytes)
export class DoublePrecisionColumn extends NumberAsStringBaseColumn {
  dataType = 'double precision' as const;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.doublePrecision()`);
  }
}

// autoincrementing two-byte integer
export class SmallSerialColumn extends IntegerBaseColumn {
  dataType = 'smallserial' as const;
  parseItem = parseInt;
  hasDefault = true as const;
  toCode(t: string): Code {
    return columnCode(
      this,
      t,
      `${t}.smallSerial()${numberDataToCode(this.data)}`,
    );
  }
}

// autoincrementing four-byte integer
export class SerialColumn extends IntegerBaseColumn {
  dataType = 'serial' as const;
  parseItem = parseInt;
  hasDefault = true as const;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.serial()${numberDataToCode(this.data)}`);
  }
}

// autoincrementing eight-byte integer
export class BigSerialColumn extends NumberAsStringBaseColumn {
  dataType = 'bigserial' as const;
  hasDefault = true as const;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.bigSerial()`);
  }
}
