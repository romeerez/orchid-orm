import { ColumnData, ColumnType } from './columnType';
import {
  Code,
  Expression,
  joinTruthy,
  BaseNumberData,
  numberDataToCode,
  setColumnData,
  addCode,
  ColumnWithDefault,
  ColumnSchemaConfig,
  PickColumnBaseData,
} from 'orchid-core';
import { columnCode, identityToCode } from './code';
import type { TableData } from './columnTypes';
import { Operators, OperatorsNumber } from './operators';

export interface NumberColumnData extends BaseNumberData {
  identity: TableData.Identity;
}

export interface SerialColumnData extends NumberColumnData {
  default: Expression;
}

export abstract class NumberBaseColumn<
  Schema extends ColumnSchemaConfig,
  SchemaType extends Schema['type'],
> extends ColumnType<Schema, number, SchemaType, OperatorsNumber> {
  declare data: NumberColumnData;
  operators = Operators.number;
}

export abstract class IntegerBaseColumn<
  Schema extends ColumnSchemaConfig,
> extends NumberBaseColumn<Schema, ReturnType<Schema['int']>> {
  declare data: NumberColumnData;
  constructor(schema: Schema) {
    super(schema, schema.int() as never);
    this.data.int = true;
  }
}

export abstract class NumberAsStringBaseColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsNumber
> {
  operators = Operators.number;
  declare data: ColumnData;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }
}

export interface DecimalColumnData extends ColumnData {
  numericPrecision?: number;
  numericScale?: number;
}

// exact numeric of selectable precision
export class DecimalColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsNumber
> {
  declare data: DecimalColumnData;
  operators = Operators.number;
  dataType = 'numeric' as const;

  constructor(
    schema: Schema,
    numericPrecision?: number,
    numericScale?: number,
  ) {
    super(schema, schema.stringSchema() as never);
    this.data.numericPrecision = numericPrecision;
    this.data.numericScale = numericScale;
    this.data.alias = 'decimal';
  }

  toCode(t: string, m?: boolean): Code {
    const { numericPrecision, numericScale } = this.data;
    return columnCode(
      this,
      t,
      `decimal(${numericPrecision || ''}${
        numericScale ? `, ${numericScale}` : ''
      })`,
      m,
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

const intToCode = (
  column: ColumnType,
  t: string,
  alias: string,
  m: boolean | undefined,
): Code => {
  let code: Code[];

  if (column.data.identity) {
    code = identityToCode(column.data.identity, alias);
  } else {
    code = [`${alias}()`];
  }

  addCode(code, numberDataToCode(column.data, m, skipNumberMethods));

  return columnCode(column, t, code, m);
};

export type IdentityColumn<T extends PickColumnBaseData> = ColumnWithDefault<
  T,
  Expression
>;

// signed two-byte integer
export class SmallIntColumn<
  Schema extends ColumnSchemaConfig,
> extends IntegerBaseColumn<Schema> {
  dataType = 'int2' as const;

  constructor(schema: Schema) {
    super(schema);
    this.data.alias = 'smallint';
  }

  parseItem = parseInt;
  toCode(t: string, m?: boolean): Code {
    return intToCode(this, t, 'smallint', m);
  }

  identity<T extends ColumnType>(
    this: T,
    options: TableData.Identity = {},
  ): IdentityColumn<T> {
    return setColumnData(this, 'identity', options) as IdentityColumn<T>;
  }
}

// signed four-byte integer
export class IntegerColumn<
  Schema extends ColumnSchemaConfig,
> extends IntegerBaseColumn<Schema> {
  dataType = 'int4' as const;

  constructor(schema: Schema) {
    super(schema);
    this.data.alias = 'integer';
  }

  parseItem = parseInt;
  toCode(t: string, m?: boolean): Code {
    return intToCode(this, t, 'integer', m);
  }

  identity<T extends ColumnType>(
    this: T,
    options: TableData.Identity = {},
  ): IdentityColumn<T> {
    return setColumnData(this, 'identity', options) as IdentityColumn<T>;
  }
}

// signed eight-byte integer
export class BigIntColumn<
  Schema extends ColumnSchemaConfig,
> extends NumberAsStringBaseColumn<Schema> {
  dataType = 'int8' as const;

  constructor(schema: Schema) {
    super(schema);
    this.data.alias = 'bigint';
  }

  toCode(t: string, m?: boolean): Code {
    return intToCode(this, t, 'bigint', m);
  }

  identity<T extends ColumnType>(
    this: T,
    options: TableData.Identity = {},
  ): IdentityColumn<T> {
    return setColumnData(this, 'identity', options) as IdentityColumn<T>;
  }
}

// single precision floating-point number (4 bytes)
export class RealColumn<
  Schema extends ColumnSchemaConfig,
> extends NumberBaseColumn<Schema, ReturnType<Schema['number']>> {
  dataType = 'float4' as const;
  parseItem = parseFloat;

  constructor(schema: Schema) {
    super(schema, schema.number() as never);
    this.data.alias = 'real';
  }

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `real()${numberDataToCode(this.data, m)}`, m);
  }
}

// double precision floating-point number (8 bytes)
export class DoublePrecisionColumn<
  Schema extends ColumnSchemaConfig,
> extends NumberAsStringBaseColumn<Schema> {
  dataType = 'float8' as const;

  constructor(schema: Schema) {
    super(schema);
    this.data.alias = 'doublePrecision';
  }

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `doublePrecision()`, m);
  }
}

// autoincrementing two-byte integer
export class SmallSerialColumn<
  Schema extends ColumnSchemaConfig,
> extends IntegerBaseColumn<Schema> {
  dataType = 'int2' as const;
  parseItem = parseInt;
  declare data: SerialColumnData;

  constructor(schema: Schema) {
    super(schema);
    this.data.int = true;
    this.data.alias = 'smallSerial';
  }

  toSQL() {
    return 'smallserial';
  }

  toCode(t: string, m?: boolean): Code {
    return columnCode(
      this,
      t,
      `smallSerial()${numberDataToCode(this.data, m, skipNumberMethods)}`,
      m,
    );
  }
}

// autoincrementing four-byte integer
export class SerialColumn<
  Schema extends ColumnSchemaConfig,
> extends IntegerBaseColumn<Schema> {
  dataType = 'int4' as const;
  parseItem = parseInt;
  declare data: SerialColumnData;

  constructor(schema: Schema) {
    super(schema);
    this.data.int = true;
    this.data.alias = 'serial';
  }

  toSQL() {
    return 'serial';
  }

  toCode(t: string, m?: boolean): Code {
    return columnCode(
      this,
      t,
      `serial()${numberDataToCode(this.data, m, skipNumberMethods)}`,
      m,
    );
  }
}

// autoincrementing eight-byte integer
export class BigSerialColumn<
  Schema extends ColumnSchemaConfig,
> extends NumberAsStringBaseColumn<Schema> {
  dataType = 'int8' as const;
  declare data: SerialColumnData;

  constructor(schema: Schema) {
    super(schema);
    this.data.alias = 'bigint';
  }

  toSQL() {
    return 'bigserial';
  }

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `bigSerial()`, m);
  }
}
