import { ColumnData, ColumnType } from './columnType';
import {
  numberTypeMethods,
  Code,
  Expression,
  joinTruthy,
  BaseNumberData,
  numberDataToCode,
  setColumnData,
  addCode,
  ColumnWithDefault,
  ColumnTypeBase,
  NumberTypeMethods,
  assignMethodsToClass,
} from 'orchid-core';
import { columnCode, identityToCode } from './code';
import type { TableData } from './columnTypes';
import { Operators } from './operators';

export type NumberColumn = ColumnType<number, typeof Operators.number>;

export type NumberColumnData = BaseNumberData & {
  identity: TableData.Identity;
};

export type SerialColumnData = NumberColumnData & {
  default: Expression;
};

export interface NumberBaseColumn
  extends ColumnType<number, typeof Operators.number>,
    NumberTypeMethods {}

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
  constructor() {
    super();
    this.data.int = true;
  }
}

export abstract class NumberAsStringBaseColumn extends ColumnType<
  string,
  typeof Operators.number
> {
  operators = Operators.number;
  declare data: ColumnData;
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

  constructor(numericPrecision?: Precision, numericScale?: Scale) {
    super();
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

const skipNumberMethods = { int: true } as const;

const intToCode = (column: ColumnType, t: string): Code => {
  let code: Code[];

  if (column.data.identity) {
    code = identityToCode(column.data.identity, column.dataType);
  } else {
    code = [`${column.dataType}()`];
  }

  addCode(code, numberDataToCode(column.data, skipNumberMethods));

  return columnCode(column, t, code);
};

export type IdentityColumn<T extends ColumnTypeBase> = ColumnWithDefault<
  T,
  Expression
>;

// signed two-byte integer
export class SmallIntColumn extends IntegerBaseColumn {
  dataType = 'smallint' as const;
  parseItem = parseInt;
  toCode(t: string): Code {
    return intToCode(this, t);
  }

  identity<T extends ColumnType>(
    this: T,
    options: TableData.Identity = {},
  ): IdentityColumn<T> {
    return setColumnData(this, 'identity', options) as IdentityColumn<T>;
  }
}

// signed four-byte integer
export class IntegerColumn extends IntegerBaseColumn {
  dataType = 'integer' as const;
  parseItem = parseInt;
  toCode(t: string): Code {
    return intToCode(this, t);
  }

  identity<T extends ColumnType>(
    this: T,
    options: TableData.Identity = {},
  ): IdentityColumn<T> {
    return setColumnData(this, 'identity', options) as IdentityColumn<T>;
  }
}

// signed eight-byte integer
export class BigIntColumn extends NumberAsStringBaseColumn {
  dataType = 'bigint' as const;
  toCode(t: string): Code {
    return intToCode(this, t);
  }

  identity<T extends ColumnType>(
    this: T,
    options: TableData.Identity = {},
  ): IdentityColumn<T> {
    return setColumnData(this, 'identity', options) as IdentityColumn<T>;
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

  constructor() {
    super();
    this.data.int = true;
  }

  toSQL() {
    return 'smallserial';
  }

  toCode(t: string): Code {
    return columnCode(
      this,
      t,
      `smallSerial()${numberDataToCode(this.data, skipNumberMethods)}`,
    );
  }
}

// autoincrementing four-byte integer
export class SerialColumn extends IntegerBaseColumn {
  dataType = 'integer' as const;
  parseItem = parseInt;
  declare data: SerialColumnData;

  constructor() {
    super();
    this.data.int = true;
  }

  toSQL() {
    return 'serial';
  }

  toCode(t: string): Code {
    return columnCode(
      this,
      t,
      `serial()${numberDataToCode(this.data, skipNumberMethods)}`,
    );
  }
}

// autoincrementing eight-byte integer
export class BigSerialColumn extends NumberAsStringBaseColumn {
  dataType = 'bigint' as const;
  declare data: SerialColumnData;

  toSQL() {
    return 'bigserial';
  }

  toCode(t: string): Code {
    return columnCode(this, t, `bigSerial()`);
  }
}
