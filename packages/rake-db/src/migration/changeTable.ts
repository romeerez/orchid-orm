import {
  ColumnTypes,
  ColumnType,
  columnTypes,
  resetTableData,
  quote,
  getTableData,
} from 'pqb';
import {
  ChangeTableCallback,
  ChangeTableOptions,
  ColumnComment,
  ColumnIndex,
  DropMode,
  Migration,
} from './migration';
import {
  addColumnComment,
  addColumnIndex,
  columnToSql,
  migrateIndexes,
} from './migrationUtils';

type TableChangeMethods = typeof tableChangeMethods;
const tableChangeMethods = {
  add: (item: ColumnType, options?: { dropMode?: DropMode }): ChangeItem => [
    'add',
    item,
    options,
  ],
};

export type ChangeItem = [
  action: 'add',
  item: ColumnType,
  options?: { dropMode?: DropMode },
];

export type TableChanger = ColumnTypes & TableChangeMethods;

export type TableChangeData = Record<string, ChangeItem>;

type ChangeTableState = {
  migration: Migration;
  tableName: string;
  alterTable: string[];
  values: unknown[];
  indexes: ColumnIndex[];
  comments: ColumnComment[];
};

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

  const state: ChangeTableState = {
    migration,
    tableName,
    alterTable: [],
    values: [],
    indexes: [],
    comments: [],
  };

  if (options.comment !== undefined) {
    await changeActions.tableComment(state, tableName, options.comment);
  }

  for (const key in changeData) {
    const [action, item, options] = changeData[key];
    changeActions[action](state, key, item, options);
  }

  const tableData = getTableData();

  if (state.alterTable.length) {
    await migration.query(
      `ALTER TABLE "${tableName}"\n  ${state.alterTable.join(',\n  ')}`,
    );
  }

  state.indexes.push(...tableData.indexes);

  await migrateIndexes(state);
};

const changeActions = {
  tableComment(
    { migration }: ChangeTableState,
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

  add(
    state: ChangeTableState,
    key: string,
    item: ColumnType,
    options?: { dropMode?: DropMode },
  ) {
    addColumnIndex(state.indexes, key, item);
    addColumnComment(state.comments, key, item);

    if (state.migration.up) {
      state.alterTable.push(`ADD COLUMN ${columnToSql(key, item, state)}`);
    } else {
      state.alterTable.push(
        `DROP COLUMN "${key}"${
          options?.dropMode ? ` ${options.dropMode}` : ''
        }`,
      );
    }
  },
};
