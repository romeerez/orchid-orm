import {
  AnyRakeDbConfig,
  RakeDbAst,
  getIndexName,
  DbStructure,
  getExcludeName,
} from 'rake-db';
import {
  Column,
  SearchWeight,
  TableData,
  deepCompare,
  MaybeArray,
  RecordUnknown,
  toArray,
  toSnakeCase,
} from 'pqb';
import { ChangeTableData } from './tables.generator';
import { checkForColumnAddOrDrop, CompareExpression } from './generators.utils';
import { CodeTable } from '../generate';

interface CodeItem {
  columnKeys: TableData.Index.ColumnOrExpressionOptions[];
  includeKeys?: MaybeArray<string>;
}

interface CodeIndex extends TableData.Index, CodeItem {}
interface CodeExclude extends TableData.Exclude, CodeItem {}

interface CodeItems {
  indexes: CodeIndex[];
  excludes: CodeExclude[];
}

interface ComparableIndexColumn {
  column?: string;
  collate?: string;
  opclass?: string;
  order?: string;
  weight?: SearchWeight;
  hasExpression: boolean;
}

interface ComparableIndex {
  name?: string;
  using?: string;
  unique?: boolean;
  include?: string[];
  nullsNotDistinct?: boolean;
  tablespace?: string;
  tsVector?: boolean;
  language?: string;
  languageColumn?: string;
  columns: ComparableIndexColumn[];
  hasWith: boolean;
  hasWhere: boolean;
  hasExpression: boolean;
  columnKeys?: string[];
  includeKeys?: string[];
}

interface ComparableExcludeColumn extends ComparableIndexColumn {
  with: string;
}

interface ComparableExclude extends ComparableIndex {
  columns: ComparableExcludeColumn[];
}

interface ComparableItems {
  indexes: ComparableIndex[];
  excludes: ComparableExclude[];
}

interface SkipCodeItems {
  indexes: Map<number, boolean>;
  excludes: Map<number, boolean>;
}

interface HoldCodeItems {
  indexes: Map<TableData.Index, boolean>;
  excludes: Map<TableData.Exclude, boolean>;
}

interface Wait {
  indexes: number;
  excludes: number;
}

interface ProcessParams {
  config: AnyRakeDbConfig;
  changeTableData: ChangeTableData;
  codeComparableItems: ComparableItems;
  codeItems: CodeItems;
  skipCodeItems: SkipCodeItems;
  holdCodeItems: HoldCodeItems;
  wait: Wait;
  ast: RakeDbAst[];
  compareExpressions: CompareExpression[];
}

export const processIndexesAndExcludes = (
  config: AnyRakeDbConfig,
  changeTableData: ChangeTableData,
  ast: RakeDbAst[],
  compareExpressions: CompareExpression[],
) => {
  const codeItems = collectCodeIndexes(config, changeTableData);
  const codeComparableItems = collectCodeComparableItems(config, codeItems);

  // to skip indexes without SQL from being added when they are matched with already existing indexes
  const skipCodeItems: SkipCodeItems = {
    indexes: new Map(),
    excludes: new Map(),
  };

  // to skip indexes with SQL from being added while their SQL is being asynchronously compared with existing indexes
  const holdCodeItems: HoldCodeItems = {
    indexes: new Map(),
    excludes: new Map(),
  };

  const processParams: ProcessParams = {
    config,
    changeTableData,
    codeComparableItems,
    codeItems,
    skipCodeItems,
    holdCodeItems,
    // counter for async SQL comparisons that are in progress
    wait: { indexes: 0, excludes: 0 },
    ast,
    compareExpressions,
  };

  processItems(processParams, 'indexes');
  processItems(processParams, 'excludes');

  addMainItems(
    changeTableData,
    codeItems,
    skipCodeItems,
    holdCodeItems,
    'indexes',
  );
  addMainItems(
    changeTableData,
    codeItems,
    skipCodeItems,
    holdCodeItems,
    'excludes',
  );
};

