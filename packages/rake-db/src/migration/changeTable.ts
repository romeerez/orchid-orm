import {
  ColumnType,
  resetTableData,
  getTableData,
  TableData,
  quote,
  EnumColumn,
  UnknownColumn,
  columnTypes,
} from 'pqb';
import {
  EmptyObject,
  emptyObject,
  ColumnTypesBase,
  snakeCaseKey,
  toSnakeCase,
  deepCompare,
  consumeColumnName,
  RawSQLBase,
  isRawSQL,
  setDefaultLanguage,
  ColumnTypeBase,
} from 'orchid-core';
import {
  ChangeTableCallback,
  ChangeTableOptions,
  ColumnComment,
  DropMode,
  Migration,
  MigrationColumnTypes,
} from './migration';
import { RakeDbAst } from '../ast';
import {
  getSchemaAndTableFromName,
  makePopulateEnumQuery,
  quoteNameFromString,
  quoteWithSchema,
} from '../common';
import {
  addColumnComment,
  addColumnIndex,
  columnToSql,
  commentsToQuery,
  constraintToSql,
  getColumnName,
  identityToSql,
  indexesToQuery,
  primaryKeyToSql,
} from './migrationUtils';
import { tableMethods } from './tableMethods';
import { TableQuery } from './createTable';

