import { Code, columnCode, ColumnData, ColumnType } from './columnType';
import { Operators } from '../columnsOperators';
import { assignMethodsToClass } from './utils';
import { arrayMethods } from './commonMethods';
import { toArray } from '../utils';

export type ArrayData<Item extends ColumnType> = ColumnData & {
  item: Item;
  min?: number;
  max?: number;
  length?: number;
  isNonEmpty?: true;
};

type ArrayMethods = typeof arrayMethods;

export interface ArrayColumn<Item extends ColumnType>
  extends ColumnType<Item['type'][], typeof Operators.array>,
    ArrayMethods {}

export class ArrayColumn<Item extends ColumnType> extends ColumnType<
  Item['type'][],
  typeof Operators.array
> {
  dataType = 'array' as const;
  operators = Operators.array;
  data: ArrayData<Item>;

  constructor(item: Item) {
    super();

    this.data = { item };
  }

  toSQL() {
    return `${this.data.item.toSQL()}[]`;
  }

  toCode(this: ArrayColumn<Item>, t: string): Code {
    let code = ')';

    const { min, max, length, isNonEmpty } = this.data;

    if (min !== undefined && (!isNonEmpty || (isNonEmpty && min !== 1)))
      code += `.min(${min})`;

    if (max !== undefined) code += `.max(${max})`;

    if (length !== undefined) code += `.length(${length})`;

    return columnCode(this, t, [
      't.array(',
      ...toArray(this.data.item.toCode(t)),
      code,
    ]);
  }

  parseFn = Object.assign(
    (input: unknown) => {
      const entries: unknown[] = [];
      parseArray(
        input as string,
        0,
        (input as string).length,
        entries,
        false,
        this.data.item,
      );
      return entries;
    },
    {
      hideFromCode: true,
    },
  );
}

const parseArray = (
  input: string,
  pos: number,
  len: number,
  entries: unknown[],
  nested: boolean,
  item: ColumnType,
): number => {
  if (input[0] === '[') {
    while (pos < len) {
      let char = input[pos++];
      if (char === '\\') {
        char = input[pos++];
      }
      if (char === '=') break;
    }
  }

  let quote = false;
  let start = pos;
  while (pos < len) {
    let char = input[pos++];
    const escaped = char === '\\';
    if (escaped) {
      char = input[pos++];
    }

    if (char === '"' && !escaped) {
      if (quote) {
        pushEntry(input, start, pos, entries, item);
      } else {
        start = pos;
      }
      quote = !quote;
    } else if (char === ',' && !quote) {
      if (start !== pos) {
        pushEntry(input, start, pos, entries, item);
      }
      start = pos;
    } else if (char === '{' && !quote) {
      let array: unknown[];
      let nestedItem = item;
      if (nested) {
        array = [];
        entries.push(array);
        if ('item' in item.data) {
          nestedItem = (item as ArrayColumn<ColumnType>).data
            .item as ColumnType;
        }
      } else {
        array = entries;
      }
      pos = parseArray(input, pos, len, array, true, nestedItem);
      start = pos + 1;
    } else if (char === '}' && !quote) {
      if (start !== pos) {
        pushEntry(input, start, pos, entries, item);
      }
      start = pos + 1;
      break;
    }
  }

  return pos;
};

assignMethodsToClass(ArrayColumn, arrayMethods);

const pushEntry = (
  input: string,
  start: number,
  pos: number,
  entries: unknown[],
  item: ColumnType,
) => {
  let entry: unknown = input.slice(start, pos - 1);
  if (entry === 'NULL') {
    entry = null;
  } else if (item.parseItem) {
    entry = item.parseItem(entry as string);
  }
  entries.push(entry);
};