const processItems = (
  {
    config,
    changeTableData,
    codeComparableItems,
    codeItems,
    skipCodeItems,
    holdCodeItems,
    wait,
    ast,
    compareExpressions,
  }: ProcessParams,
  key: 'indexes' | 'excludes',
) => {
  const {
    changeTableAst: { shape },
  } = changeTableData;

  const dbItems = changeTableData.dbTableData[key];

  for (const dbItem of dbItems) {
    const hasAddedOrDroppedColumn = dbItem.columns.some(
      (column) =>
        'column' in column && checkForColumnAddOrDrop(shape, column.column),
    );
    if (hasAddedOrDroppedColumn) continue;

    normalizeItem(dbItem);

    const { found, rename, foundAndHasSql } = findMatchingItem(
      dbItem,
      codeComparableItems,
      codeItems,
      skipCodeItems,
      changeTableData.codeTable.table,
      config,
      key,
    );

    const { columns: dbColumns } = dbItem;

    if (!foundAndHasSql) {
      handleItemChange(
        changeTableData,
        dbItem,
        dbColumns,
        found[0],
        rename[0],
        key,
      );
      continue;
    }

    for (const codeItem of found) {
      holdCodeItems[key].set(codeItem as never, true);
    }

    const compare: CompareExpression['compare'] = [];
    for (let i = 0; i < dbItem.columns.length; i++) {
      const column = dbItem.columns[i];
      if (!('expression' in column)) continue;

      compare.push({
        inDb: column.expression,
        inCode: found.map(
          (x) => (x.columns[i] as { expression: string }).expression,
        ),
      });
    }

    if (dbItem.with) {
      compare.push({
        inDb: dbItem.with,
        inCode: found.map((x) => x.options.with as string),
      });
    }

    if (dbItem.where) {
      compare.push({
        inDb: dbItem.where,
        inCode: found.map((x) => x.options.where as string),
      });
    }

    wait[key]++;
    compareExpressions.push({
      compare,
      handle(i) {
        const codeItem = i === undefined ? undefined : found[i];

        handleItemChange(
          changeTableData,
          dbItem,
          dbColumns,
          codeItem,
          i === undefined ? undefined : rename[i],
          key,
        );

        if (codeItem) {
          holdCodeItems[key].delete(codeItem as never);
        }

        if (!--wait[key] && holdCodeItems[key].size) {
          addItems(changeTableData, [...holdCodeItems[key].keys()], key);

          if (!changeTableData.pushedAst) {
            changeTableData.pushedAst = true;
            ast.push(changeTableData.changeTableAst);
          }
        }
      },
    });
  }
};

const collectCodeIndexes = (
  config: AnyRakeDbConfig,
  { codeTable, changeTableAst: { shape } }: ChangeTableData,
): CodeItems => {
  const codeItems: CodeItems = { indexes: [], excludes: [] };

  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as Column;
    if (!column.data.indexes && !column.data.excludes) continue;

    const name = column.data.name ?? key;
    if (checkForColumnAddOrDrop(shape, name)) continue;

    pushCodeColumnItems(config, codeItems, key, name, column, 'indexes');
    pushCodeColumnItems(config, codeItems, key, name, column, 'excludes');
  }

  pushCodeCompositeItems(config, codeTable, codeItems, 'indexes');
  pushCodeCompositeItems(config, codeTable, codeItems, 'excludes');

  return codeItems;
};

const pushCodeColumnItems = (
  config: AnyRakeDbConfig,
  codeItems: CodeItems,
  columnKey: string,
  name: string,
  column: Column,
  key: 'indexes' | 'excludes',
) => {
  const items = column.data[key];
  if (!items) return;

  codeItems[key].push(
    ...(items as TableData.ColumnExclude[]).map(
      ({
        options: { collate, opclass, order, weight, ...options },
        with: wi,
        ...index
      }) => {
        const w = key === 'excludes' ? wi : (undefined as never);
        return {
          columns: [
            {
              collate,
              opclass,
              order,
              weight,
              column: name,
              with: w,
            },
          ],
          ...index,
          options: options.include
            ? config.snakeCase
              ? {
                  ...options,
                  include: toArray(options.include).map(toSnakeCase),
                }
              : options
            : options,
          columnKeys: [
            {
              collate,
              opclass,
              order,
              weight,
              column: columnKey,
              with: w,
            },
          ],
          includeKeys: options.include,
        };
      },
    ),
  );
};

const pushCodeCompositeItems = (
  config: AnyRakeDbConfig,
  codeTable: CodeTable,
  codeItems: CodeItems,
  key: 'indexes' | 'excludes',
) => {
  const items = codeTable.internal.tableData[key];
  if (!items) return;

  codeItems[key].push(
    ...(items as TableData.Exclude[]).map((x) => ({
      ...x,
      columns: config.snakeCase
        ? x.columns.map((c) =>
            'column' in c ? { ...c, column: toSnakeCase(c.column) } : c,
          )
        : x.columns,
      columnKeys: x.columns,
      options:
        x.options.include && config.snakeCase
          ? {
              ...x.options,
              include: toArray(x.options.include).map(toSnakeCase),
            }
          : x.options,
      includeKeys: x.options.include,
    })),
  );
};

