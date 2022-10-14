import {
  ColumnTypes,
  ColumnType,
  columnTypes,
  resetTableData,
  quote,
} from 'pqb';
import {
  ChangeTableCallback,
  ChangeTableOptions,
  Migration,
} from './migration';

type TableChangeMethods = typeof tableChangeMethods;
const tableChangeMethods = {
  add: (item: ColumnType) => ['add' as const, item],
};

export type ChangeItem = [action: 'add', item: ColumnType];

export type TableChanger = ColumnTypes & TableChangeMethods;

export type TableChangeData = Record<string, ChangeItem>;

export const changeTable = async (
  migration: Migration,
  tableName: string,
  options: ChangeTableOptions,
  fn: ChangeTableCallback,
) => {
  resetTableData();
  const tableChanger = Object.create(columnTypes) as TableChanger;
  Object.assign(tableChanger, tableChangeMethods);

  const changeData = fn(tableChanger);

  if (options.comment !== undefined) {
    changeActions.tableComment(migration, tableName, options.comment);
  }

  for (const key in changeData) {
    const [action, item] = changeData[key];
    changeActions[action](migration, tableName, item);
  }
};

const changeActions = {
  tableComment(
    migration: Migration,
    tableName: string,
    comment: Exclude<ChangeTableOptions['comment'], undefined>,
  ) {
    let value;
    if (migration.up) {
      value = Array.isArray(comment) ? comment[1] : comment;
    } else {
      value = Array.isArray(comment) ? comment[0] : null;
    }
    return migration.query(
      `COMMENT ON TABLE "${tableName}" IS ${quote(value)}`,
    );
  },

  add(migration: Migration, tableName: string, item: ColumnType) {
    //
  },
};
