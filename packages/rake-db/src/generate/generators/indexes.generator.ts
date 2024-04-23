import {
  ColumnType,
  IndexOptions,
  QueryWithTable,
  SearchWeight,
  TableData,
} from 'pqb';
import { StructureToAstTableData } from '../structureToAst';
import { deepCompare, RecordUnknown, toArray } from 'orchid-core';
import { AnyRakeDbConfig } from '../../config';
import { RakeDbAst } from '../../ast';
import { getIndexName } from '../../migration/migrationUtils';
import { CompareExpression } from './tables.generator';
import { DbStructure } from '../dbStructure';

export const processIndexes = (
  config: AnyRakeDbConfig,
  tableData: StructureToAstTableData,
  codeTable: QueryWithTable,
  shape: RakeDbAst.ChangeTableShape,
  add: TableData,
  drop: TableData,
  delayedAst: RakeDbAst[],
  ast: RakeDbAst[],
  tableSchema: string,
  tableName: string,
  compareExpressions: CompareExpression[],
  pushedChangeTableRef: { current: boolean },
  changeTableAst: RakeDbAst.ChangeTable,
) => {
  const indexes: TableData.Index[] = [];
  for (const key in codeTable.shape) {
    const column = codeTable.shape[key] as ColumnType;
    if (!column.data.indexes) continue;

    const name = column.data.name ?? key;
    if (shape[name] && shape[name].type !== 'rename') continue;

    indexes.push(
      ...column.data.indexes.map(
        ({ collate, opclass, order, weight, ...options }) => ({
          columns: [{ collate, opclass, order, weight, column: name }],
          options,
        }),
      ),
    );
  }

  if (codeTable.internal.indexes) {
    indexes.push(...codeTable.internal.indexes);
  }

  const codeComparableIndexes: ComparableIndex[] = [];
  for (const codeIndex of indexes) {
    normalizeIndex(codeIndex.options);
    codeComparableIndexes.push(
      indexToComparable({
        ...codeIndex.options,
        include:
          codeIndex.options.include === undefined
            ? undefined
            : toArray(codeIndex.options.include),
        columns: codeIndex.columns,
      }),
    );
  }

  const skipCodeIndexes = new Map<number, boolean>();
  const holdCodeIndexes = new Map<TableData.Index, boolean>();
  let wait = 0;

  for (const dbIndex of tableData.indexes) {
    if (
      dbIndex.columns.some(
        (column) =>
          'column' in column &&
          shape[column.column] &&
          shape[column.column].type !== 'rename',
      )
    )
      continue;

    normalizeIndex(dbIndex);

    const dbComparableIndex = indexToComparable(dbIndex);

    const { columns: dbColumns } = dbIndex;
    const { found, rename } = findMatchingIndexWithoutSql(
      dbComparableIndex,
      codeComparableIndexes,
      indexes,
      skipCodeIndexes,
      tableName,
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
            drop,
            dbIndex,
            dbColumns,
            tableSchema,
            tableName,
            codeIndex,
            index === undefined ? undefined : rename[index],
          );

          if (codeIndex) {
            holdCodeIndexes.delete(codeIndex);
          }

          if (!--wait && holdCodeIndexes.size) {
            (add.indexes ??= []).push(...holdCodeIndexes.keys());

            if (!pushedChangeTableRef.current) {
              pushedChangeTableRef.current = true;
              ast.push(changeTableAst);
            }
          }
        },
      });
    } else {
      handleIndexChange(
        delayedAst,
        drop,
        dbIndex,
        dbColumns,
        tableSchema,
        tableName,
        found[0],
        rename[0],
      );
    }
  }

  const addIndexes = indexes.filter(
    (index, i) => !skipCodeIndexes.has(i) && !holdCodeIndexes.has(index),
  );
  if (addIndexes.length) {
    add.indexes = addIndexes;
  }
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
  drop: TableData,
  dbIndex: DbStructure.Index,
  dbColumns: DbStructure.Index['columns'],
  tableSchema: string,
  tableName: string,
  found?: TableData.Index,
  rename?: string,
) => {
  if (!found) {
    (drop.indexes ??= []).push({
      columns: dbColumns,
      options: dbIndex,
    });
  } else if (rename) {
    ast.push({
      type: 'renameTableItem',
      kind: 'INDEX',
      tableSchema,
      tableName,
      from: dbIndex.name,
      to: rename,
    });
  }
};
