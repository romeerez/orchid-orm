import { ColumnData, ColumnType } from './columnType';
import {
  addCode,
  Code,
  ArrayMethodsData,
  arrayDataToCode,
  ColumnSchemaConfig,
  ColumnTypeSchemaArg,
  ColumnDataBase,
  Codes,
  ColumnToCodeCtx,
} from '../core';
import { columnCode } from './code';
import { Operators, OperatorsArray } from './operators';
import { setColumnDefaultParse } from './column.utils';

export interface ArrayColumnValue {
  type: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any;
  inputType: unknown;
  outputType: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryType: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  querySchema: any;
  toSQL(): string;
  toCode(ctx: ColumnToCodeCtx, key: string): Code;
  data: ColumnDataBase;
}

export interface ArrayData<Item extends ArrayColumnValue>
  extends ColumnData,
    ArrayMethodsData {
  item: Item;
  arrayDims: number;
}

export class ArrayColumn<
  Schema extends ColumnTypeSchemaArg,
  Item extends ArrayColumnValue,
  InputType,
  OutputType,
  QueryType,
> extends ColumnType<
  Schema,
  Item['type'][],
  InputType,
  OperatorsArray<Item['queryType']>,
  Item['inputType'][],
  Item['outputType'][],
  OutputType,
  Item['queryType'][],
  QueryType
> {
  dataType = 'array' as const;
  operators = Operators.array as OperatorsArray<Item['queryType']>;
  declare data: ArrayData<Item>;

  constructor(
    schema: Schema,
    item: Item,
    inputType: InputType,
    outputType?: OutputType,
    queryType?: QueryType,
  ) {
    super(schema, inputType, outputType, queryType);

    // array items cannot be non-nullable, postgres limitation
    item.data.isNullable = true;

    setColumnDefaultParse(this, (input) => parse.call(this as never, input));

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
    const { isNullable } = item.data;
    delete item.data.isNullable;
    addCode(code, item.toCode(ctx, key));
    item.data.isNullable = isNullable;

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
