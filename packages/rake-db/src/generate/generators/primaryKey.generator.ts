import { ColumnType, QueryWithTable, TableData } from 'pqb';
import { StructureToAstTableData } from '../structureToAst';
import { RakeDbAst } from '../../ast';

export const processPrimaryKey = (
  ast: RakeDbAst[],
  tableData: StructureToAstTableData,
  codeTable: QueryWithTable,
  shape: RakeDbAst.ChangeTableShape,
  add: TableData,
  drop: TableData,
  schema: string,
  tableName: string,
) => {
  const columnsPrimaryKey: string[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (column.data.isPrimaryKey) {
      columnsPrimaryKey.push(column.data.name ?? key);
    }
  }

  changePrimaryKey(tableData, codeTable, columnsPrimaryKey, add, drop, shape);
  renamePrimaryKey(tableData, codeTable, ast, schema, tableName);
};

const changePrimaryKey = (
  tableData: StructureToAstTableData,
  codeTable: QueryWithTable,
  columnsPrimaryKey: string[],
  add: TableData,
  drop: TableData,
  shape: RakeDbAst.ChangeTableShape,
) => {
  const { primaryKey: dbPrimaryKey } = tableData;
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
      (key) => !shape[key] || shape[key].type === 'rename',
    );
    if (toDrop?.length) {
      drop.primaryKey = { columns: toDrop, options: dbPrimaryKey?.options };
    }

    const toAdd = primaryKey.filter(
      (key) => !shape[key] || shape[key].type === 'rename',
    );
    if (toAdd.length) {
      add.primaryKey = {
        columns: toAdd,
        options: tablePrimaryKey?.options,
      };
    }
  }
};

const renamePrimaryKey = (
  tableData: StructureToAstTableData,
  codeTable: QueryWithTable,
  ast: RakeDbAst[],
  schema: string | undefined,
  tableName: string,
) => {
  const { primaryKey: dbPrimaryKey } = tableData;
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
      from: dbPrimaryKey.options?.name ?? `${tableName}_pkey`,
      to: tablePrimaryKey.options?.name ?? `${codeTable}_pkey`,
    });
  }
};
