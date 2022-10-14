import {
  ColumnTypes,
  ColumnType,
  columnTypes,
  resetTableData,
  quote,
  getTableData,
  EmptyObject,
  emptyObject,
  TableData,
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
  constraintToSql,
  migrateIndexes,
} from './migrationUtils';
import { joinColumns } from '../common';

const newChangeTableData = () => ({
  add: [],
});

let changeTableData: { add: TableData[] } = newChangeTableData();

const resetChangeTableData = () => {
  changeTableData = newChangeTableData();
};

function add(item: ColumnType, options?: { dropMode?: DropMode }): ChangeItem;
function add(emptyObject: EmptyObject): EmptyObject;
function add(
  itemOrEmptyObject: ColumnType | EmptyObject,
  options?: { dropMode?: DropMode },
): ChangeItem | EmptyObject {
  if (itemOrEmptyObject instanceof ColumnType) {
    return ['add', itemOrEmptyObject, options];
  } else {
    changeTableData.add.push(getTableData());
    resetTableData();
    return emptyObject;
  }
}

type TableChangeMethods = typeof tableChangeMethods;
const tableChangeMethods = {
  add,
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
  resetChangeTableData();

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

  changeTableData.add.forEach((tableData) => {
    if (tableData.primaryKey) {
      if (migration.up) {
        state.alterTable.push(
          `ADD PRIMARY KEY (${joinColumns(tableData.primaryKey)})`,
        );
      } else {
        state.alterTable.push(`DROP CONSTRAINT "${tableName}_pkey"`);
      }
    }

    if (tableData.indexes.length) {
      state.indexes.push(...tableData.indexes);
    }

    if (tableData.foreignKeys.length) {
      tableData.foreignKeys.forEach((foreignKey) => {
        const action = migration.up ? 'ADD' : 'DROP';
        state.alterTable.push(
          `\n  ${action} ${constraintToSql(state, foreignKey)}`,
        );
      });
    }
  });

  if (state.alterTable.length) {
    await migration.query(
      `ALTER TABLE "${tableName}"\n  ${state.alterTable.join(',\n  ')}`,
    );
  }

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
