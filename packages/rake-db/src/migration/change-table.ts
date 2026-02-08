import {
  Column,
  EnumColumn,
  parseTableDataInput,
  escapeString,
  TableData,
  TableDataMethods,
  tableDataMethods,
  UnknownColumn,
  DomainColumn,
  ArrayColumn,
  consumeColumnName,
  deepCompare,
  EmptyObject,
  RawSqlBase,
  RecordKeyTrue,
  RecordUnknown,
  setCurrentColumnName,
  setDefaultLanguage,
  snakeCaseKey,
  toArray,
  toSnakeCase,
} from 'pqb';
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
  quoteCustomType,
  quoteNameFromString,
  quoteWithSchema,
} from '../common';
import {
  addColumnComment,
  addColumnExclude,
  addColumnIndex,
  cmpRawSql,
  columnToSql,
  commentsToQuery,
  constraintToSql,
  encodeColumnDefault,
  excludesToQuery,
  getColumnName,
  identityToSql,
  indexesToQuery,
  interpolateSqlValues,
  nameColumnChecks,
  primaryKeyToSql,
} from './migration.utils';
import { tableMethods } from './table-methods';
import { TableQuery } from './create-table';
import { RakeDbConfig } from 'rake-db';

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

const addOrDropChanges: RakeDbAst.ChangeTableItem.Column[] = [];

// add column
function add(item: Column, options?: { dropMode?: DropMode }): SpecialChange;
// add primary key, index, etc
function add(emptyObject: EmptyObject): SpecialChange;
// add timestamps
function add(
  items: Record<string, Column>,
  options?: { dropMode?: DropMode },
): Record<string, RakeDbAst.ChangeTableItem.Column>;
function add(
  this: TableChangeMethods,
  item: Column | EmptyObject | Record<string, Column>,
  options?: { dropMode?: DropMode },
): undefined | EmptyObject | Record<string, RakeDbAst.ChangeTableItem.Column> {
  consumeColumnName();
  setName(this, item);

  if (item instanceof Column) {
    const result = addOrDrop('add', item, options);
    if (result.type === 'change') return result;
    addOrDropChanges.push(result);
    return (addOrDropChanges.length - 1) as unknown as EmptyObject;
  }

  for (const key in item) {
    // ...t.timestamps() case
    if (
      (item as Record<string, RakeDbAst.ChangeTableItem.Column>)[key] instanceof
      Column
    ) {
      const result: Record<string, RakeDbAst.ChangeTableItem.Column> = {};
      for (const key in item) {
        result[key] = {
          type: 'add',
          item: (item as Record<string, Column>)[key],
          dropMode: options?.dropMode,
        };
      }
      return result;
    }

    parseTableDataInput(changeTableData.add, item);
    break;
  }

  return undefined as never;
}

const drop = function (this: TableChangeMethods, item, options) {
  consumeColumnName();
  setName(this, item);

  if (item instanceof Column) {
    const result = addOrDrop('drop', item, options);
    if (result.type === 'change') return result;
    addOrDropChanges.push(result);
    return addOrDropChanges.length - 1;
  }

  for (const key in item) {
    // ...t.timestamps() case
    if (
      (item as unknown as Record<string, RakeDbAst.ChangeTableItem.Column>)[
        key
      ] instanceof Column
    ) {
      const result: Record<string, RakeDbAst.ChangeTableItem.Column> = {};
      for (const key in item) {
        result[key] = {
          type: 'drop',
          item: (item as Record<string, Column>)[key],
          dropMode: options?.dropMode,
        };
      }
      return result;
    }

    parseTableDataInput(changeTableData.drop, item);
    break;
  }

  return undefined as never;
} as typeof add;