const collectCodeComparableItems = (
  config: AnyRakeDbConfig,
  codeItems: CodeItems,
): ComparableItems => {
  return {
    indexes: collectCodeComparableItemsType(config, codeItems, 'indexes'),
    excludes: collectCodeComparableItemsType(config, codeItems, 'excludes'),
  };
};

const collectCodeComparableItemsType = (
  config: AnyRakeDbConfig,
  codeItems: CodeItems,
  key: 'indexes' | 'excludes',
): ComparableExclude[] => {
  return codeItems[key].map((codeItem) => {
    normalizeItem(codeItem.options as never);

    return itemToComparable({
      ...codeItem.options,
      include:
        codeItem.options.include === undefined
          ? undefined
          : config.snakeCase
          ? toArray(codeItem.options.include).map(toSnakeCase)
          : toArray(codeItem.options.include),
      columns: codeItem.columns,
      name: codeItem.options.name,
      columnKeys: codeItem.columnKeys,
      includeKeys: codeItem.includeKeys,
    });
  }) as never;
};

const normalizeItem = (item: {
  using?: string;
  unique?: boolean;
  nullsNotDistinct?: boolean;
  columns: RecordUnknown[];
  exclude?: string[];
}) => {
  if (item.using) item.using = item.using.toLowerCase();
  if (item.using === 'btree') item.using = undefined;
  if (!item.unique) item.unique = undefined;
  if (item.nullsNotDistinct === false) item.nullsNotDistinct = undefined;
  if (item.exclude) {
    for (let i = 0; i < item.columns.length; i++) {
      item.columns[i].with = item.exclude[i];
    }
  }
};

const itemToComparable = (
  index: TableData.Index.Options & {
    columns: DbStructure.Index['columns'];
    name?: string;
    columnKeys?: TableData.Index.ColumnOrExpressionOptions[];
    includeKeys?: MaybeArray<string>;
  },
) => {
  let hasExpression = false;
  const columns = index.columns.map((column) => {
    const result = {
      ...column,
      expression: undefined,
      hasExpression: 'expression' in column,
    };
    if (result.hasExpression) hasExpression = true;
    return result;
  });

  return {
    ...index,
    schemaName: undefined,
    tableName: undefined,
    with: undefined,
    hasWith: !!index.with,
    where: undefined,
    hasWhere: !!index.where,
    columns,
    hasExpression,
  } as ComparableIndex;
};

interface ItemChange {
  found: TableData.Index[] | TableData.Exclude[];
  rename: (string | undefined)[];
}

const findMatchingItem = (
  dbItem: DbStructure.Index | DbStructure.Exclude,
  codeComparableItems: ComparableItems,
  codeItems: CodeItems,
  skipCodeItems: SkipCodeItems,
  tableName: string,
  config: AnyRakeDbConfig,
  key: 'indexes' | 'excludes',
) => {
  const dbComparableItem = itemToComparable(
    key === 'indexes'
      ? dbItem
      : {
          ...dbItem,
          exclude: undefined as never,
          columns: dbItem.columns.map((column, i) => ({
            ...column,
            with: (dbItem as DbStructure.Exclude).exclude[i],
          })),
        },
  );

  const { found, rename } = findMatchingItemWithoutSql(
    dbComparableItem,
    codeComparableItems,
    codeItems,
    skipCodeItems,
    tableName,
    config,
    key,
  );

  const foundAndHasSql = found.length && checkIfItemHasSql(dbComparableItem);

  return { found, rename, foundAndHasSql };
};