type ChangeTableData = { add: TableData; drop: TableData };
const newChangeTableData = (): ChangeTableData => ({
  add: {},
  drop: {},
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
  a.indexes = [...(a.indexes || []), ...(b.indexes || [])];
  a.constraints = [...(a.constraints || []), ...(b.constraints || [])];
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
    return addOrDrop('add', item, options);
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

const drop = function (item, options) {
  if (item instanceof ColumnType) {
    return addOrDrop('drop', item, options);
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
} as typeof add;

const addOrDrop = (
  type: 'add' | 'drop',
  item: ColumnType,
  options?: { dropMode?: DropMode },
): RakeDbAst.ChangeTableItem => {
  const name = consumeColumnName();
  if (name) {
    item.data.name = name;
  }

  if (item instanceof UnknownColumn) {
    const empty = columnTypeToColumnChange({
      type: 'change',
      from: {},
      to: {},
    });
    const add = columnTypeToColumnChange({
      type: 'change',
      from: {},
      to: {
        check: item.data.check,
      },
    });

    return {
      type: 'change',
      from: type === 'add' ? empty : add,
      to: type === 'add' ? add : empty,
      ...options,
    };
  }

  return {
    type,
    item,
    dropMode: options?.dropMode,
  };
};

type Change = RakeDbAst.ChangeTableItem.Change & ChangeOptions;

type ChangeOptions = {
  usingUp?: RawSQLBase;
  usingDown?: RawSQLBase;
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
      primaryKey: item.data.isPrimaryKey,
      ...item.data,
      foreignKeys: foreignKeys as RakeDbAst.ColumnChange['foreignKeys'],
    };
  }

  return item.to;
};

const nameKey = Symbol('name');

type TableChangeMethods = typeof tableChangeMethods;
const tableChangeMethods = {
  ...tableMethods,
  name(this: ColumnTypesBase, name: string) {
    const types = Object.create(columnTypes.name.call(this, name));
    types[nameKey] = name;
    return types;
  },
  add,
  drop,
  change(
    this: ColumnTypesBase,
    from: ColumnType | Change,
    to: ColumnType | Change,
    options?: ChangeOptions,
  ): Change {
    return {
      type: 'change',
      name: (this as { [nameKey]?: string })[nameKey],
      from: columnTypeToColumnChange(from),
      to: columnTypeToColumnChange(to),
      ...options,
    };
  },
  default(value: unknown | RawSQLBase): Change {
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

export type TableChanger<CT extends ColumnTypesBase> =
  MigrationColumnTypes<CT> & TableChangeMethods;

export type TableChangeData = Record<
  string,
  | RakeDbAst.ChangeTableItem.Column
  | RakeDbAst.ChangeTableItem.Rename
  | Change
  | EmptyObject
>;

export const changeTable = async <CT extends ColumnTypesBase>(
  migration: Migration<CT>,
  up: boolean,
  tableName: string,
  options: ChangeTableOptions,
  fn?: ChangeTableCallback<CT>,
): Promise<void> => {
  const snakeCase =
    'snakeCase' in options ? options.snakeCase : migration.options.snakeCase;
  const language =
    'language' in options ? options.language : migration.options.language;

  setDefaultLanguage(language);
  resetTableData();
  resetChangeTableData();

  const tableChanger = Object.create(migration.columnTypes) as TableChanger<CT>;
  Object.assign(tableChanger, tableChangeMethods);

  (tableChanger as { [snakeCaseKey]?: boolean })[snakeCaseKey] = snakeCase;

  const changeData = fn?.(tableChanger) || {};

  const ast = makeAst(up, tableName, changeData, changeTableData, options);

  const queries = astToQueries(ast, snakeCase, language);
  for (const query of queries) {
    const result = await migration.adapter.arrays(query);
    query.then?.(result);
  }

  migration.migratedAsts.push(ast);
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
    let item = changeData[key];
    if (item instanceof ColumnTypeBase) {
      item = add(item);
    }

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

const astToQueries = (
  ast: RakeDbAst.ChangeTable,
  snakeCase?: boolean,
  language?: string,
): TableQuery[] => {
  const queries: TableQuery[] = [];

  if (ast.comment !== undefined) {
    queries.push({
      text: `COMMENT ON TABLE ${quoteWithSchema(ast)} IS ${quote(ast.comment)}`,
    });
  }

  const addPrimaryKeys: PrimaryKeys = {
    columns: [],
  };

  const dropPrimaryKeys: PrimaryKeys = {
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
      if (item.item.data.isPrimaryKey) {
        addPrimaryKeys.columns.push(getColumnName(item.item, key, snakeCase));
      }
    } else if (item.type === 'drop') {
      if (item.item.data.isPrimaryKey) {
        dropPrimaryKeys.columns.push(getColumnName(item.item, key, snakeCase));
      }
    } else if (item.type === 'change') {
      if (item.from.column instanceof EnumColumn) {
        queries.push(makePopulateEnumQuery(item.from.column));
      }

      if (item.to.column instanceof EnumColumn) {
        queries.push(makePopulateEnumQuery(item.to.column));
      }

      if (item.from.primaryKey) {
        dropPrimaryKeys.columns.push(
          item.from.column
            ? getColumnName(item.from.column, key, snakeCase)
            : snakeCase
            ? toSnakeCase(key)
            : key,
        );
        dropPrimaryKeys.change = true;
      }

      if (item.to.primaryKey) {
        addPrimaryKeys.columns.push(
          item.to.column
            ? getColumnName(item.to.column, key, snakeCase)
            : snakeCase
            ? toSnakeCase(key)
            : key,
        );
        addPrimaryKeys.change = true;
      }
    }
  }

  if (ast.add.primaryKey) {
    addPrimaryKeys.options = ast.add.primaryKey.options;
    addPrimaryKeys.columns.push(...ast.add.primaryKey.columns);
  }

  if (ast.drop.primaryKey) {
    dropPrimaryKeys.options = ast.drop.primaryKey.options;
    dropPrimaryKeys.columns.push(...ast.drop.primaryKey.columns);
  }

  const alterTable: string[] = [];
  const values: unknown[] = [];
  const addIndexes = mapIndexesForSnakeCase(ast.add.indexes, snakeCase);

  const dropIndexes = mapIndexesForSnakeCase(ast.drop.indexes, snakeCase);

  const addConstraints = mapConstraintsToSnakeCase(
    ast.add.constraints,
    snakeCase,
  );

  const dropConstraints = mapConstraintsToSnakeCase(
    ast.drop.constraints,
    snakeCase,
  );

  const comments: ColumnComment[] = [];

  for (const key in ast.shape) {
    const item = ast.shape[key];

    if (item.type === 'add') {
      const column = item.item;
      const name = getColumnName(column, key, snakeCase);
      addColumnIndex(addIndexes, name, column);
      addColumnComment(comments, name, column);

      alterTable.push(
        `ADD COLUMN ${columnToSql(
          name,
          column,
          values,
          addPrimaryKeys.columns.length > 1,
          snakeCase,
        )}`,
      );
    } else if (item.type === 'drop') {
      const name = getColumnName(item.item, key, snakeCase);

      alterTable.push(
        `DROP COLUMN "${name}"${item.dropMode ? ` ${item.dropMode}` : ''}`,
      );
    } else if (item.type === 'change') {
      const { from, to } = item;
      const name = getChangeColumnName(item, key, snakeCase);

      let changeType = false;
      if (to.type && (from.type !== to.type || from.collate !== to.collate)) {
        changeType = true;

        const type =
          !to.column || to.column.data.isOfCustomType
            ? `"${to.type}"`
            : to.type;

        alterTable.push(
          `ALTER COLUMN "${name}" TYPE ${type}${
            to.collate ? ` COLLATE ${quoteNameFromString(to.collate)}` : ''
          }${item.using ? ` USING ${item.using.toSQL({ values })}` : ''}`,
        );
      }

      if (
        typeof from.identity !== typeof to.identity ||
        !deepCompare(from.identity, to.identity)
      ) {
        alterTable.push(
          `ALTER COLUMN "${name}" ${
            to.identity ? `ADD ${identityToSql(to.identity)}` : `DROP IDENTITY`
          }`,
        );
      }

      if (from.default !== to.default) {
        const value =
          to.default === undefined ||
          to.default === null ||
          typeof to.default === 'function'
            ? null
            : typeof to.default === 'object' && isRawSQL(to.default)
            ? to.default.toSQL({ values })
            : quote(to.default);

        // when changing type, need to first drop an existing default before setting a new one
        if (changeType && value !== null) {
          alterTable.push(`ALTER COLUMN "${name}" DROP DEFAULT`);
        }

        const expr = value === null ? 'DROP DEFAULT' : `SET DEFAULT ${value}`;

        alterTable.push(`ALTER COLUMN "${name}" ${expr}`);
      }

      if (from.nullable !== to.nullable) {
        alterTable.push(
          `ALTER COLUMN "${name}" ${to.nullable ? 'DROP' : 'SET'} NOT NULL`,
        );
      }

      if (from.compression !== to.compression) {
        alterTable.push(
          `ALTER COLUMN "${name}" SET COMPRESSION ${
            to.compression || 'DEFAULT'
          }`,
        );
      }

      if (from.check !== to.check) {
        const checkName = `${ast.name}_${name}_check`;
        if (from.check) {
          alterTable.push(`DROP CONSTRAINT "${checkName}"`);
        }
        if (to.check) {
          alterTable.push(
            `ADD CONSTRAINT "${checkName}"\n    CHECK (${to.check.toSQL({
              values,
            })})`,
          );
        }
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
            dropConstraints.push({
              name: fromFkey.name,
              dropMode: fromFkey.dropMode,
              references: {
                columns: [name],
                fnOrTable: fromFkey.table,
                foreignColumns: snakeCase
                  ? fromFkey.columns.map(toSnakeCase)
                  : fromFkey.columns,
                options: fromFkey,
              },
            });
          }

          if (toFkey) {
            addConstraints.push({
              name: toFkey.name,
              dropMode: toFkey.dropMode,
              references: {
                columns: [name],
                fnOrTable: toFkey.table,
                foreignColumns: snakeCase
                  ? toFkey.columns.map(toSnakeCase)
                  : toFkey.columns,
                options: toFkey,
              },
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
                  column: name,
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
                  column: name,
                  ...toIndex,
                },
              ],
              options: toIndex,
            });
          }
        }
      }

      if (from.comment !== to.comment) {
        comments.push({ column: name, comment: to.comment || null });
      }
    } else if (item.type === 'rename') {
      alterTable.push(
        `RENAME COLUMN "${snakeCase ? toSnakeCase(key) : key}" TO "${
          snakeCase ? toSnakeCase(item.name) : item.name
        }"`,
      );
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
    ...dropConstraints.map(
      (foreignKey) =>
        `\n DROP ${constraintToSql(ast, false, foreignKey, values, snakeCase)}`,
    ),
  );

  alterTable.unshift(...prependAlterTable);

  if (
    ast.add.primaryKey ||
    addPrimaryKeys.change ||
    addPrimaryKeys.columns.length > 1
  ) {
    alterTable.push(
      `ADD ${primaryKeyToSql(
        snakeCase
          ? {
              options: addPrimaryKeys.options,
              columns: addPrimaryKeys.columns.map(toSnakeCase),
            }
          : addPrimaryKeys,
      )}`,
    );
  }

  alterTable.push(
    ...addConstraints.map(
      (foreignKey) =>
        `\n ADD ${constraintToSql(ast, true, foreignKey, values, snakeCase)}`,
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

  queries.push(...indexesToQuery(false, ast, dropIndexes, language));
  queries.push(...indexesToQuery(true, ast, addIndexes, language));
  queries.push(...commentsToQuery(ast, comments));

  return queries;
};

const getChangeColumnName = (
  change: RakeDbAst.ChangeTableItem.Change,
  key: string,
  snakeCase?: boolean,
) => {
  return (
    change.name ||
    (change.to.column
      ? getColumnName(change.to.column, key, snakeCase)
      : snakeCase
      ? toSnakeCase(key)
      : key)
  );
};

const mapIndexesForSnakeCase = (
  indexes?: TableData.Index[],
  snakeCase?: boolean,
): TableData.Index[] => {
  return (
    indexes?.map((index) => ({
      options: index.options,
      columns: snakeCase
        ? index.columns.map((item) =>
            'column' in item
              ? { ...item, column: toSnakeCase(item.column) }
              : item,
          )
        : index.columns,
    })) || []
  );
};

const mapConstraintsToSnakeCase = (
  foreignKeys?: TableData.Constraint[],
  snakeCase?: boolean,
): TableData.Constraint[] => {
  return (
    foreignKeys?.map((item) => ({
      ...item,
      references: item.references
        ? snakeCase
          ? {
              ...item.references,
              columns: item.references.columns.map(toSnakeCase),
            }
          : item.references
        : undefined,
    })) || []
  );
};
