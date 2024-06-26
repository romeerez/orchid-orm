import { AnyRakeDbConfig, RakeDbAst } from 'rake-db';
import { ColumnType } from 'pqb';
import { ChangeTableData } from './tables.generator';
import { checkForColumnChange } from './generators.utils';
import { toSnakeCase } from 'orchid-core';

export const processPrimaryKey = (
  config: AnyRakeDbConfig,
  ast: RakeDbAst[],
  changeTableData: ChangeTableData,
) => {
  const { codeTable } = changeTableData;

  const columnsPrimaryKey: { key: string; name: string }[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (column.data.primaryKey) {
      columnsPrimaryKey.push({ key, name: column.data.name ?? key });
    }
  }

  changePrimaryKey(config, columnsPrimaryKey, changeTableData);
  renamePrimaryKey(ast, changeTableData);
};

const changePrimaryKey = (
  config: AnyRakeDbConfig,
  columnsPrimaryKey: { key: string; name: string }[],
  {
    codeTable,
    dbTableData: { primaryKey: dbPrimaryKey },
    changeTableAst: { shape, add, drop },
  }: ChangeTableData,
) => {
  const tablePrimaryKey = codeTable.internal.tableData.primaryKey;
  const primaryKey = [
    ...new Set([
      ...columnsPrimaryKey,
      ...((config.snakeCase
        ? tablePrimaryKey?.columns.map((key) => ({
            key,
            name: toSnakeCase(key),
          }))
        : tablePrimaryKey?.columns.map((key) => ({ key, name: key }))) ?? []),
    ]),
  ];

  if (
    !dbPrimaryKey ||
    primaryKey.length !== dbPrimaryKey.columns.length ||
    primaryKey.some(
      ({ name }) => !dbPrimaryKey.columns.some((dbName) => name === dbName),
    )
  ) {
    const toDrop = dbPrimaryKey?.columns.filter(
      (key) => !checkForColumnChange(shape, key),
    );
    if (toDrop?.length) {
      drop.primaryKey = { columns: toDrop, name: dbPrimaryKey?.name };
    }

    const toAdd = primaryKey.filter(
      ({ key }) => !checkForColumnChange(shape, key),
    );
    if (toAdd.length) {
      add.primaryKey = {
        columns: toAdd.map((c) => c.key),
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
