import {
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
  raw,
  ForeignKey,
  newTableData,
  SingleColumnIndexOptions,
} from 'pqb';
import {
  ChangeTableCallback,
  ChangeTableOptions,
  ColumnComment,
  ColumnIndex,
  DropMode,
  Migration,
  MigrationColumnTypes,
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
import { quoteTable } from '../common';

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
  | ['comment', string | null]
  | ['compression', string]
  | ['foreignKey', ForeignKey<string, string[]>]
  | ['index', Omit<SingleColumnIndexOptions, 'column'>];

type TableChangeMethods = typeof tableChangeMethods;
const tableChangeMethods = {
  raw: raw,
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

export type TableChanger = MigrationColumnTypes & TableChangeMethods;

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
      } else if (action) {
        const [action, item, options] = result;
        changeActions[
          action as Exclude<
            keyof typeof changeActions,
            'change' | 'rename' | 'tableComment'
          >
        ](state, up, key, item, options);
      }
    }
  }

  changeTableData[up ? 'drop' : 'add'].forEach((tableData) => {
    handleTableData(state, false, tableName, tableData);
  });

  changeTableData[up ? 'add' : 'drop'].forEach((tableData) => {
    handleTableData(state, true, tableName, tableData);
  });

  if (state.alterTable.length) {
    await migration.query(
      `ALTER TABLE ${quoteTable(tableName)}` +
        `\n  ${state.alterTable.join(',\n  ')}`,
    );
  }

  await migrateIndexes(state, state.dropIndexes, false);
  await migrateIndexes(state, state.indexes, true);
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
      `COMMENT ON TABLE ${quoteTable(tableName)} IS ${quote(value)}`,
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

    if (from.compression !== to.compression) {
      state.alterTable.push(
        `ALTER COLUMN "${key}" SET COMPRESSION ${to.compression || 'DEFAULT'}`,
      );
    }

    const fromFkey = from.foreignKey;
    const toFkey = to.foreignKey;
    if (fromFkey || toFkey) {
      if ((fromFkey && 'fn' in fromFkey) || (toFkey && 'fn' in toFkey)) {
        throw new Error('Callback in foreignKey is not allowed in migration');
      }

      if (checkIfForeignKeysAreDifferent(fromFkey, toFkey)) {
        if (fromFkey) {
          const data = newTableData();
          data.foreignKeys.push({
            columns: [key],
            fnOrTable: fromFkey.table,
            foreignColumns: fromFkey.columns,
            options: fromFkey,
          });
          changeTableData[up ? 'drop' : 'add'].push(data);
        }

        if (toFkey) {
          const data = newTableData();
          data.foreignKeys.push({
            columns: [key],
            fnOrTable: toFkey.table,
            foreignColumns: toFkey.columns,
            options: toFkey,
          });
          changeTableData[up ? 'add' : 'drop'].push(data);
        }
      }
    }

    const fromIndex = from.index;
    const toIndex = to.index;
    if (
      (fromIndex || toIndex) &&
      checkIfIndexesAreDifferent(fromIndex, toIndex)
    ) {
      if (fromIndex) {
        const data = newTableData();
        data.indexes.push({
          columns: [
            {
              column: key,
              ...fromIndex,
            },
          ],
          options: fromIndex,
        });
        changeTableData[up ? 'drop' : 'add'].push(data);
      }

      if (toIndex) {
        const data = newTableData();
        data.indexes.push({
          columns: [
            {
              column: key,
              ...toIndex,
            },
          ],
          options: toIndex,
        });
        changeTableData[up ? 'add' : 'drop'].push(data);
      }
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

const checkIfForeignKeysAreDifferent = (
  from?: ForeignKey<string, string[]> & { table: string },
  to?: ForeignKey<string, string[]> & { table: string },
) => {
  return (
    !from ||
    !to ||
    from.name !== to.name ||
    from.match !== to.match ||
    from.onUpdate !== to.onUpdate ||
    from.onDelete !== to.onDelete ||
    from.dropMode !== to.dropMode ||
    from.table !== to.table ||
    from.columns.join(',') !== to.columns.join(',')
  );
};

const checkIfIndexesAreDifferent = (
  from?: Omit<SingleColumnIndexOptions, 'column'>,
  to?: Omit<SingleColumnIndexOptions, 'column'>,
) => {
  return (
    !from ||
    !to ||
    from.expression !== to.expression ||
    from.collate !== to.collate ||
    from.operator !== to.operator ||
    from.order !== to.order ||
    from.name !== to.name ||
    from.unique !== to.unique ||
    from.using !== to.using ||
    from.include !== to.include ||
    (Array.isArray(from.include) &&
      Array.isArray(to.include) &&
      from.include.join(',') !== to.include.join(',')) ||
    from.with !== to.with ||
    from.tablespace !== to.tablespace ||
    from.where !== to.where ||
    from.dropMode !== to.dropMode
  );
};

type ChangeProperties = {
  type?: string;
  collate?: string;
  default?: unknown | RawExpression;
  nullable?: boolean;
  comment?: string | null;
  compression?: string;
  foreignKey?: ForeignKey<string, string[]>;
  index?: Omit<SingleColumnIndexOptions, 'column'>;
};

const getChangeProperties = (item: ChangeArg): ChangeProperties => {
  if (item instanceof ColumnType) {
    return {
      type: item.toSQL(),
      collate: item.data.collate,
      default: item.data.default,
      nullable: item.isNullable,
      comment: item.data.comment,
      compression: item.data.compression,
      foreignKey: item.data.foreignKey,
      index: item.data.index,
    };
  } else {
    return {
      type: undefined,
      collate: undefined,
      default: item[0] === 'default' ? item[1] : undefined,
      nullable: item[0] === 'nullable' ? item[1] : undefined,
      comment: item[0] === 'comment' ? item[1] : undefined,
      compression: item[0] === 'compression' ? item[1] : undefined,
      foreignKey: item[0] === 'foreignKey' ? item[1] : undefined,
      index: item[0] === 'index' ? item[1] : undefined,
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
