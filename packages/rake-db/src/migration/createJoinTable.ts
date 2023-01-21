import { ColumnType, Operators } from 'pqb';
import { ColumnsShapeCallback, JoinTableOptions, Migration } from './migration';
import { joinWords, quoteTable } from '../common';
import { getPrimaryKeysOfTable } from './migrationUtils';
import { singular } from 'pluralize';
import { createTable } from './createTable';

class UnknownColumn extends ColumnType {
  operators = Operators.any;

  constructor(public dataType: string) {
    super();
  }

  toCode() {
    return 'unknown';
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
    return createTable(
      migration,
      up,
      tableName,
      { ...options, noPrimaryKey: true },
      () => ({}),
    );
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
