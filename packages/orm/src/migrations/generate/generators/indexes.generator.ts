import { AnyRakeDbConfig, RakeDbAst, getIndexName, DbStructure } from 'rake-db';
import { ColumnType, SearchWeight, TableData } from 'pqb';
import {
  deepCompare,
  MaybeArray,
  RecordUnknown,
  toArray,
  toSnakeCase,
} from 'orchid-core';
import { ChangeTableData } from './tables.generator';
import { checkForColumnAddOrDrop, CompareExpression } from './generators.utils';

interface CodeIndex extends TableData.Index {
  columnKeys: TableData.Index.ColumnOrExpressionOptions[];
  includeKeys?: MaybeArray<string>;
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
  columns: {
    column?: string;
    collate?: string;
    opclass?: string;
    order?: string;
    weight?: SearchWeight;
    hasExpression: boolean;
  }[];
  hasWith: boolean;
  hasWhere: boolean;
  hasExpression: boolean;
  columnKeys?: string[];
  includeKeys?: string[];
}

export const processIndexes = (
  config: AnyRakeDbConfig,
  changeTableData: ChangeTableData,
  ast: RakeDbAst[],
  compareExpressions: CompareExpression[],
) => {
  const codeIndexes = collectCodeIndexes(config, changeTableData);
  const codeComparableIndexes = collectCodeComparableIndexes(
    config,
    codeIndexes,
  );

  // to skip indexes without SQL from being added when they are matched with already existing indexes
  const skipCodeIndexes = new Map<number, boolean>();

  // to skip indexes with SQL from being added while their SQL is being asynchronously compared with existing indexes
  const holdCodeIndexes = new Map<TableData.Index, boolean>();

  // counter for async SQL comparisons that are in progress
  let wait = 0;

  const {
    changeTableAst: { shape },
  } = changeTableData;
  for (const dbIndex of changeTableData.dbTableData.indexes) {
    const hasAddedOrDroppedColumn = dbIndex.columns.some(
      (column) =>
        'column' in column && checkForColumnAddOrDrop(shape, column.column),
    );
    if (hasAddedOrDroppedColumn) continue;

    normalizeIndex(dbIndex);

    const { found, rename, foundAndHasSql } = findMatchingIndex(
      dbIndex,
      codeComparableIndexes,
      codeIndexes,
      skipCodeIndexes,
      changeTableData.codeTable.table,
      config,
    );

    const { columns: dbColumns } = dbIndex;

    if (!foundAndHasSql) {
      handleIndexChange(
        changeTableData,
        dbIndex,
        dbColumns,
        found[0],
        rename[0],
      );
      continue;
    }

    for (const codeIndex of found) {
      holdCodeIndexes.set(codeIndex, true);
    }

    const compare: CompareExpression['compare'] = [];
    for (let i = 0; i < dbIndex.columns.length; i++) {
      const column = dbIndex.columns[i];
      if (!('expression' in column)) continue;

      compare.push({
        inDb: column.expression,
        inCode: found.map(
          (index) => (index.columns[i] as { expression: string }).expression,
        ),
      });
    }

    if (dbIndex.with) {
      compare.push({
        inDb: dbIndex.with,
        inCode: found.map((index) => index.options.with as string),
      });
    }

    if (dbIndex.where) {
      compare.push({
        inDb: dbIndex.where,
        inCode: found.map((index) => index.options.where as string),
      });
    }

    wait++;
    compareExpressions.push({
      compare,
      handle(index) {
        const codeIndex = index === undefined ? undefined : found[index];

        handleIndexChange(
          changeTableData,
          dbIndex,
          dbColumns,
          codeIndex,
          index === undefined ? undefined : rename[index],
        );

        if (codeIndex) {
          holdCodeIndexes.delete(codeIndex);
        }

        if (!--wait && holdCodeIndexes.size) {
          addIndexes(changeTableData, [...holdCodeIndexes.keys()]);

          if (!changeTableData.pushedAst) {
            changeTableData.pushedAst = true;
            ast.push(changeTableData.changeTableAst);
          }
        }
      },
    });
  }

  const indexesToAdd = codeIndexes.filter(
    (index, i) => !skipCodeIndexes.has(i) && !holdCodeIndexes.has(index),
  );
  if (indexesToAdd.length) {
    addIndexes(
      changeTableData,
      indexesToAdd.map((x) => ({
        ...x,
        columns: x.columnKeys,
        columnNames: x.columns,
        options: x.options.include
          ? { ...x.options, include: x.includeKeys }
          : x.options,
      })),
    );
  }
};

