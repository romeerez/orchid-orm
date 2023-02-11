import {
  ColumnType,
  resetTableData,
  getTableData,
  EmptyObject,
  emptyObject,
  TableData,
  RawExpression,
  columnTypes,
  quote,
  getRaw,
  isRaw,
  EnumColumn,
} from 'pqb';
import {
  ChangeTableCallback,
  ChangeTableOptions,
  ColumnComment,
  DropMode,
  MigrationBase,
  MigrationColumnTypes,
  runCodeUpdater,
} from './migration';
import { RakeDbAst } from '../ast';
import {
  getSchemaAndTableFromName,
  makePopulateEnumQuery,
  quoteWithSchema,
} from '../common';
import {
  addColumnComment,
  addColumnIndex,
  columnToSql,
  commentsToQuery,
  constraintToSql,
  indexesToQuery,
  primaryKeyToSql,
} from './migrationUtils';
import { tableMethods } from './tableMethods';
import { TableQuery } from './createTable';

type ChangeTableData = { add: TableData; drop: TableData };
const newChangeTableData = (): ChangeTableData => ({
  add: { indexes: [], foreignKeys: [] },
  drop: { indexes: [], foreignKeys: [] },
});

let changeTableData = newChangeTableData();

const resetChangeTableData = () => {
  changeTableData = newChangeTableData();
};

const mergeTableData = (a: TableData, b: TableData) => {
  if (b.primaryKey) {
    if (!a.primaryKey) {
      a.primaryKey = b.primaryKey;
    } else {
      a.primaryKey = {
        columns: [...a.primaryKey.columns, ...b.primaryKey.columns],
        options: { ...a.primaryKey.options, ...b.primaryKey.options },
      };
    }
  }
  a.indexes = [...a.indexes, ...b.indexes];
  a.foreignKeys = [...a.foreignKeys, ...b.foreignKeys];
};

function add(
  item: ColumnType,
  options?: { dropMode?: DropMode },
): RakeDbAst.ChangeTableItem.Column;
function add(emptyObject: EmptyObject): EmptyObject;
function add(
  items: Record<string, ColumnType>,
  options?: { dropMode?: DropMode },
): Record<string, RakeDbAst.ChangeTableItem.Column>;
function add(
  item: ColumnType | EmptyObject | Record<string, ColumnType>,
  options?: { dropMode?: DropMode },
):
  | RakeDbAst.ChangeTableItem.Column
  | EmptyObject
  | Record<string, RakeDbAst.ChangeTableItem.Column> {
  if (item instanceof ColumnType) {
    return { type: 'add', item, dropMode: options?.dropMode };
  } else if (item === emptyObject) {
    mergeTableData(changeTableData.add, getTableData());
    resetTableData();
    return emptyObject;
  } else {
    const result: Record<string, RakeDbAst.ChangeTableItem.Column> = {};
    for (const key in item) {
      result[key] = {
        type: 'add',
        item: (item as Record<string, ColumnType>)[key],
        dropMode: options?.dropMode,
      };
    }
    return result;
  }
}

const drop = ((item, options) => {
  if (item instanceof ColumnType) {
    return { type: 'drop', item, dropMode: options?.dropMode };
  } else if (item === emptyObject) {
    mergeTableData(changeTableData.drop, getTableData());
    resetTableData();
    return emptyObject;
  } else {
    const result: Record<string, RakeDbAst.ChangeTableItem.Column> = {};
    for (const key in item) {
      result[key] = {
        type: 'drop',
        item: (item as Record<string, ColumnType>)[key],
        dropMode: options?.dropMode,
      };
    }
    return result;
  }
}) as typeof add;

type Change = RakeDbAst.ChangeTableItem.Change & ChangeOptions;

type ChangeOptions = {
  usingUp?: RawExpression;
  usingDown?: RawExpression;
};

