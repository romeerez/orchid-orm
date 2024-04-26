import { ColumnType, IndexOptions, SearchWeight, TableData } from 'pqb';
import { deepCompare, RecordUnknown, toArray } from 'orchid-core';
import { AnyRakeDbConfig } from '../../config';
import { RakeDbAst } from '../../ast';
import { getIndexName } from '../../migration/migrationUtils';
import { ChangeTableData } from './tables.generator';
import { DbStructure } from '../dbStructure';
import { CompareExpression } from './generators.utils';

export const processIndexes = (
  config: AnyRakeDbConfig,
  changeTableData: ChangeTableData,
  delayedAst: RakeDbAst[],
  ast: RakeDbAst[],
  compareExpressions: CompareExpression[],
) => {
  const codeIndexes = collectCodeIndexes(changeTableData);
  const codeComparableIndexes = collectCodeComparableIndexes(codeIndexes);

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
    const hasChangedColumn = dbIndex.columns.some(
      (column) =>
        'column' in column &&
        shape[column.column] &&
        shape[column.column].type !== 'rename',
    );
    if (hasChangedColumn) continue;

    normalizeIndex(dbIndex);

    const dbComparableIndex = indexToComparable(dbIndex);

    const { columns: dbColumns } = dbIndex;
    const { found, rename } = findMatchingIndexWithoutSql(
      dbComparableIndex,
      codeComparableIndexes,
      codeIndexes,
      skipCodeIndexes,
      changeTableData.codeTable.table,
      config,
    );

    if (found.length && checkIfIndexHasSql(dbComparableIndex)) {
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
            ast,
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
            (changeTableData.changeTableAst.add.indexes ??= []).push(
              ...holdCodeIndexes.keys(),
            );

            if (!changeTableData.pushedAst) {
              changeTableData.pushedAst = true;
              ast.push(changeTableData.changeTableAst);
            }
          }
        },
      });
    } else {
      handleIndexChange(
        delayedAst,
        changeTableData,
        dbIndex,
        dbColumns,
        found[0],
        rename[0],
      );
    }
  }

  const addIndexes = codeIndexes.filter(
    (index, i) => !skipCodeIndexes.has(i) && !holdCodeIndexes.has(index),
  );
  if (addIndexes.length) {
    changeTableData.changeTableAst.add.indexes = addIndexes;
  }
};

const collectCodeIndexes = ({
  codeTable,
  changeTableAst: { shape },
}: ChangeTableData): TableData.Index[] => {
  const codeIndexes: TableData.Index[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (!column.data.indexes) continue;

    const name = column.data.name ?? key;
    if (shape[name] && shape[name].type !== 'rename') continue;

    codeIndexes.push(
      ...column.data.indexes.map(
        ({ collate, opclass, order, weight, ...options }) => ({
          columns: [{ collate, opclass, order, weight, column: name }],
          options,
        }),
      ),
    );
  }

  if (codeTable.internal.indexes) {
    codeIndexes.push(...codeTable.internal.indexes);
  }

  return codeIndexes;
};

const collectCodeComparableIndexes = (
  codeIndexes: TableData.Index[],
): ComparableIndex[] => {
  return codeIndexes.map((codeIndex) => {
    normalizeIndex(codeIndex.options);
    return indexToComparable({
      ...codeIndex.options,
      include:
        codeIndex.options.include === undefined
          ? undefined
          : toArray(codeIndex.options.include),
      columns: codeIndex.columns,
    });
  });
};

const normalizeIndex = (
  index: Pick<IndexOptions, 'using' | 'unique' | 'nullsNotDistinct'>,
) => {
  if (index.using === 'btree') index.using = undefined;
  if (index.unique === false) index.unique = undefined;
  if (index.nullsNotDistinct === false) index.nullsNotDistinct = undefined;
};

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
}

const indexToComparable = (
  index: Omit<
    IndexOptions & { columns: DbStructure.Index['columns'] },
    'hasWith' | 'hasWhere' | 'hasExpression'
  >,
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
        b = { ...b, name: undefined };
        if (a.language && !b.language) {
          b.language = config.language ?? 'english';
        }

        if (deepCompare(a, b)) {
          found.push(codeIndexes[i]);
          rename.push(
            dbIndexWithoutColumns.name !== codeName ? codeName : undefined,
          );
        }
      } else if (deepCompare(dbIndexWithoutColumns, codeIndex)) {
        found.push(codeIndexes[i]);
        rename.push(undefined);
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
  ast: RakeDbAst[],
  { changeTableAst, schema, codeTable }: ChangeTableData,
  dbIndex: DbStructure.Index,
  dbColumns: DbStructure.Index['columns'],
  found?: TableData.Index,
  rename?: string,
) => {
  if (!found) {
    (changeTableAst.drop.indexes ??= []).push({
      columns: dbColumns,
      options: dbIndex,
    });
  } else if (rename) {
    ast.push({
      type: 'renameTableItem',
      kind: 'INDEX',
      tableSchema: schema,
      tableName: codeTable.table,
      from: dbIndex.name,
      to: rename,
    });
  }
};
