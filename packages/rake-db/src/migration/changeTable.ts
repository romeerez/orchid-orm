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
  RawExpression,
  getRaw,
  isRaw,
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
  primaryKeyToSql,
} from './migrationUtils';

const newChangeTableData = () => ({
  add: [],
  drop: [],
});

let changeTableData: { add: TableData[]; drop: TableData[] } =
  newChangeTableData();

const resetChangeTableData = () => {
  changeTableData = newChangeTableData();
};

function add(item: ColumnType, options?: { dropMode?: DropMode }): ChangeItem;
function add(emptyObject: EmptyObject): EmptyObject;
function add(
  items: Record<string, ColumnType>,
  options?: { dropMode?: DropMode },
): Record<string, ChangeItem>;
function add(
  item: ColumnType | EmptyObject | Record<string, ColumnType>,
  options?: { dropMode?: DropMode },
): ChangeItem | EmptyObject | Record<string, ChangeItem> {
  if (item instanceof ColumnType) {
    return ['add', item, options];
  } else if (item === emptyObject) {
    changeTableData.add.push(getTableData());
    resetTableData();
    return emptyObject;
  } else {
    const result: Record<string, ChangeItem> = {};
    for (const key in item) {
      result[key] = ['add', (item as Record<string, ColumnType>)[key], options];
    }
    return result;
  }
}

const drop = ((item, options) => {
  if (item instanceof ColumnType) {
    return ['drop', item, options];
  } else if (item === emptyObject) {
    changeTableData.drop.push(getTableData());
    resetTableData();
    return emptyObject;
  } else {
    const result: Record<string, ChangeItem> = {};
    for (const key in item) {
      result[key] = [
        'drop',
        (item as Record<string, ColumnType>)[key],
        options,
      ];
    }
    return result;
  }
}) as typeof add;

type ChangeOptions = {
  usingUp?: RawExpression;
  usingDown?: RawExpression;
};

type ChangeArg =
  | ColumnType
  | ['default', unknown | RawExpression]
  | ['nullable', boolean]
  | ['comment', string | null];

type TableChangeMethods = typeof tableChangeMethods;
const tableChangeMethods = {
  add,
  drop,
  change(from: ChangeArg, to: ChangeArg, options?: ChangeOptions): ChangeItem {
    return ['change', from, to, options];
  },
  default(value: unknown | RawExpression): ChangeArg {
    return ['default', value];
  },
  nullable(): ChangeArg {
    return ['nullable', true];
  },
  nonNullable(): ChangeArg {
    return ['nullable', false];
  },
  comment(name: string | null): ChangeArg {
    return ['comment', name];
  },
  rename(name: string): ChangeItem {
    return ['rename', name];
  },
};

export type ChangeItem =
  | [
      action: 'add' | 'drop',
      item: ColumnType,
      options?: { dropMode?: DropMode },
    ]
  | [action: 'change', from: ChangeArg, to: ChangeArg, options?: ChangeOptions]
  | ['rename', string];

export type TableChanger = ColumnTypes & TableChangeMethods;

export type TableChangeData = Record<string, ChangeItem | EmptyObject>;

type ChangeTableState = {
  migration: Migration;
  up: boolean;
  tableName: string;
  alterTable: string[];
  values: unknown[];
  indexes: ColumnIndex[];
  dropIndexes: ColumnIndex[];
  comments: ColumnComment[];
};