const columnTypeToColumnChange = (
  item: ColumnType | Change,
): RakeDbAst.ColumnChange => {
  if (item instanceof ColumnType) {
    const foreignKeys = item.data.foreignKeys;
    if (foreignKeys?.some((it) => 'fn' in it)) {
      throw new Error('Callback in foreignKey is not allowed in migration');
    }

    return {
      column: item,
      type: item.toSQL(),
      nullable: item.data.isNullable,
      primaryKey: item.isPrimaryKey,
      ...item.data,
      foreignKeys: foreignKeys as RakeDbAst.ColumnChange['foreignKeys'],
    };
  }

  return item.to;
};

type TableChangeMethods = typeof tableChangeMethods;
const tableChangeMethods = {
  ...tableMethods,
  add,
  drop,
  change(
    from: ColumnType | Change,
    to: ColumnType | Change,
    options?: ChangeOptions,
  ): Change {
    return {
      type: 'change',
      from: columnTypeToColumnChange(from),
      to: columnTypeToColumnChange(to),
      ...options,
    };
  },
  default(value: unknown | RawExpression): Change {
    return { type: 'change', from: { default: null }, to: { default: value } };
  },
  nullable(): Change {
    return {
      type: 'change',
      from: { nullable: false },
      to: { nullable: true },
    };
  },
  nonNullable(): Change {
    return {
      type: 'change',
      from: { nullable: true },
      to: { nullable: false },
    };
  },
  comment(comment: string | null): Change {
    return { type: 'change', from: { comment: null }, to: { comment } };
  },
  rename(name: string): RakeDbAst.ChangeTableItem.Rename {
    return { type: 'rename', name };
  },
};

export type TableChanger = MigrationColumnTypes & TableChangeMethods;

export type TableChangeData = Record<
  string,
  | RakeDbAst.ChangeTableItem.Column
  | RakeDbAst.ChangeTableItem.Rename
  | Change
  | EmptyObject
>;

export const changeTable = async (
  migration: MigrationBase,
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

  const ast = makeAst(up, tableName, changeData, changeTableData, options);

  const queries = astToQueries(ast);
  for (const query of queries) {
    const result = await migration.adapter.arrays(query);
    query.then?.(result);
  }

  await runCodeUpdater(migration, ast);
};

const makeAst = (
  up: boolean,
  name: string,
  changeData: TableChangeData,
  changeTableData: ChangeTableData,
  options: ChangeTableOptions,
): RakeDbAst.ChangeTable => {
  const { comment } = options;

  const shape: Record<string, RakeDbAst.ChangeTableItem> = {};
  for (const key in changeData) {
    const item = changeData[key];
    if ('type' in item) {
      if (up) {
        shape[key] =
          item.type === 'change' && item.usingUp
            ? { ...item, using: item.usingUp }
            : item;
      } else {
        if (item.type === 'rename') {
          shape[item.name] = { ...item, name: key };
        } else {
          shape[key] =
            item.type === 'add'
              ? { ...item, type: 'drop' }
              : item.type === 'drop'
              ? { ...item, type: 'add' }
              : item.type === 'change'
              ? { ...item, from: item.to, to: item.from, using: item.usingDown }
              : item;
        }
      }
    }
  }

  const [schema, table] = getSchemaAndTableFromName(name);

  return {
    type: 'changeTable',
    schema,
    name: table,
    comment: comment
      ? up
        ? Array.isArray(comment)
          ? comment[1]
          : comment
        : Array.isArray(comment)
        ? comment[0]
        : null
      : undefined,
    shape,
    ...(up
      ? changeTableData
      : { add: changeTableData.drop, drop: changeTableData.add }),
  };
};

type PrimaryKeys = {
  columns: string[];
  change?: true;
  options?: { name?: string };
};

