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
import { setColumnDefaultEncode, setColumnDefaultParse } from '../column.utils';
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

    setColumnDefaultParse(this, (input) => parse.call(this as never, input));
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

const parse = function (
  this: ArrayColumn<
    ColumnTypeSchemaArg,
    ArrayColumnValue,
    unknown,
    unknown,
    unknown
  >,
  source: string | unknown[],
) {
  // in the case it was selected via json agg from a sub-select
  if (typeof source !== 'string') return source;

  const entries: unknown[] = [];
  parsePostgresArray(source, entries, this.data.item.data.parseItem);
  return entries;
};

/**
 * based on https://github.com/bendrucker/postgres-array/tree/master
 * and slightly optimized
 */
const parsePostgresArray = (
  source: string,
  entries: unknown[],
  transform?: (input: string) => unknown,
): number => {
  let pos = 0;

  if (source[0] === '[') {
    pos = source.indexOf('=') + 1;
    if (!pos) pos = source.length;
  }

  if (source[pos] === '{') pos++;

  let recorded = '';
  while (pos < source.length) {
    const character = source[pos++];

    if (character === '{') {
      const innerEntries: unknown[] = [];
      entries.push(innerEntries);
      pos +=
        parsePostgresArray(source.slice(pos - 1), innerEntries, transform) - 1;
    } else if (character === '}') {
      if (recorded) {
        entries.push(
          recorded === 'NULL'
            ? null
            : transform
              ? transform(recorded)
              : recorded,
        );
      }

      return pos;
    } else if (character === '"') {
      let esc = false;
      let rec = '';
      while (pos < source.length) {
        let char: string;
        while ((char = source[pos++]) === '\\') {
          if (!(esc = !esc)) rec += '\\';
        }

        if (esc) {
          esc = false;
        } else if (char === '"') {
          break;
        }

        rec += char;
      }

      entries.push(transform ? transform(rec) : rec);
      recorded = '';
    } else if (character === ',') {
      if (recorded) {
        entries.push(
          recorded === 'NULL'
            ? null
            : transform
              ? transform(recorded)
              : recorded,
        );

        recorded = '';
      }
    } else {
      recorded += character;
    }
  }

  return pos;
};
