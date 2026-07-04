import { Column } from '../column';
import {
  addCode,
  Code,
  arrayDataToCode,
  Codes,
  ColumnToCodeCtx,
} from '../code';
import { columnCode } from '../code';
import { Operators, OperatorsArray } from '../operators';
import { setColumnDefaultEncode } from '../column.utils';
import { ArrayMethodsData } from '../column-data-types';
import { ColumnSchemaConfig, ColumnTypeSchemaArg } from '../column-schema';

export interface ArrayColumnValue {
  __type: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any;
  __inputType: unknown;
  __outputType: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __queryType: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  querySchema: any;
  toSQL(): string;
  toCode(ctx: ColumnToCodeCtx, key: string): Code;
  data: Column.Data;
}

export interface ArrayData<Item extends ArrayColumnValue>
  extends Column.Data, ArrayMethodsData {
  item: Item;
  arrayDims: number;
}

export class ArrayColumn<
  Schema extends ColumnTypeSchemaArg,
  Item extends ArrayColumnValue,
  InputType,
  OutputType,
  QueryType,
> extends Column {
  declare __schema: Schema;
  dataType = 'array' as const;
  operators = Operators.array as OperatorsArray<Item['__queryType']>;
  declare data: ArrayData<Item>;
  declare __type: Item['__type'][];
  declare __inputType: Item['__type'][];
  declare inputSchema: InputType;
  declare __outputType: Item['__outputType'][];
  declare outputSchema: OutputType;
  declare __queryType: Item['__queryType'][];
  declare querySchema: QueryType;

  constructor(
    schema: Schema,
    item: Item,
    __inputType: InputType,
    defaultEncode?: (input: unknown) => unknown,
    __outputType?: OutputType,
    __queryType?: QueryType,
  ) {
    super(schema, __inputType, __outputType, __queryType);

    // array items cannot be non-nullable, postgres limitation
    item.data.isNullable = true;

    if (defaultEncode) {
      setColumnDefaultEncode(this, defaultEncode);
    }

    this.data.item = item instanceof ArrayColumn ? item.data.item : item;
    this.data.name = item.data.name;
    this.data.arrayDims =
      item instanceof ArrayColumn ? item.data.arrayDims + 1 : 1;
  }

  toSQL(): string {
    return this.data.item.toSQL() + '[]'.repeat(this.data.arrayDims);
  }

  toCode(
    this: ArrayColumn<
      ColumnSchemaConfig,
      ArrayColumnValue,
      unknown,
      unknown,
      unknown
    >,
    ctx: ColumnToCodeCtx,
    key: string,
  ): Code {
    let open = 'array(';
    let close = ')';
    for (let i = 1; i < this.data.arrayDims; i++) {
      open += `${ctx.t}.array(`;
      close += ')';
    }

    const code: Codes = [open];

    const { item } = this.data;
    const clonedItem = Object.create(item);
    const { isNullable: _, ...dataWithoutNullable } = item.data;
    clonedItem.data = dataWithoutNullable;
    addCode(code, clonedItem.toCode(ctx, key));

    addCode(code, `${close}${arrayDataToCode(this.data, ctx.migration)}`);
    return columnCode(this, ctx, key, code);
  }
}
