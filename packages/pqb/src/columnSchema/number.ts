import { Operators } from '../columnsOperators';
import { ColumnData, ColumnType } from './columnType';
import { joinTruthy } from '../utils';
import { assignMethodsToClass } from './utils';
import { numberTypeMethods } from './commonMethods';

export type BaseNumberData = ColumnData & {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  multipleOf?: number;
  int?: boolean;
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

export type DecimalColumnData = ColumnData & {
  precision?: number;
  scale?: number;
};

export class DecimalBaseColumn<
  Precision extends number | undefined = undefined,
  Scale extends number | undefined = undefined,
> extends ColumnType<string, typeof Operators.number> {
  data: DecimalColumnData & { precision: Precision; scale: Scale };
  operators = Operators.number;
  dataType = 'decimal' as const;

  constructor(precision?: Precision, scale?: Scale) {
    super();

    this.data = {
      precision,
      scale,
    } as DecimalColumnData & { precision: Precision; scale: Scale };
  }

  toSQL() {
    const { precision, scale } = this.data;

    return joinTruthy(
      this.dataType,
      precision
        ? scale
          ? `(${precision}, ${scale})`
          : `(${precision})`
        : undefined,
    );
  }
}

// signed two-byte integer
export class SmallIntColumn extends IntegerBaseColumn {
  dataType = 'smallint' as const;
  parseItem = parseInt;
}

// signed four-byte integer
export class IntegerColumn extends IntegerBaseColumn {
  dataType = 'integer' as const;
  parseItem = parseInt;
}

// signed eight-byte integer
export class BigIntColumn extends NumberAsStringBaseColumn {
  dataType = 'bigint' as const;
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
}

// double precision floating-point number (8 bytes)
export class DoublePrecisionColumn extends NumberAsStringBaseColumn {
  dataType = 'double precision' as const;
}

// autoincrementing two-byte integer
export class SmallSerialColumn extends IntegerBaseColumn {
  dataType = 'smallserial' as const;
  parseItem = parseInt;
  hasDefault = true as const;
}

// autoincrementing four-byte integer
export class SerialColumn extends IntegerBaseColumn {
  dataType = 'serial' as const;
  parseItem = parseInt;
  hasDefault = true as const;
}

// autoincrementing eight-byte integer
export class BigSerialColumn extends NumberAsStringBaseColumn {
  dataType = 'bigserial' as const;
  hasDefault = true as const;
}
