import {
  ColumnType,
  EnumColumn,
  getTableData,
  quote,
  resetTableData,
  TableData,
  UnknownColumn,
} from 'pqb';
import {
  consumeColumnName,
  deepCompare,
  EmptyObject,
  emptyObject,
  RawSQLBase,
  RecordKeyTrue,
  setCurrentColumnName,
  setDefaultLanguage,
  snakeCaseKey,
  toArray,
  toSnakeCase,
} from 'orchid-core';
import {
  ChangeTableCallback,
  ChangeTableOptions,
  ColumnComment,
  DropMode,
  Migration,
  MigrationColumnTypes,
  RakeDbColumnTypes,
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
  encodeColumnDefault,
  getColumnName,
  identityToSql,
  indexesToQuery,
  primaryKeyToSql,
} from './migrationUtils';
import { tableMethods } from './tableMethods';
import { TableQuery } from './createTable';

interface ChangeTableData {
  add: TableData;
  drop: TableData;
}

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

const addOrDropChanges: RakeDbAst.ChangeTableItem.Column[] = [];

function add(item: ColumnType, options?: { dropMode?: DropMode }): number;
function add(emptyObject: EmptyObject): EmptyObject;
function add(
  items: Record<string, ColumnType>,
  options?: { dropMode?: DropMode },
): Record<string, RakeDbAst.ChangeTableItem.Column>;
function add(
  item: ColumnType | EmptyObject | Record<string, ColumnType>,
  options?: { dropMode?: DropMode },
): number | EmptyObject | Record<string, RakeDbAst.ChangeTableItem.Column> {
  if (item instanceof ColumnType) {
    const result = addOrDrop('add', item, options);
    if (result.type === 'change') return result;
    addOrDropChanges.push(result);
    return addOrDropChanges.length - 1;
  } else if (item === emptyObject) {
    mergeTableData(changeTableData.add, getTableData());
    resetTableData();
    return emptyObject;
  } else {
    // ...t.timestamps() case
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
    const result = addOrDrop('drop', item, options);
    if (result.type === 'change') return result;
    addOrDropChanges.push(result);
    return addOrDropChanges.length - 1;
  } else if (item === emptyObject) {
    mergeTableData(changeTableData.drop, getTableData());
    resetTableData();
    return emptyObject;
  } else {
    // ...t.timestamps() case
    const result: Record<string, RakeDbAst.ChangeTableItem.Column> = {};
    for (const key in item as any) {
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
): RakeDbAst.ChangeTableItem.Column | RakeDbAst.ChangeTableItem.Change => {
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

type ChangeOptions = RakeDbAst.ChangeTableItem.ChangeUsing;

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
      ...item.data,
      primaryKey: item.data.primaryKey === undefined ? undefined : true,
      foreignKeys: foreignKeys as RakeDbAst.ColumnChange['foreignKeys'],
    };
  }

  return item.to;
};

const nameKey = Symbol('name');

