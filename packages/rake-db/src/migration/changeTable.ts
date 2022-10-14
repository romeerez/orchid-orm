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
  migrateComments,
  migrateIndexes,
} from './migrationUtils';
import { joinColumns } from '../common';

const newChangeTableData = () => ({
  add: [],
  remove: [],
});

let changeTableData: { add: TableData[]; remove: TableData[] } =
  newChangeTableData();

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

const remove = ((itemOrEmptyObject, options) => {
  if (itemOrEmptyObject instanceof ColumnType) {
    return ['remove', itemOrEmptyObject, options];
  } else {
    changeTableData.remove.push(getTableData());
    resetTableData();
    return emptyObject;
  }
}) as typeof add;

type TableChangeMethods = typeof tableChangeMethods;
const tableChangeMethods = {
  add,
  remove,
};

export type ChangeItem = [
  action: 'add' | 'remove',
  item: ColumnType,
  options?: { dropMode?: DropMode },
];

export type TableChanger = ColumnTypes & TableChangeMethods;

export type TableChangeData = Record<string, ChangeItem | EmptyObject>;

type ChangeTableState = {
  migration: Migration;
  tableName: string;
  alterTable: string[];
  values: unknown[];
  indexes: ColumnIndex[];
  dropIndexes: ColumnIndex[];
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
    dropIndexes: [],
    comments: [],
  };

  if (options.comment !== undefined) {
    await changeActions.tableComment(state, tableName, options.comment);
  }

  for (const key in changeData) {
    const result = changeData[key];
    if (Array.isArray(result)) {
      const [action, item, options] = result;
      changeActions[action](state, migration.up, key, item, options);
    }
  }

  changeTableData.add.forEach((tableData) => {
    handleTableData(state, migration.up, tableName, tableData);
  });

  changeTableData.remove.forEach((tableData) => {
    handleTableData(state, !migration.up, tableName, tableData);
  });

  if (state.alterTable.length) {
    await migration.query(
      `ALTER TABLE "${tableName}"\n  ${state.alterTable.join(',\n  ')}`,
    );
  }

  const createIndexes = migration.up ? state.indexes : state.dropIndexes;
  const dropIndexes = migration.up ? state.dropIndexes : state.indexes;
  await migrateIndexes(state, createIndexes, migration.up);
  await migrateIndexes(state, dropIndexes, !migration.up);
  await migrateComments(state, state.comments);
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
    up: boolean,
    key: string,
    item: ColumnType,
    options?: { dropMode?: DropMode },
  ) {
    addColumnIndex(state[up ? 'indexes' : 'dropIndexes'], key, item);

    if (up) {
      addColumnComment(state.comments, key, item);
    }

    if (up) {
      state.alterTable.push(`ADD COLUMN ${columnToSql(key, item, state)}`);
    } else {
      state.alterTable.push(
        `DROP COLUMN "${key}"${
          options?.dropMode ? ` ${options.dropMode}` : ''
        }`,
      );
    }
  },

  remove(
    state: ChangeTableState,
    up: boolean,
    key: string,
    item: ColumnType,
    options?: { dropMode?: DropMode },
  ) {
    this.add(state, !up, key, item, options);
  },
};

const handleTableData = (
  state: ChangeTableState,
  up: boolean,
  tableName: string,
  tableData: TableData,
) => {
  if (tableData.primaryKey) {
    if (up) {
      state.alterTable.push(
        `ADD PRIMARY KEY (${joinColumns(tableData.primaryKey)})`,
      );
    } else {
      state.alterTable.push(`DROP CONSTRAINT "${tableName}_pkey"`);
    }
  }

  if (tableData.indexes.length) {
    state[up ? 'indexes' : 'dropIndexes'].push(...tableData.indexes);
  }

  if (tableData.foreignKeys.length) {
    tableData.foreignKeys.forEach((foreignKey) => {
      const action = up ? 'ADD' : 'DROP';
      state.alterTable.push(
        `\n  ${action} ${constraintToSql(state.tableName, up, foreignKey)}`,
      );
    });
  }
};
