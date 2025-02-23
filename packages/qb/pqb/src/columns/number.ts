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
  Codes,
  ColumnToCodeCtx,
} from 'orchid-core';
import { columnCode, identityToCode } from './code';
import { Operators, OperatorsNumber } from './operators';
import { TableData } from '../tableData';

export interface NumberColumnData extends BaseNumberData, ColumnData {
  identity?: TableData.Identity;
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
  InputType = string | number,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsNumber,
  InputType
> {
  operators = Operators.number;
  declare data: ColumnData;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
    this.data.jsonCast = 'text';
  }
}

export interface DecimalColumnData extends ColumnData {
  numericPrecision?: number;
  numericScale?: number;
}

// exact numeric of selectable precision
export class DecimalColumn<
  Schema extends ColumnSchemaConfig,
> extends NumberAsStringBaseColumn<Schema> {
  declare data: DecimalColumnData;
  operators = Operators.number;
  dataType = 'numeric' as const;

  constructor(
    schema: Schema,
    numericPrecision?: number,
    numericScale?: number,
  ) {
    super(schema);
    this.data.numericPrecision = numericPrecision;
    this.data.numericScale = numericScale;
    this.data.alias = 'decimal';
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    const { numericPrecision, numericScale } = this.data;
    return columnCode(
      this,
      ctx,
      key,
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

const intToCode = (
  column: ColumnType,
  ctx: ColumnToCodeCtx,
  key: string,
  alias: string,
): Code => {
  let code: Codes;

  if (column.data.identity) {
    code = identityToCode(column.data.identity, alias);
  } else {
    code = [`${alias}()`];
  }

  addCode(
    code,
    numberDataToCode(column.data, ctx.migration, skipNumberMethods),
  );

  return columnCode(column, ctx, key, code);
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
    this.data.parseItem = parseInt;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return intToCode(this, ctx, key, 'smallint');
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
    this.data.parseItem = parseInt;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return intToCode(this, ctx, key, 'integer');
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
> extends NumberAsStringBaseColumn<Schema, string | number | bigint> {
  dataType = 'int8' as const;

  constructor(schema: Schema) {
    super(schema);
    this.data.alias = 'bigint';
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return intToCode(this, ctx, key, 'bigint');
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

  constructor(schema: Schema) {
    super(schema, schema.number() as never);
    this.data.alias = 'real';
    this.data.parseItem = parseFloat;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(
      this,
      ctx,
      key,
      `real()${numberDataToCode(this.data, ctx.migration)}`,
    );
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

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `doublePrecision()`);
  }
}

// autoincrementing two-byte integer
export class SmallSerialColumn<
  Schema extends ColumnSchemaConfig,
> extends IntegerBaseColumn<Schema> {
  dataType = 'int2' as const;
  declare data: SerialColumnData;

  constructor(schema: Schema) {
    super(schema);
    this.data.int = true;
    this.data.alias = 'smallSerial';
    this.data.parseItem = parseInt;
  }

  toSQL() {
    return 'smallserial';
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(
      this,
      ctx,
      key,
      `smallSerial()${numberDataToCode(
        this.data,
        ctx.migration,
        skipNumberMethods,
      )}`,
    );
  }
}

// autoincrementing four-byte integer
export class SerialColumn<
  Schema extends ColumnSchemaConfig,
> extends IntegerBaseColumn<Schema> {
  dataType = 'int4' as const;
  declare data: SerialColumnData;

  constructor(schema: Schema) {
    super(schema);
    this.data.int = true;
    this.data.alias = 'serial';
    this.data.parseItem = parseInt;
  }

  toSQL() {
    return 'serial';
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(
      this,
      ctx,
      key,
      `serial()${numberDataToCode(
        this.data,
        ctx.migration,
        skipNumberMethods,
      )}`,
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

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `bigSerial()`);
  }
}