type TableChangeMethods = typeof tableChangeMethods;
const tableChangeMethods = {
  ...tableMethods,
  name(this: RakeDbColumnTypes, name: string) {
    setCurrentColumnName(name);
    const types = Object.create(this);
    types[nameKey] = name;
    return types;
  },
  add,
  drop,
  change(
    from: ColumnType | Change,
    to: ColumnType | Change,
    using?: ChangeOptions,
  ): Change {
    return {
      type: 'change',
      name: (this as { [nameKey]?: string })[nameKey],
      from: columnTypeToColumnChange(from),
      to: columnTypeToColumnChange(to),
      using,
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

export type TableChanger<CT> = MigrationColumnTypes<CT> & TableChangeMethods;

export type TableChangeData = Record<
  string,
  | RakeDbAst.ChangeTableItem.Column
  | RakeDbAst.ChangeTableItem.Rename
  | Change
  | EmptyObject
>;

export const changeTable = async <CT extends RakeDbColumnTypes>(
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

  const tableChanger = Object.create(
    migration.columnTypes as object,
  ) as TableChanger<CT>;
  Object.assign(tableChanger, tableChangeMethods);

  (tableChanger as { [snakeCaseKey]?: boolean })[snakeCaseKey] = snakeCase;

  addOrDropChanges.length = 0;
  const changeData = fn?.(tableChanger) || {};

  const ast = makeAst(up, tableName, changeData, changeTableData, options);

  const queries = astToQueries(ast, snakeCase, language);
  for (const query of queries) {
    const result = await migration.adapter.arrays(query);
    query.then?.(result);
  }
};

const makeAst = (
  up: boolean,
  name: string,
  changeData: TableChangeData,
  changeTableData: ChangeTableData,
  options: ChangeTableOptions,
): RakeDbAst.ChangeTable => {
  const { comment } = options;

  const shape: RakeDbAst.ChangeTableShape = {};
  const consumedChanges: RecordKeyTrue = {};
  for (const key in changeData) {
    let item = changeData[key];
    if (typeof item === 'number') {
      consumedChanges[item] = true;
      item = addOrDropChanges[item];
    } else if (item instanceof ColumnType) {
      item = addOrDrop('add', item);
    }

    if ('type' in item) {
      if (up) {
        shape[key] = item;
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
              ? {
                  ...item,
                  from: item.to,
                  to: item.from,
                  using: item.using && {
                    usingUp: item.using.usingDown,
                    usingDown: item.using.usingUp,
                  },
                }
              : item;
        }
      }
    }
  }

  for (let i = 0; i < addOrDropChanges.length; i++) {
    if (consumedChanges[i]) continue;

    const change = addOrDropChanges[i];
    const name = change.item.data.name;
    if (!name) {
      throw new Error(`Column in ...t.${change.type}() must have a name`);
    }

    const arr = shape[name] ? toArray(shape[name]) : [];
    arr[up ? 'push' : 'unshift'](
      up ? change : { ...change, type: change.type === 'add' ? 'drop' : 'add' },
    );
    shape[name] = arr;
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

interface PrimaryKeys {
  columns: string[];
  change?: true;
  options?: { name?: string };
}

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
    if (Array.isArray(item)) {
      for (const it of item) {
        handlePrerequisitesForTableItem(
          key,
          it,
          queries,
          addPrimaryKeys,
          dropPrimaryKeys,
          snakeCase,
        );
      }
    } else {
      handlePrerequisitesForTableItem(
        key,
        item,
        queries,
        addPrimaryKeys,
        dropPrimaryKeys,
        snakeCase,
      );
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
    if (Array.isArray(item)) {
      for (const it of item) {
        handleTableItemChange(
          key,
          it,
          ast,
          alterTable,
          values,
          addPrimaryKeys,
          addIndexes,
          dropIndexes,
          addConstraints,
          dropConstraints,
          comments,
          snakeCase,
        );
      }
    } else {
      handleTableItemChange(
        key,
        item,
        ast,
        alterTable,
        values,
        addPrimaryKeys,
        addIndexes,
        dropIndexes,
        addConstraints,
        dropConstraints,
        comments,
        snakeCase,
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

const handlePrerequisitesForTableItem = (
  key: string,
  item: RakeDbAst.ChangeTableItem,
  queries: TableQuery[],
  addPrimaryKeys: PrimaryKeys,
  dropPrimaryKeys: PrimaryKeys,
  snakeCase?: boolean,
) => {
  if ('item' in item) {
    const { item: column } = item;
    if (column instanceof EnumColumn) {
      queries.push(makePopulateEnumQuery(column));
    }
  }

  if (item.type === 'add') {
    if (item.item.data.primaryKey) {
      addPrimaryKeys.columns.push(getColumnName(item.item, key, snakeCase));
    }
  } else if (item.type === 'drop') {
    if (item.item.data.primaryKey) {
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
};

const handleTableItemChange = (
  key: string,
  item: RakeDbAst.ChangeTableItem,
  ast: RakeDbAst.ChangeTable,
  alterTable: string[],
  values: unknown[],
  addPrimaryKeys: PrimaryKeys,
  addIndexes: TableData.Index[],
  dropIndexes: TableData.Index[],
  addConstraints: TableData.Constraint[],
  dropConstraints: TableData.Constraint[],
  comments: ColumnComment[],
  snakeCase?: boolean,
) => {
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
          ? quoteNameFromString(to.type)
          : to.type;

      alterTable.push(
        `ALTER COLUMN "${name}" TYPE ${type}${
          to.collate ? ` COLLATE ${quoteNameFromString(to.collate)}` : ''
        }${
          item.using?.usingUp
            ? ` USING ${item.using.usingUp.toSQL({ values })}`
            : to.column instanceof EnumColumn
            ? ` USING "${name}"::text::${type}`
            : ''
        }`,
      );
    }

    if (
      typeof from.identity !== typeof to.identity ||
      !deepCompare(from.identity, to.identity)
    ) {
      if (from.identity) {
        alterTable.push(`ALTER COLUMN "${name}" DROP IDENTITY`);
      }

      if (to.identity) {
        alterTable.push(
          `ALTER COLUMN "${name}" ADD ${identityToSql(to.identity)}`,
        );
      }
    }

    if (from.default !== to.default) {
      const value = encodeColumnDefault(to.default, values, to.column);

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
        `ALTER COLUMN "${name}" SET COMPRESSION ${to.compression || 'DEFAULT'}`,
      );
    }

    if (from.check !== to.check) {
      const checkName = `${ast.name}_${name}_check`;
      if (from.check) {
        alterTable.push(`DROP CONSTRAINT "${checkName}"`);
      }
      if (to.check) {
        alterTable.push(
          `ADD CONSTRAINT "${checkName}"\n    CHECK (${to.check.sql.toSQL({
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
