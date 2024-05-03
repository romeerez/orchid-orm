import { ColumnType } from 'pqb';
import { RakeDbAst } from '../../../ast';
import { ChangeTableData } from './tables.generator';
import { checkForColumnChange } from './generators.utils';

export const processPrimaryKey = (
  ast: RakeDbAst[],
  changeTableData: ChangeTableData,
) => {
  const { codeTable } = changeTableData;

  const columnsPrimaryKey: string[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (column.data.primaryKey) {
      columnsPrimaryKey.push(column.data.name ?? key);
    }
  }

  changePrimaryKey(columnsPrimaryKey, changeTableData);
  renamePrimaryKey(ast, changeTableData);
};

const changePrimaryKey = (
  columnsPrimaryKey: string[],
  {
    codeTable,
    dbTableData: { primaryKey: dbPrimaryKey },
    changeTableAst: { shape, add, drop },
  }: ChangeTableData,
) => {
  const tablePrimaryKey = codeTable.internal.primaryKey;
  const primaryKey = [
    ...new Set([...columnsPrimaryKey, ...(tablePrimaryKey?.columns ?? [])]),
  ];

  if (
    !dbPrimaryKey ||
    primaryKey.length !== dbPrimaryKey.columns.length ||
    primaryKey.some((a) => !dbPrimaryKey.columns.some((b) => a === b))
  ) {
    const toDrop = dbPrimaryKey?.columns.filter(
      (key) => !checkForColumnChange(shape, key),
    );
    if (toDrop?.length) {
      drop.primaryKey = { columns: toDrop, options: dbPrimaryKey?.options };
    }

    const toAdd = primaryKey.filter((key) => !checkForColumnChange(shape, key));
    if (toAdd.length) {
      add.primaryKey = {
        columns: toAdd,
        options: tablePrimaryKey?.options,
      };
    }
  }
};

const renamePrimaryKey = (
  ast: RakeDbAst[],
  {
    codeTable,
    dbTableData: { primaryKey: dbPrimaryKey },
    schema,
  }: ChangeTableData,
) => {
  const tablePrimaryKey = codeTable.internal.primaryKey;
  if (
    dbPrimaryKey &&
    tablePrimaryKey &&
    dbPrimaryKey?.options?.name !== tablePrimaryKey?.options?.name
  ) {
    ast.push({
      type: 'renameTableItem',
      kind: 'CONSTRAINT',
      tableSchema: schema,
      tableName: codeTable.table,
      from: dbPrimaryKey.options?.name ?? `${codeTable.table}_pkey`,
      to: tablePrimaryKey.options?.name ?? `${codeTable}_pkey`,
    });
  }
};
