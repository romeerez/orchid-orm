import { RawSQL } from '../sql/rawSql';
import { ColumnFromDbParams } from './columnType';
import { ColumnTypeBase, RecordString, TemplateLiteralArgs } from 'orchid-core';

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

export const instantiateColumn = (
  typeFn: () => ColumnTypeBase,
  params: ColumnFromDbParams,
): ColumnTypeBase => {
  const column = typeFn();

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

  return column as unknown as ColumnTypeBase;
};