export const changeTable = async (
  migration: Migration,
  up: boolean,
  tableName: string,
  options: ChangeTableOptions,
  fn?: ChangeTableCallback,
) => {
  resetTableData();
  resetChangeTableData();

  const tableChanger = Object.create(columnTypes) as TableChanger;
  Object.assign(tableChanger, tableChangeMethods);

  const changeData = fn?.(tableChanger) || {};

  const state: ChangeTableState = {
    migration,
    up,
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
      const [action] = result;
      if (action === 'change') {
        const [, from, to, options] = result;
        changeActions.change(state, up, key, from, to, options);
      } else if (action === 'rename') {
        const [, name] = result;
        changeActions.rename(state, up, key, name);
      } else {
        const [action, item, options] = result;
        changeActions[action](state, up, key, item, options);
      }
    }
  }

  changeTableData.add.forEach((tableData) => {
    handleTableData(state, up, tableName, tableData);
  });

  changeTableData.drop.forEach((tableData) => {
    handleTableData(state, !up, tableName, tableData);
  });

  if (state.alterTable.length) {
    await migration.query(
      `ALTER TABLE "${tableName}"` + `\n  ${state.alterTable.join(',\n  ')}`,
    );
  }

  const createIndexes = up ? state.indexes : state.dropIndexes;
  const dropIndexes = up ? state.dropIndexes : state.indexes;
  await migrateIndexes(state, createIndexes, up);
  await migrateIndexes(state, dropIndexes, !up);
  await migrateComments(state, state.comments);
};

const changeActions = {
  tableComment(
    { migration, up }: ChangeTableState,
    tableName: string,
    comment: Exclude<ChangeTableOptions['comment'], undefined>,
  ) {
    let value;
    if (up) {
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

  drop(
    state: ChangeTableState,
    up: boolean,
    key: string,
    item: ColumnType,
    options?: { dropMode?: DropMode },
  ) {
    this.add(state, !up, key, item, options);
  },

  change(
    state: ChangeTableState,
    up: boolean,
    key: string,
    first: ChangeArg,
    second: ChangeArg,
    options?: ChangeOptions,
  ) {
    const [fromItem, toItem] = up ? [first, second] : [second, first];

    const from = getChangeProperties(fromItem);
    const to = getChangeProperties(toItem);

    if (from.type !== to.type || from.collate !== to.collate) {
      const using = up ? options?.usingUp : options?.usingDown;
      state.alterTable.push(
        `ALTER COLUMN "${key}" TYPE ${to.type}${
          to.collate ? ` COLLATE ${quote(to.collate)}` : ''
        }${using ? ` USING ${getRaw(using, state.values)}` : ''}`,
      );
    }

    if (from.default !== to.default) {
      const value = getRawOrValue(to.default, state.values);
      const expr =
        value === undefined ? `DROP DEFAULT` : `SET DEFAULT ${value}`;
      state.alterTable.push(`ALTER COLUMN "${key}" ${expr}`);
    }

    if (from.nullable !== to.nullable) {
      state.alterTable.push(
        `ALTER COLUMN "${key}" ${to.nullable ? 'DROP' : 'SET'} NOT NULL`,
      );
    }

    if (from.comment !== to.comment) {
      state.comments.push({ column: key, comment: to.comment || null });
    }
  },

  rename(state: ChangeTableState, up: boolean, key: string, name: string) {
    const [from, to] = up ? [key, name] : [name, key];
    state.alterTable.push(`RENAME COLUMN "${from}" TO "${to}"`);
  },
};

const getChangeProperties = (
  item: ChangeArg,
): {
  type?: string;
  collate?: string;
  default?: unknown | RawExpression;
  nullable?: boolean;
  comment?: string | null;
} => {
  if (item instanceof ColumnType) {
    return {
      type: item.toSQL(),
      collate: item.data.collate,
      default: item.data.default,
      nullable: item.isNullable,
      comment: item.data.comment,
    };
  } else {
    return {
      type: undefined,
      collate: undefined,
      default: item[0] === 'default' ? item[1] : undefined,
      nullable: item[0] === 'nullable' ? item[1] : undefined,
      comment: item[0] === 'comment' ? item[1] : undefined,
    };
  }
};

const handleTableData = (
  state: ChangeTableState,
  up: boolean,
  tableName: string,
  tableData: TableData,
) => {
  if (tableData.primaryKey) {
    if (up) {
      state.alterTable.push(`ADD ${primaryKeyToSql(tableData.primaryKey)}`);
    } else {
      const name = tableData.primaryKey.options?.name || `${tableName}_pkey`;
      state.alterTable.push(`DROP CONSTRAINT "${name}"`);
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

const getRawOrValue = (item: unknown | RawExpression, values: unknown[]) => {
  return typeof item === 'object' && item && isRaw(item)
    ? getRaw(item, values)
    : quote(item);
};
