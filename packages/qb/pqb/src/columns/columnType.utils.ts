import { RawSQL } from '../sql/rawSql';
import { ColumnFromDbParams, ColumnType } from './columnType';
import { TableData } from './columnTypes';

const knownDefaults: Record<string, string> = {
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
  typeFn: () => ColumnType,
  params: ColumnFromDbParams,
): ColumnType => {
  const column = typeFn();

  Object.assign(column.data, {
    ...params,
    default: simplifyColumnDefault(params.default),
  });

  return column as unknown as ColumnType;
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
