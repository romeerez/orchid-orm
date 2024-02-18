import { RawSQL } from '../sql/rawSql';
import { ColumnFromDbParams } from './columnType';
import { TableData } from './columnTypes';
import { ColumnTypeBase, RecordString } from 'orchid-core';

const knownDefaults: RecordString = {
  current_timestamp: 'now()',
  'transaction_timestamp()': 'now()',
};

export const simplifyColumnDefault = (value?: string) => {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return new RawSQL(knownDefaults[lower] || value);
  }
  return;
};

export const instantiateColumn = (
  typeFn: () => ColumnTypeBase,
  params: ColumnFromDbParams,
): ColumnTypeBase => {
  const column = typeFn();

  Object.assign(column.data, {
    ...params,
    default: simplifyColumnDefault(params.default),
  });

  return column as unknown as ColumnTypeBase;
};

export const getConstraintKind = (
  it: TableData.Constraint,
): 'constraint' | 'foreignKey' | 'check' => {
  let num = 0;
  for (const key in it) {
    if (
      (key === 'references' || key === 'check') &&
      it[key as keyof typeof it] !== undefined
    ) {
      num++;
    }
  }
  return num === 1 ? (it.references ? 'foreignKey' : 'check') : 'constraint';
};