const addOrDrop = (
  type: 'add' | 'drop',
  item: Column,
  options?: { dropMode?: DropMode },
): RakeDbAst.ChangeTableItem.Column | RakeDbAst.ChangeTableItem.Change => {
  if (item instanceof UnknownColumn) {
    const empty = columnTypeToColumnChange({
      type: 'change',
      to: {},
    });
    const add = columnTypeToColumnChange({
      type: 'change',
      to: {
        checks: item.data.checks,
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

interface Change extends RakeDbAst.ChangeTableItem.Change, ChangeOptions {}

type ChangeOptions = RakeDbAst.ChangeTableItem.ChangeUsing;

interface SpecialChange {
  type: SpecialChange;
}

interface OneWayChange {
  type: 'change';
  name?: string;
  to: RakeDbAst.ColumnChange;
  using?: RakeDbAst.ChangeTableItem.ChangeUsing;
}

const columnTypeToColumnChange = (
  item: Column | OneWayChange,
  name?: string,
): RakeDbAst.ColumnChange => {
  if (item instanceof Column) {
    let column = item;
    const foreignKeys = column.data.foreignKeys;
    if (foreignKeys?.some((it) => 'fn' in it)) {
      throw new Error('Callback in foreignKey is not allowed in migration');
    }

    if (name && !column.data.name) {
      column = Object.create(column);
      column.data = { ...column.data, name };
    }

    return {
      column: column,
      type: column.toSQL(),
      nullable: column.data.isNullable,
      ...column.data,
      primaryKey: column.data.primaryKey === undefined ? undefined : true,
      foreignKeys: foreignKeys as RakeDbAst.ColumnChange['foreignKeys'],
    };
  }

  return item.to;
};

const nameKey = Symbol('name');

const setName = (
  self: TableChangeMethods,
  item: RakeDbAst.ColumnChange | Column,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const name = (self as any)[nameKey];
  if (!name) return;

  if ('column' in item && item.column instanceof Column) {
    item.column.data.name ??= name;
  } else if (item instanceof Column) {
    item.data.name ??= name;
  } else {
    (item as RecordUnknown).name ??= name;
  }
};

type TableChangeMethods = typeof tableChangeMethods;
const tableChangeMethods = {
  ...tableMethods,
  ...(tableDataMethods as TableDataMethods<string>),
  name(name: string) {
    setCurrentColumnName(name);
    const types = Object.create(this);
    types[nameKey] = name;
    return types;
  },
  add,
  drop,
  change(
    from: Column | OneWayChange,
    to: Column | OneWayChange,
    using?: ChangeOptions,
  ): Change {
    consumeColumnName();
    const f = columnTypeToColumnChange(from);
    const t = columnTypeToColumnChange(to);
    setName(this, f);
    setName(this, t);

    return {
      type: 'change',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (this as any)[nameKey],
      from: f,
      to: t,
      using,
    };
  },
  default(value: unknown | RawSqlBase): OneWayChange {
    return { type: 'change', to: { default: value } };
  },
  nullable(): OneWayChange {
    return {
      type: 'change',
      to: { nullable: true },
    };
  },
  nonNullable(): OneWayChange {
    return {
      type: 'change',
      to: { nullable: false },
    };
  },
  comment(comment: string | null): OneWayChange {
    return { type: 'change', to: { comment } };
  },
  /**
   * Rename a column:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.changeTable('table', (t) => ({
   *     oldColumnName: t.rename('newColumnName'),
   *   }));
   * });
   * ```
   *
   * Note that the renaming `ALTER TABLE` is executed before the rest of alterations,
   * so if you're also adding a new constraint on this column inside the same `changeTable`,
   * refer to it with a new name.
   *
   * @param name
   */
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
  | SpecialChange
  | Column.Pick.Data
>;

export const changeTable = async <CT>(
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
  resetChangeTableData();

  const tableChanger = Object.create(
    migration.columnTypes as object,
  ) as TableChanger<CT>;
  Object.assign(tableChanger, tableChangeMethods);

  (tableChanger as { [snakeCaseKey]?: boolean })[snakeCaseKey] = snakeCase;

  addOrDropChanges.length = 0;
  const changeData = fn?.(tableChanger) || {};

  const ast = makeAst(
    migration.options,
    up,
    tableName,
    changeData,
    changeTableData,
    options,
  );

  const queries = astToQueries(migration.options, ast, snakeCase, language);
  for (const query of queries) {
    const result = await migration.adapter.arrays(interpolateSqlValues(query));
    query.then?.(result);
  }
};

const makeAst = (
  config: RakeDbConfig,
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
    let item = changeData[key] as
      | Change
      | RakeDbAst.ChangeTableItem.Rename
      | RakeDbAst.ChangeTableItem.Column;

    if (typeof item === 'number') {
      consumedChanges[item] = true;
      item = addOrDropChanges[item];
    } else if (item instanceof Column) {
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

  const [schema, table] = getSchemaAndTableFromName(config, name);

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

interface PrimaryKey extends TableData.PrimaryKey {
  change?: true;
}

const astToQueries = (
  config: RakeDbConfig,
  ast: RakeDbAst.ChangeTable,
  snakeCase?: boolean,
  language?: string,
): TableQuery[] => {
  const queries: TableQuery[] = [];

  if (ast.comment !== undefined) {
    queries.push({
      text: `COMMENT ON TABLE ${quoteWithSchema(ast)} IS ${
        ast.comment === null
          ? 'NULL'
          : escapeString(
              typeof ast.comment === 'string' ? ast.comment : ast.comment[1],
            )
      }`,
    });
  }

  const addPrimaryKeys: PrimaryKey = {
    columns: [],
  };

  const dropPrimaryKeys: PrimaryKey = {
    columns: [],
  };

  for (const key in ast.shape) {
    const item = ast.shape[key];
    if (Array.isArray(item)) {
      for (const it of item) {
        handlePrerequisitesForTableItem(
          config,
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
        config,
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
    addPrimaryKeys.name = ast.add.primaryKey.name;
    const { columns } = ast.add.primaryKey;
    addPrimaryKeys.columns.push(
      ...(snakeCase ? columns.map(toSnakeCase) : columns),
    );
  }

  if (ast.drop.primaryKey) {
    dropPrimaryKeys.name = ast.drop.primaryKey.name;
    const { columns } = ast.drop.primaryKey;
    dropPrimaryKeys.columns.push(
      ...(snakeCase ? columns.map(toSnakeCase) : columns),
    );
  }

  const alterTable: string[] = [];
  const renameItems: string[] = [];
  const values: unknown[] = [];
  const addIndexes = ast.add.indexes ?? [];
  const dropIndexes = ast.drop.indexes ?? [];
  const addExcludes = ast.add.excludes ?? [];
  const dropExcludes = ast.drop.excludes ?? [];
  const addConstraints = ast.add.constraints ?? [];
  const dropConstraints = ast.drop.constraints ?? [];

  const comments: ColumnComment[] = [];

  for (const key in ast.shape) {
    const item = ast.shape[key];
    if (Array.isArray(item)) {
      for (const it of item) {
        handleTableItemChange(
          config,
          key,
          it,
          ast,
          alterTable,
          renameItems,
          values,
          addPrimaryKeys,
          addIndexes,
          dropIndexes,
          addExcludes,
          dropExcludes,
          addConstraints,
          dropConstraints,
          comments,
          snakeCase,
        );
      }
    } else {
      handleTableItemChange(
        config,
        key,
        item,
        ast,
        alterTable,
        renameItems,
        values,
        addPrimaryKeys,
        addIndexes,
        dropIndexes,
        addExcludes,
        dropExcludes,
        addConstraints,
        dropConstraints,
        comments,
        snakeCase,
      );
    }
  }

  const prependAlterTable: string[] = [];

  if (
    dropPrimaryKeys.change &&
    addPrimaryKeys.change &&
    dropPrimaryKeys.name === addPrimaryKeys.name &&
    dropPrimaryKeys.columns.length === addPrimaryKeys.columns.length &&
    dropPrimaryKeys.columns.every(
      (column, i) => column === addPrimaryKeys.columns[i],
    )
  ) {
    dropPrimaryKeys.change = addPrimaryKeys.change = undefined;
    dropPrimaryKeys.columns.length = addPrimaryKeys.columns.length = 0;
  }

  if (
    ast.drop.primaryKey ||
    dropPrimaryKeys.change ||
    dropPrimaryKeys.columns.length > 1
  ) {
    const name = dropPrimaryKeys.name || `${ast.name}_pkey`;
    prependAlterTable.push(`DROP CONSTRAINT "${name}"`);
  }

  prependAlterTable.push(
    ...dropConstraints.map(
      (foreignKey) =>
        `\n DROP ${constraintToSql(
          config,
          ast,
          false,
          foreignKey,
          values,
          snakeCase,
        )}`,
    ),
  );

  alterTable.unshift(...prependAlterTable);

  if (
    ast.add.primaryKey ||
    addPrimaryKeys.change ||
    addPrimaryKeys.columns.length > 1
  ) {
    addPrimaryKeys.columns = [...new Set(addPrimaryKeys.columns)];

    alterTable.push(
      `ADD ${primaryKeyToSql(
        snakeCase
          ? {
              name: addPrimaryKeys.name,
              columns: addPrimaryKeys.columns.map(toSnakeCase),
            }
          : addPrimaryKeys,
      )}`,
    );
  }

  alterTable.push(
    ...addConstraints.map(
      (foreignKey) =>
        `\n ADD ${constraintToSql(
          config,
          ast,
          true,
          foreignKey,
          values,
          snakeCase,
        )}`,
    ),
  );

  const tableName = quoteWithSchema(ast);
  if (renameItems.length) {
    queries.push(
      ...renameItems.map((sql) => ({
        text: `ALTER TABLE ${tableName}
  ${sql}`,
        values,
      })),
    );
  }

  if (alterTable.length) {
    queries.push(alterTableSql(tableName, alterTable, values));
  }

  queries.push(
    ...indexesToQuery(config, false, ast, dropIndexes, snakeCase, language),
  );
  queries.push(
    ...indexesToQuery(config, true, ast, addIndexes, snakeCase, language),
  );
  queries.push(...excludesToQuery(config, false, ast, dropExcludes, snakeCase));
  queries.push(...excludesToQuery(config, true, ast, addExcludes, snakeCase));
  queries.push(...commentsToQuery(ast, comments));

  return queries;
};

const alterTableSql = (
  tableName: string,
  lines: string[],
  values: unknown[],
) => ({
  text: `ALTER TABLE ${tableName}
  ${lines.join(',\n  ')}`,
  values,
});

const handlePrerequisitesForTableItem = (
  config: RakeDbConfig,
  key: string,
  item: RakeDbAst.ChangeTableItem,
  queries: TableQuery[],
  addPrimaryKeys: PrimaryKey,
  dropPrimaryKeys: PrimaryKey,
  snakeCase?: boolean,
) => {
  if ('item' in item) {
    const { item: column } = item;
    if (column instanceof EnumColumn) {
      queries.push(makePopulateEnumQuery(config, column));
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
      queries.push(makePopulateEnumQuery(config, item.from.column));
    }

    if (item.to.column instanceof EnumColumn) {
      queries.push(makePopulateEnumQuery(config, item.to.column));
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
  config: RakeDbConfig,
  key: string,
  item: RakeDbAst.ChangeTableItem,
  ast: RakeDbAst.ChangeTable,
  alterTable: string[],
  renameItems: string[],
  values: unknown[],
  addPrimaryKeys: PrimaryKey,
  addIndexes: TableData.Index[],
  dropIndexes: TableData.Index[],
  addExcludes: TableData.Exclude[],
  dropExcludes: TableData.Exclude[],
  addConstraints: TableData.Constraint[],
  dropConstraints: TableData.Constraint[],
  comments: ColumnComment[],
  snakeCase?: boolean,
) => {
  if (item.type === 'add') {
    const column = item.item;
    const name = getColumnName(column, key, snakeCase);
    addColumnIndex(addIndexes, name, column);
    addColumnExclude(addExcludes, name, column);
    addColumnComment(comments, name, column);

    alterTable.push(
      `ADD COLUMN ${columnToSql(
        config,
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
    const name = getChangeColumnName('to', item, key, snakeCase);
    const fromName = getChangeColumnName('from', item, key, snakeCase);

    if (fromName !== name) {
      renameItems.push(renameColumnSql(fromName, name));
    }

    let changeType = false;
    if (to.type && (from.type !== to.type || from.collate !== to.collate)) {
      changeType = true;

      const type =
        !to.column || to.column.data.isOfCustomType
          ? to.column && to.column instanceof DomainColumn
            ? quoteNameFromString(config, to.type)
            : quoteCustomType(config, to.type)
          : to.type;

      const using = item.using?.usingUp
        ? ` USING ${item.using.usingUp.toSQL({ values })}`
        : to.column instanceof EnumColumn
        ? ` USING "${name}"::text::${type}`
        : to.column instanceof ArrayColumn
        ? ` USING "${name}"::text[]::${type}`
        : '';

      alterTable.push(
        `ALTER COLUMN "${name}" TYPE ${type}${
          to.collate
            ? ` COLLATE ${quoteNameFromString(config, to.collate)}`
            : ''
        }${using}`,
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
          `ALTER COLUMN "${name}" ADD ${identityToSql(config, to.identity)}`,
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

    const fromChecks =
      from.checks && nameColumnChecks(ast.name, fromName, from.checks);
    const toChecks = to.checks && nameColumnChecks(ast.name, name, to.checks);

    fromChecks?.forEach((fromCheck) => {
      if (!toChecks?.some((toCheck) => cmpRawSql(fromCheck.sql, toCheck.sql))) {
        alterTable.push(`DROP CONSTRAINT "${fromCheck.name}"`);
      }
    });

    toChecks?.forEach((toCheck) => {
      if (
        !fromChecks?.some((fromCheck) => cmpRawSql(fromCheck.sql, toCheck.sql))
      ) {
        alterTable.push(
          `ADD CONSTRAINT "${toCheck.name}"\n    CHECK (${toCheck.sql.toSQL({
            values,
          })})`,
        );
      }
    });

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
          fromFkey.options?.name !== toFkey.options?.name ||
          fromFkey.options?.match !== toFkey.options?.match ||
          fromFkey.options?.onUpdate !== toFkey.options?.onUpdate ||
          fromFkey.options?.onDelete !== toFkey.options?.onDelete ||
          fromFkey.options?.dropMode !== toFkey.options?.dropMode ||
          (fromFkey.fnOrTable as string) !== (toFkey.fnOrTable as string))
      ) {
        if (fromFkey) {
          dropConstraints.push({
            name: fromFkey.options?.name,
            dropMode: fromFkey.options?.dropMode,
            references: {
              columns: [name],
              ...fromFkey,
              foreignColumns: snakeCase
                ? fromFkey.foreignColumns.map(toSnakeCase)
                : fromFkey.foreignColumns,
            },
          });
        }

        if (toFkey) {
          addConstraints.push({
            name: toFkey.options?.name,
            dropMode: toFkey.options?.dropMode,
            references: {
              columns: [name],
              ...toFkey,
              foreignColumns: snakeCase
                ? toFkey.foreignColumns.map(toSnakeCase)
                : toFkey.foreignColumns,
            },
          });
        }
      }
    }

    pushIndexesOrExcludes('indexes', from, to, name, addIndexes, dropIndexes);
    pushIndexesOrExcludes(
      'excludes',
      from,
      to,
      name,
      addExcludes,
      dropExcludes,
    );

    if (from.comment !== to.comment) {
      comments.push({ column: name, comment: to.comment || null });
    }
  } else if (item.type === 'rename') {
    renameItems.push(
      snakeCase
        ? renameColumnSql(toSnakeCase(key), toSnakeCase(item.name))
        : renameColumnSql(key, item.name),
    );
  }
};

const pushIndexesOrExcludes = <T extends TableData.Index | TableData.Exclude>(
  key: 'indexes' | 'excludes',
  from: RakeDbAst.ColumnChange,
  to: RakeDbAst.ColumnChange,
  name: string,
  add: T[],
  drop: T[],
) => {
  const len = Math.max(from[key]?.length || 0, to[key]?.length || 0);
  for (let i = 0; i < len; i++) {
    const fromItem = from[key]?.[i];
    const toItem = to[key]?.[i];

    if (
      (fromItem || toItem) &&
      (!fromItem || !toItem || !deepCompare(fromItem, toItem))
    ) {
      if (fromItem) {
        drop.push({
          ...fromItem,
          columns: [
            {
              column: name,
              ...fromItem.options,
              with: (fromItem as TableData.ColumnExclude).with,
            },
          ],
        } as T);
      }

      if (toItem) {
        add.push({
          ...toItem,
          columns: [
            {
              column: name,
              ...toItem.options,
              with: (toItem as TableData.ColumnExclude).with,
            },
          ],
        } as T);
      }
    }
  }
};

const getChangeColumnName = (
  what: 'from' | 'to',
  change: RakeDbAst.ChangeTableItem.Change,
  key: string,
  snakeCase?: boolean,
) => {
  return (
    change.name ||
    (change[what].column
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        getColumnName(change[what].column!, key, snakeCase)
      : snakeCase
      ? toSnakeCase(key)
      : key)
  );
};

const renameColumnSql = (from: string, to: string) => {
  return `RENAME COLUMN "${from}" TO "${to}"`;
};