const collectCodeIndexes = (
  config: AnyRakeDbConfig,
  { codeTable, changeTableAst: { shape } }: ChangeTableData,
): CodeIndex[] => {
  const codeIndexes: CodeIndex[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (!column.data.indexes) continue;

    const name = column.data.name ?? key;
    if (checkForColumnAddOrDrop(shape, name)) continue;

    codeIndexes.push(
      ...column.data.indexes.map(
        ({
          options: { collate, opclass, order, weight, ...options },
          ...index
        }) => ({
          columns: [
            {
              collate,
              opclass,
              order,
              weight,
              column: name,
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
          columnKeys: [{ collate, opclass, order, weight, column: key }],
          includeKeys: options.include,
        }),
      ),
    );
  }

  if (codeTable.internal.tableData.indexes) {
    codeIndexes.push(
      ...codeTable.internal.tableData.indexes.map((x) => ({
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
  }

  return codeIndexes;
};

const collectCodeComparableIndexes = (
  config: AnyRakeDbConfig,
  codeIndexes: CodeIndex[],
): ComparableIndex[] => {
  return codeIndexes.map((codeIndex) => {
    normalizeIndex(codeIndex.options);

    return indexToComparable({
      ...codeIndex.options,
      include:
        codeIndex.options.include === undefined
          ? undefined
          : config.snakeCase
          ? toArray(codeIndex.options.include).map(toSnakeCase)
          : toArray(codeIndex.options.include),
      columns: codeIndex.columns,
      name: codeIndex.name,
      columnKeys: codeIndex.columnKeys,
      includeKeys: codeIndex.includeKeys,
    });
  });
};

const normalizeIndex = (index: {
  using?: string;
  unique?: boolean;
  nullsNotDistinct?: boolean;
}) => {
  if (index.using === 'btree') index.using = undefined;
  if (!index.unique) index.unique = undefined;
  if (index.nullsNotDistinct === false) index.nullsNotDistinct = undefined;
};

const indexToComparable = (
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

interface IndexChange {
  found: TableData.Index[];
  rename: (string | undefined)[];
}

const findMatchingIndex = (
  dbIndex: DbStructure.Index,
  codeComparableIndexes: ComparableIndex[],
  codeIndexes: TableData.Index[],
  skipCodeIndexes: Map<number, boolean>,
  tableName: string,
  config: AnyRakeDbConfig,
) => {
  const dbComparableIndex = indexToComparable(dbIndex);

  const { found, rename } = findMatchingIndexWithoutSql(
    dbComparableIndex,
    codeComparableIndexes,
    codeIndexes,
    skipCodeIndexes,
    tableName,
    config,
  );

  const foundAndHasSql = found.length && checkIfIndexHasSql(dbComparableIndex);

  return { found, rename, foundAndHasSql };
};

const findMatchingIndexWithoutSql = (
  dbIndex: ComparableIndex,
  codeComparableIndexes: ComparableIndex[],
  codeIndexes: TableData.Index[],
  skipCodeIndexes: Map<number, boolean>,
  tableName: string,
  config: AnyRakeDbConfig,
): IndexChange => {
  const found: TableData.Index[] = [];
  const rename: (string | undefined)[] = [];

  const { columns: dbColumns, ...dbIndexWithoutColumns } = dbIndex;

  for (let i = 0; i < codeComparableIndexes.length; i++) {
    if (skipCodeIndexes.has(i)) continue;

    const { columns: codeColumns, ...codeIndex } = codeComparableIndexes[i];
    if (
      dbColumns.length === codeColumns.length &&
      !dbColumns.some((dbColumn, i) => !deepCompare(dbColumn, codeColumns[i]))
    ) {
      let a: RecordUnknown = dbIndexWithoutColumns;
      let b = codeIndex;
      const codeName = b.name ?? getIndexName(tableName, dbColumns);
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
          found.push(codeIndexes[i]);
          rename.push(
            dbIndexWithoutColumns.name !== codeName ? codeName : undefined,
          );
        }
      } else {
        const {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          columnKeys,
          includeKeys,
          ...codeIndexWithoutKeys
        } = codeIndex;
        if (deepCompare(dbIndexWithoutColumns, codeIndexWithoutKeys)) {
          found.push(codeIndexes[i]);
          rename.push(undefined);
        }
      }

      if (found.length && !checkIfIndexHasSql(codeIndex)) {
        skipCodeIndexes.set(i, true);
      }
    }
  }

  return { found, rename };
};

const checkIfIndexHasSql = (
  index: Pick<ComparableIndex, 'hasWith' | 'hasWhere' | 'hasExpression'>,
) => index.hasWith || index.hasWhere || index.hasExpression;

const handleIndexChange = (
  {
    changeTableAst,
    schema,
    codeTable,
    changingColumns,
    delayedAst,
  }: ChangeTableData,
  dbIndex: DbStructure.Index,
  dbColumns: DbStructure.Index['columns'],
  found?: TableData.Index,
  rename?: string,
) => {
  if (!found) {
    const indexName =
      dbIndex.name === getIndexName(changeTableAst.name, dbColumns)
        ? undefined
        : dbIndex.name;

    if (dbColumns.length === 1 && 'column' in dbColumns[0]) {
      const column = changingColumns[dbColumns[0].column];
      if (column) {
        (column.from.data.indexes ??= []).push({
          options: dbIndex,
          name: indexName,
        });
        return;
      }
    }

    (changeTableAst.drop.indexes ??= []).push({
      columns: dbColumns,
      options: dbIndex,
      name: indexName,
    });
  } else if (rename) {
    delayedAst.push({
      type: 'renameTableItem',
      kind: 'INDEX',
      tableSchema: schema,
      tableName: codeTable.table,
      from: dbIndex.name,
      to: rename,
    });
  }
};

interface IndexWithMaybeColumnNames extends TableData.Index {
  columnNames?: TableData.Index.ColumnOrExpressionOptions[];
}

const addIndexes = (
  { changeTableAst, changingColumns }: ChangeTableData,
  add: IndexWithMaybeColumnNames[],
) => {
  const indexes = (changeTableAst.add.indexes ??= []);
  for (const index of add) {
    if (index.columns.length === 1 && 'column' in index.columns[0]) {
      const column =
        changingColumns[
          ((index.columnNames || index.columns)[0] as { column: string }).column
        ];
      if (column) {
        (column.to.data.indexes ??= []).push(index);
        continue;
      }
    }

    indexes.push(index);
  }
};
