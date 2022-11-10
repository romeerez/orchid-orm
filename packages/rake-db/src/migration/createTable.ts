import {
  ColumnType,
  columnTypes,
  getColumnTypes,
  getTableData,
  Operators,
  quote,
  raw,
} from 'pqb';
import {
  TableOptions,
  ColumnsShapeCallback,
  Migration,
  ColumnIndex,
  ColumnComment,
  JoinTableOptions,
} from './migration';
import {
  addColumnComment,
  addColumnIndex,
  columnToSql,
  constraintToSql,
  getPrimaryKeysOfTable,
  migrateComments,
  migrateIndexes,
  primaryKeyToSql,
} from './migrationUtils';
import { joinWords, quoteTable } from '../common';
import { singular } from 'pluralize';

class UnknownColumn extends ColumnType {
  operators = Operators.any;

  constructor(public dataType: string) {
    super();
  }
}

export const createJoinTable = async (
  migration: Migration,
  up: boolean,
  tables: string[],
  options: JoinTableOptions,
  fn?: ColumnsShapeCallback,
) => {
  const tableName = options.tableName || joinWords(...tables);

  if (!up) {
    return createTable(migration, up, tableName, options, () => ({}));
  }

  const tablesWithPrimaryKeys = await Promise.all(
    tables.map(async (table) => {
      const primaryKeys = await getPrimaryKeysOfTable(migration, table).then(
        (items) =>
          items.map((item) => ({
            ...item,
            joinedName: joinWords(singular(table), item.name),
          })),
      );

      if (!primaryKeys.length) {
        throw new Error(
          `Primary key for table ${quoteTable(table)} is not defined`,
        );
      }

      return [table, primaryKeys] as const;
    }),
  );

  return createTable(migration, up, tableName, options, (t) => {
    const result: Record<string, ColumnType> = {};

    tablesWithPrimaryKeys.forEach(([table, primaryKeys]) => {
      if (primaryKeys.length === 1) {
        const [{ type, joinedName, name }] = primaryKeys;

        const column = new UnknownColumn(type);

        result[joinedName] = column.foreignKey(table, name);

        return;
      }

      primaryKeys.forEach(({ joinedName, type }) => {
        result[joinedName] = new UnknownColumn(type);
      });

      t.foreignKey(
        primaryKeys.map((key) => key.joinedName) as [string, ...string[]],
        table,
        primaryKeys.map((key) => key.name) as [string, ...string[]],
      );
    });

    if (fn) {
      Object.assign(result, fn(t));
    }

    t.primaryKey(
      tablesWithPrimaryKeys.flatMap(([, primaryKeys]) =>
        primaryKeys.map((item) => item.joinedName),
      ),
    );

    return result;
  });
};

const types = Object.assign(Object.create(columnTypes), {
  raw,
});

export const createTable = async (
  migration: Migration,
  up: boolean,
  tableName: string,
  options: TableOptions,
  fn: ColumnsShapeCallback,
) => {
  const shape = getColumnTypes(types, fn);

  if (!up) {
    const { dropMode } = options;
    await migration.query(
      `DROP TABLE ${quoteTable(tableName)}${dropMode ? ` ${dropMode}` : ''}`,
    );
    return;
  }

  const lines: string[] = [];

  const state: {
    migration: Migration;
    tableName: string;
    values: unknown[];
    indexes: ColumnIndex[];
    comments: ColumnComment[];
  } = {
    migration,
    tableName,
    values: [],
    indexes: [],
    comments: [],
  };

  for (const key in shape) {
    const item = shape[key];
    addColumnIndex(state.indexes, key, item);
    addColumnComment(state.comments, key, item);
    lines.push(`\n  ${columnToSql(key, item, state)}`);
  }

  const tableData = getTableData();
  if (tableData.primaryKey) {
    lines.push(`\n  ${primaryKeyToSql(tableData.primaryKey)}`);
  }

  tableData.foreignKeys.forEach((foreignKey) => {
    lines.push(`\n  ${constraintToSql(state.tableName, up, foreignKey)}`);
  });

  await migration.query({
    text: `CREATE TABLE ${quoteTable(tableName)} (${lines.join(',')}\n)`,
    values: state.values,
  });

  state.indexes.push(...tableData.indexes);

  await migrateIndexes(state, state.indexes, up);
  await migrateComments(state, state.comments);

  if (options.comment) {
    await migration.query(
      `COMMENT ON TABLE ${quoteTable(tableName)} IS ${quote(options.comment)}`,
    );
  }
};
