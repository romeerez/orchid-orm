import { Operators } from '../operators';
import { ColumnType } from './base';
import { joinTruthy } from '../utils';
import { assignMethodsToClass } from './utils';
import { numberTypeMethods } from './commonMethods';

export interface BaseNumberData {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  multipleOf?: number;
}

export type NumberColumnData = BaseNumberData;

type NumberMethods = typeof numberMethods;
const numberMethods = numberTypeMethods<ColumnType>();

export interface NumberBaseColumn<Type>
  extends ColumnType<Type, typeof Operators.number>,
    NumberMethods {}

export abstract class NumberBaseColumn<Type> extends ColumnType<
  Type,
  typeof Operators.number
> {
  data = {} as NumberColumnData;
}

assignMethodsToClass(NumberBaseColumn, numberMethods);

export interface DecimalColumnData extends NumberColumnData {
  precision?: number;
  scale?: number;
}

export class DecimalBaseColumn<
  Type extends number | bigint,
  Precision extends number | undefined = undefined,
  Scale extends number | undefined = undefined,
> extends NumberBaseColumn<Type> {
  data: DecimalColumnData & { precision: Precision; scale: Scale };
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
export class SmallIntColumn extends NumberBaseColumn<number> {
  dataType = 'smallint' as const;
}

// signed four-byte integer
export class IntegerColumn extends NumberBaseColumn<number> {
  dataType = 'integer' as const;
}

// signed eight-byte integer
export class BigIntColumn extends NumberBaseColumn<bigint> {
  dataType = 'bigint' as const;
}

// exact numeric of selectable precision
export class DecimalColumn<
  Precision extends number | undefined = undefined,
  Scale extends number | undefined = undefined,
> extends DecimalBaseColumn<number, Precision, Scale> {}

// exact numeric of selectable precision, bigint JS type
export class DecimalBigIntColumn<
  Precision extends number | undefined = undefined,
  Scale extends number | undefined = undefined,
> extends DecimalBaseColumn<bigint, Precision, Scale> {}

// single precision floating-point number (4 bytes)
export class RealColumn extends NumberBaseColumn<number> {
  dataType = 'real' as const;
}

// double precision floating-point number (8 bytes)
export class DoublePrecisionColumn extends NumberBaseColumn<bigint> {
  dataType = 'double precision' as const;
}

// autoincrementing two-byte integer
export class SmallSerialColumn extends NumberBaseColumn<number> {
  dataType = 'smallserial' as const;
}

// autoincrementing four-byte integer
export class SerialColumn extends NumberBaseColumn<number> {
  dataType = 'serial' as const;
}

// autoincrementing eight-byte integer
export class BigSerialColumn extends NumberBaseColumn<bigint> {
  dataType = 'bigserial' as const;
}
