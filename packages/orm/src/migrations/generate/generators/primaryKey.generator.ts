import { RakeDbAst } from 'rake-db';
import { ColumnType } from 'pqb';
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
  const tablePrimaryKey = codeTable.internal.tableData.primaryKey;
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
      drop.primaryKey = { columns: toDrop, name: dbPrimaryKey?.name };
    }

    const toAdd = primaryKey.filter((key) => !checkForColumnChange(shape, key));
    if (toAdd.length) {
      add.primaryKey = {
        columns: toAdd,
        name: tablePrimaryKey?.name,
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
  const tablePrimaryKey = codeTable.internal.tableData.primaryKey;
  if (
    dbPrimaryKey &&
    tablePrimaryKey &&
    dbPrimaryKey?.name !== tablePrimaryKey?.name
  ) {
    ast.push({
      type: 'renameTableItem',
      kind: 'CONSTRAINT',
      tableSchema: schema,
      tableName: codeTable.table,
      from: dbPrimaryKey.name ?? `${codeTable.table}_pkey`,
      to: tablePrimaryKey.name ?? `${codeTable}_pkey`,
    });
  }
};