const findMatchingItemWithoutSql = (
  dbItem: ComparableIndex | ComparableExclude,
  codeComparableItems: ComparableItems,
  codeItems: CodeItems,
  skipCodeItems: SkipCodeItems,
  tableName: string,
  config: AnyRakeDbConfig,
  key: 'indexes' | 'excludes',
): ItemChange => {
  const found: (TableData.Index | TableData.Exclude)[] = [];
  const rename: (string | undefined)[] = [];

  const { columns: dbColumns, ...dbItemWithoutColumns } = dbItem;

  for (let i = 0; i < codeComparableItems[key].length; i++) {
    if (skipCodeItems[key].has(i)) continue;

    const { columns: codeColumns, ...codeItem } = codeComparableItems[key][i];
    if (
      dbColumns.length === codeColumns.length &&
      !dbColumns.some((dbColumn, i) => !deepCompare(dbColumn, codeColumns[i]))
    ) {
      let a: RecordUnknown = dbItemWithoutColumns;
      let b = codeItem;
      const codeName =
        b.name ??
        (key === 'indexes' ? getIndexName : getExcludeName)(
          tableName,
          dbColumns,
        );
      if (a.name !== b.name) {
        a = { ...a, name: undefined };
        b = {
          ...b,
          name: undefined,
          columnKeys: undefined,
          includeKeys: undefined,
        };
        if (a.language && !b.language) {
          b.language = config.language ?? 'english';
        }

        if (deepCompare(a, b)) {
          found.push(codeItems[key][i]);
          rename.push(
            dbItemWithoutColumns.name !== codeName ? codeName : undefined,
          );
        }
      } else {
        const {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          columnKeys,
          includeKeys,
          ...codeItemWithoutKeys
        } = codeItem;

        if (deepCompare(dbItemWithoutColumns, codeItemWithoutKeys)) {
          found.push(codeItems[key][i]);
          rename.push(undefined);
        }
      }

      if (found.length && !checkIfItemHasSql(codeItem)) {
        skipCodeItems[key].set(i, true);
      }
    }
  }

  return { found, rename };
};

const checkIfItemHasSql = (
  x: Pick<ComparableIndex, 'hasWith' | 'hasWhere' | 'hasExpression'>,
) => x.hasWith || x.hasWhere || x.hasExpression;

const handleItemChange = (
  {
    changeTableAst,
    schema,
    codeTable,
    changingColumns,
    delayedAst,
  }: ChangeTableData,
  dbItem: DbStructure.Index | DbStructure.Exclude,
  dbColumns: DbStructure.Index['columns'],
  found: TableData.Index | TableData.Exclude | undefined,
  rename: string | undefined,
  key: 'indexes' | 'excludes',
) => {
  if (!found) {
    const name =
      dbItem.name ===
      (key === 'indexes' ? getIndexName : getExcludeName)(
        changeTableAst.name,
        dbColumns,
      )
        ? undefined
        : dbItem.name;

    if (dbColumns.length === 1 && 'column' in dbColumns[0]) {
      const dbColumn = dbColumns[0];
      const column = changingColumns[dbColumn.column];
      if (column) {
        (column.from.data[key] ??= []).push({
          options: { ...dbItem, name },
          with: (key === 'indexes'
            ? undefined
            : (dbColumn as unknown as { with: string }).with) as never,
        });
        return;
      }
    }

    (changeTableAst.drop[key] ??= []).push({
      columns: dbColumns,
      options: { ...dbItem, name },
    });
  } else if (rename) {
    delayedAst.push({
      type: 'renameTableItem',
      kind: key === 'indexes' ? 'INDEX' : 'CONSTRAINT',
      tableSchema: schema,
      tableName: codeTable.table,
      from: dbItem.name,
      to: rename,
    });
  }
};

interface IndexWithMaybeColumnNames extends TableData.Index {
  columnNames?: TableData.Index.ColumnOrExpressionOptions[];
}

const addMainItems = (
  changeTableData: ChangeTableData,
  codeItems: CodeItems,
  skipCodeItems: SkipCodeItems,
  holdCodeItems: HoldCodeItems,
  key: 'indexes' | 'excludes',
) => {
  const itemsToAdd = codeItems[key].filter(
    (item, i) =>
      !skipCodeItems[key].has(i) && !holdCodeItems[key].has(item as never),
  );
  if (itemsToAdd.length) {
    addItems(
      changeTableData,
      itemsToAdd.map((x) => ({
        ...x,
        columns: x.columnKeys,
        columnNames: x.columns,
        options: x.options.include
          ? { ...x.options, include: x.includeKeys }
          : x.options,
      })),
      key,
    );
  }
};

const addItems = (
  { changeTableAst, changingColumns }: ChangeTableData,
  add: IndexWithMaybeColumnNames[],
  key: 'indexes' | 'excludes',
) => {
  const items = (changeTableAst.add[key] ??= []);
  for (const item of add) {
    if (item.columns.length === 1 && 'column' in item.columns[0]) {
      const column =
        changingColumns[
          ((item.columnNames || item.columns)[0] as { column: string }).column
        ];
      if (column) {
        (column.to.data[key] ??= []).push(
          key === 'indexes'
            ? item
            : ({
                ...item,
                with: (item as TableData.Exclude).columns[0].with,
              } as never),
        );
        continue;
      }
    }

    items.push(item);
  }
};
