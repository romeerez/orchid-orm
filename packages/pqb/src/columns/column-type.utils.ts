import { RawSQL } from '../sql/rawSql';
import { ColumnFromDbParams } from './column-type';
import { ColumnTypeBase, RecordString, TemplateLiteralArgs } from '../core';

const knownDefaults: RecordString = {
  current_timestamp: 'now()',
  'transaction_timestamp()': 'now()',
};

export const simplifyColumnDefault = (value?: string) => {
  if (typeof value === 'string') {
    return new RawSQL([
      [knownDefaults[value.toLowerCase()] || value],
    ] as unknown as TemplateLiteralArgs);
  }
  return;
};

export const assignDbDataToColumn = (
  column: ColumnTypeBase,
  params: ColumnFromDbParams,
): ColumnTypeBase => {
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
