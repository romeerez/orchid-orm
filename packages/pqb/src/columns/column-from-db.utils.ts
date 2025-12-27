import { RawSQL } from '../query/expressions/raw-sql';
import { Column } from './column';
import { RecordString } from '../utils';
import { TemplateLiteralArgs } from '../query/expressions/expression';

export interface ColumnFromDbParams {
  isNullable?: boolean;
  default?: string;
  maxChars?: number;
  numericPrecision?: number;
  numericScale?: number;
  dateTimePrecision?: number;
  compression?: string;
  collate?: string;
  extension?: string;
  typmod: number;
}

const knownDefaults: RecordString = {
  current_timestamp: 'now()',
  'transaction_timestamp()': 'now()',
};

const simplifyColumnDefault = (value?: string) => {
  if (typeof value === 'string') {
    return new RawSQL([
      [knownDefaults[value.toLowerCase()] || value],
    ] as unknown as TemplateLiteralArgs);
  }
  return;
};

export const assignDbDataToColumn = (
  column: Column.Pick.Data,
  params: ColumnFromDbParams,
): Column.Pick.Data => {
  const { dateTimePrecision } = params;

  Object.assign(column.data, {
    ...params,
    dateTimePrecision:
      // 0 is default for date, 6 is default for timestamp
      dateTimePrecision && dateTimePrecision !== 6
        ? dateTimePrecision
        : undefined,
    collate: params.collate,
    default: simplifyColumnDefault(params.default),
  });

  return column;
};
