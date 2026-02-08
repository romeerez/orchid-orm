import { Column, toArray, toSnakeCase } from 'pqb';
import { ChangeTableData } from './tables.generator';
import { checkForColumnAddOrDrop } from './generators.utils';
import { RakeDbConfig } from 'rake-db';

export const processPrimaryKey = (
  config: RakeDbConfig,
  changeTableData: ChangeTableData,
) => {
  const { codeTable } = changeTableData;

  const columnsPrimaryKey: { key: string; name: string }[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as Column;
    if (column.data.primaryKey) {
      columnsPrimaryKey.push({ key, name: column.data.name ?? key });
    }
  }

  changePrimaryKey(config, columnsPrimaryKey, changeTableData);
  renamePrimaryKey(changeTableData);
};

const changePrimaryKey = (
  config: RakeDbConfig,
  columnsPrimaryKey: { key: string; name: string }[],
  {
    codeTable,
    dbTableData: { primaryKey: dbPrimaryKey },
    changeTableAst: { shape, add, drop },
    changingColumns,
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
    dbPrimaryKey &&
    primaryKey.length === dbPrimaryKey.columns.length &&
    !primaryKey.some(
      ({ name }) => !dbPrimaryKey.columns.some((dbName) => name === dbName),
    )
  ) {
    if (primaryKey.length === 1) {
      const { key } = primaryKey[0];
      const changes = shape[key] && toArray(shape[key]);
      if (changes) {
        for (const change of changes) {
          if (change.type !== 'change') continue;

          if (change.from.column) {
            change.from.column.data.primaryKey = undefined;
          }

          if (change.to.column) {
            const column = Object.create(change.to.column);
            column.data = { ...column.data, primaryKey: undefined };
            change.to.column = column;
          }
        }
      }
    }
    return;
  }

  const toDrop = dbPrimaryKey?.columns.filter(
    (key) => !checkForColumnAddOrDrop(shape, key),
  );
  if (toDrop?.length) {
    if (toDrop.length === 1 && changingColumns[toDrop[0]]) {
      const column = changingColumns[toDrop[0]];
      column.from.data.primaryKey =
        dbPrimaryKey?.name ?? (true as unknown as string);
    } else {
      drop.primaryKey = { columns: toDrop, name: dbPrimaryKey?.name };
    }
  }

  const toAdd = primaryKey.filter(
    ({ key }) => !checkForColumnAddOrDrop(shape, key),
  );
  if (toAdd.length) {
    if (toAdd.length === 1 && changingColumns[toAdd[0].name]) {
      const column = changingColumns[toAdd[0].name];
      column.to.data.primaryKey =
        tablePrimaryKey?.name ?? (true as unknown as string);
    } else {
      add.primaryKey = {
        columns: toAdd.map((c) => c.key),
        name: tablePrimaryKey?.name,
      };
    }
  }
};

const renamePrimaryKey = ({
  codeTable,
  dbTableData: { primaryKey: dbPrimaryKey },
  schema,
  delayedAst,
}: ChangeTableData) => {
  const tablePrimaryKey = codeTable.internal.tableData.primaryKey;
  if (
    dbPrimaryKey &&
    tablePrimaryKey &&
    dbPrimaryKey?.name !== tablePrimaryKey?.name
  ) {
    delayedAst.push({
      type: 'renameTableItem',
      kind: 'CONSTRAINT',
      tableSchema: schema,
      tableName: codeTable.table,
      from: dbPrimaryKey.name ?? `${codeTable.table}_pkey`,
      to: tablePrimaryKey.name ?? `${codeTable}_pkey`,
    });
  }
};