const astToQueries = (ast: RakeDbAst.ChangeTable): TableQuery[] => {
  const queries: TableQuery[] = [];

  if (ast.comment !== undefined) {
    queries.push({
      text: `COMMENT ON TABLE ${quoteWithSchema(ast)} IS ${quote(ast.comment)}`,
    });
  }

  const addPrimaryKeys: PrimaryKeys = ast.add.primaryKey
    ? { ...ast.add.primaryKey }
    : {
        columns: [],
      };
  const dropPrimaryKeys: PrimaryKeys = ast.drop.primaryKey
    ? { ...ast.drop.primaryKey }
    : {
        columns: [],
      };

  for (const key in ast.shape) {
    const item = ast.shape[key];

    if ('item' in item) {
      const { item: column } = item;
      if (column instanceof EnumColumn) {
        queries.push(makePopulateEnumQuery(column));
      }
    }

    if (item.type === 'add') {
      if (item.item.isPrimaryKey) {
        addPrimaryKeys.columns.push(key);
      }
    } else if (item.type === 'drop') {
      if (item.item.isPrimaryKey) {
        dropPrimaryKeys.columns.push(key);
      }
    } else if (item.type === 'change') {
      if (item.from.column instanceof EnumColumn) {
        queries.push(makePopulateEnumQuery(item.from.column));
      }

      if (item.to.column instanceof EnumColumn) {
        queries.push(makePopulateEnumQuery(item.to.column));
      }

      if (item.from.primaryKey) {
        dropPrimaryKeys.columns.push(key);
        dropPrimaryKeys.change = true;
      }

      if (item.to.primaryKey) {
        addPrimaryKeys.columns.push(key);
        addPrimaryKeys.change = true;
      }
    }
  }

  const alterTable: string[] = [];
  const values: unknown[] = [];
  const addIndexes: TableData.Index[] = [...ast.add.indexes];
  const dropIndexes: TableData.Index[] = [...ast.drop.indexes];
  const addForeignKeys: TableData.ForeignKey[] = [...ast.add.foreignKeys];
  const dropForeignKeys: TableData.ForeignKey[] = [...ast.drop.foreignKeys];
  const comments: ColumnComment[] = [];

  for (const key in ast.shape) {
    const item = ast.shape[key];

    if (item.type === 'add') {
      addColumnIndex(addIndexes, key, item.item);
      addColumnComment(comments, key, item.item);

      alterTable.push(
        `ADD COLUMN ${columnToSql(
          key,
          item.item,
          values,
          addPrimaryKeys.columns.length > 1,
        )}`,
      );
    } else if (item.type === 'drop') {
      addColumnIndex(dropIndexes, key, item.item);

      alterTable.push(
        `DROP COLUMN "${key}"${item.dropMode ? ` ${item.dropMode}` : ''}`,
      );
    } else if (item.type === 'change') {
      const { from, to } = item;
      if (from.type !== to.type || from.collate !== to.collate) {
        alterTable.push(
          `ALTER COLUMN "${key}" TYPE ${to.type}${
            to.collate ? ` COLLATE ${quote(to.collate)}` : ''
          }${item.using ? ` USING ${getRaw(item.using, values)}` : ''}`,
        );
      }

      if (from.default !== to.default) {
        const value =
          typeof to.default === 'object' && to.default && isRaw(to.default)
            ? getRaw(to.default, values)
            : quote(to.default);

        const expr =
          value === undefined ? 'DROP DEFAULT' : `SET DEFAULT ${value}`;

        alterTable.push(`ALTER COLUMN "${key}" ${expr}`);
      }

      if (from.nullable !== to.nullable) {
        alterTable.push(
          `ALTER COLUMN "${key}" ${to.nullable ? 'DROP' : 'SET'} NOT NULL`,
        );
      }

      if (from.compression !== to.compression) {
        alterTable.push(
          `ALTER COLUMN "${key}" SET COMPRESSION ${
            to.compression || 'DEFAULT'
          }`,
        );
      }

      const foreignKeysLen = Math.max(
        from.foreignKeys?.length || 0,
        to.foreignKeys?.length || 0,
      );
      for (let i = 0; i < foreignKeysLen; i++) {
        const fromFkey = from.foreignKeys?.[i];
        const toFkey = to.foreignKeys?.[i];

        if (
          (fromFkey || toFkey) &&
          (!fromFkey ||
            !toFkey ||
            fromFkey.name !== toFkey.name ||
            fromFkey.match !== toFkey.match ||
            fromFkey.onUpdate !== toFkey.onUpdate ||
            fromFkey.onDelete !== toFkey.onDelete ||
            fromFkey.dropMode !== toFkey.dropMode ||
            fromFkey.table !== toFkey.table ||
            fromFkey.columns.join(',') !== toFkey.columns.join(','))
        ) {
          if (fromFkey) {
            dropForeignKeys.push({
              columns: [key],
              fnOrTable: fromFkey.table,
              foreignColumns: fromFkey.columns,
              options: fromFkey,
            });
          }

          if (toFkey) {
            addForeignKeys.push({
              columns: [key],
              fnOrTable: toFkey.table,
              foreignColumns: toFkey.columns,
              options: toFkey,
            });
          }
        }
      }

      const indexesLen = Math.max(
        from.indexes?.length || 0,
        to.indexes?.length || 0,
      );
      for (let i = 0; i < indexesLen; i++) {
        const fromIndex = from.indexes?.[i];
        const toIndex = to.indexes?.[i];

        if (
          (fromIndex || toIndex) &&
          (!fromIndex ||
            !toIndex ||
            fromIndex.collate !== toIndex.collate ||
            fromIndex.opclass !== toIndex.opclass ||
            fromIndex.order !== toIndex.order ||
            fromIndex.name !== toIndex.name ||
            fromIndex.unique !== toIndex.unique ||
            fromIndex.using !== toIndex.using ||
            fromIndex.include !== toIndex.include ||
            (Array.isArray(fromIndex.include) &&
              Array.isArray(toIndex.include) &&
              fromIndex.include.join(',') !== toIndex.include.join(',')) ||
            fromIndex.with !== toIndex.with ||
            fromIndex.tablespace !== toIndex.tablespace ||
            fromIndex.where !== toIndex.where ||
            fromIndex.dropMode !== toIndex.dropMode)
        ) {
          if (fromIndex) {
            dropIndexes.push({
              columns: [
                {
                  column: key,
                  ...fromIndex,
                },
              ],
              options: fromIndex,
            });
          }

          if (toIndex) {
            addIndexes.push({
              columns: [
                {
                  column: key,
                  ...toIndex,
                },
              ],
              options: toIndex,
            });
          }
        }
      }

      if (from.comment !== to.comment) {
        comments.push({ column: key, comment: to.comment || null });
      }
    } else if (item.type === 'rename') {
      alterTable.push(`RENAME COLUMN "${key}" TO "${item.name}"`);
    }
  }

  const prependAlterTable: string[] = [];

  if (
    ast.drop.primaryKey ||
    dropPrimaryKeys.change ||
    dropPrimaryKeys.columns.length > 1
  ) {
    const name = dropPrimaryKeys.options?.name || `${ast.name}_pkey`;
    prependAlterTable.push(`DROP CONSTRAINT "${name}"`);
  }

  prependAlterTable.push(
    ...dropForeignKeys.map(
      (foreignKey) => `\n DROP ${constraintToSql(ast, false, foreignKey)}`,
    ),
  );

  alterTable.unshift(...prependAlterTable);

  if (
    ast.add.primaryKey ||
    addPrimaryKeys.change ||
    addPrimaryKeys.columns.length > 1
  ) {
    alterTable.push(`ADD ${primaryKeyToSql(addPrimaryKeys)}`);
  }

  alterTable.push(
    ...addForeignKeys.map(
      (foreignKey) => `\n ADD ${constraintToSql(ast, true, foreignKey)}`,
    ),
  );

  if (alterTable.length) {
    queries.push({
      text:
        `ALTER TABLE ${quoteWithSchema(ast)}` +
        `\n  ${alterTable.join(',\n  ')}`,
      values,
    });
  }

  queries.push(...indexesToQuery(false, ast, dropIndexes));
  queries.push(...indexesToQuery(true, ast, addIndexes));
  queries.push(...commentsToQuery(ast, comments));

  return queries;
};
