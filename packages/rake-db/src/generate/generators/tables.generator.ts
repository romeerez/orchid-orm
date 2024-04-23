import {
  Adapter,
  ColumnsShape,
  ColumnType,
  QueryWithTable,
  TableData,
  VirtualColumn,
} from 'pqb';
import { DbStructure, IntrospectedStructure } from '../dbStructure';
import { AnyRakeDbConfig, RakeDbAst } from 'rake-db';
import {
  DbStructureDomainsMap,
  getDbStructureTableData,
  makeDomainsMap,
  makeStructureToAstCtx,
  StructureToAstCtx,
  tableToAst,
} from '../structureToAst';
import { promptCreateOrRename } from './generators.utils';
import { processPrimaryKey } from './primaryKey.generator';
import { processIndexes } from './indexes.generator';
import { getColumnDbType, processColumns } from './columns.generator';

export interface CompareSql {
  values: unknown[];
  expressions: {
    inDb: string;
    inCode: string;
    change(): void;
  }[];
}

export interface CompareExpression {
  compare: {
    inDb: string;
    inCode: string[];
  }[];
  handle(index?: number): void;
}

interface TableExpression extends CompareExpression {
  source: string;
}

export const processTables = async (
  adapter: Adapter,
  tables: QueryWithTable[],
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  config: AnyRakeDbConfig,
): Promise<RakeDbAst[]> => {
  const ast: RakeDbAst[] = [];
  const createTables: QueryWithTable[] = [];
  const dropTables: DbStructure.Table[] = [];
  const compareSql: CompareSql = { values: [], expressions: [] };
  const compareExpressions: CompareExpression[] = [];
  const tableExpressions: TableExpression[] = [];

  for (const codeTable of tables) {
    const tableSchema = codeTable.q.schema ?? currentSchema;
    const dbTable = dbStructure.tables.find(
      (t) => t.name === codeTable.table && t.schemaName === tableSchema,
    );
    if (!dbTable) {
      createTables.push(codeTable);
    }
  }

  const structureToAstCtx = makeStructureToAstCtx(config, currentSchema);
  const domainsMap = makeDomainsMap(structureToAstCtx, dbStructure);

  for (const dbTable of dbStructure.tables) {
    if (dbTable.name === 'schemaMigrations') continue;

    const codeTable = tables.find(
      (t) =>
        t.table === dbTable.name &&
        (t.q.schema ?? currentSchema) === dbTable.schemaName,
    );
    if (codeTable) {
      compareExpressions.length = 0;
      await processTableChange(
        structureToAstCtx,
        dbStructure,
        domainsMap,
        ast,
        currentSchema,
        config,
        dbTable,
        codeTable,
        compareSql,
        compareExpressions,
      );

      if (compareExpressions.length) {
        const names: string[] = [];
        const types: string[] = [];
        for (const key in codeTable.shape) {
          const column = codeTable.shape[key] as ColumnType;
          const name = column.data.name ?? key;
          names.push(name);
          types.push(getColumnDbType(column, currentSchema));
        }

        const tableName = codeTable.table;
        const source = `(VALUES (${types
          .map((x) => `NULL::${x}`)
          .join(', ')})) "${tableName}"(${names
          .map((x) => `"${x}"`)
          .join(', ')})`;

        tableExpressions.push(
          ...compareExpressions.map((x) => ({ ...x, source })),
        );
      }

      continue;
    }

    const i = createTables.findIndex((t) => t.table === dbTable.name);
    if (i !== -1) {
      const table = createTables[i];
      createTables.splice(i, 1);
      const fromSchema = dbTable.schemaName;
      const toSchema = table.q.schema ?? currentSchema;

      ast.push({
        type: 'renameType',
        kind: 'TABLE',
        fromSchema,
        from: dbTable.name,
        toSchema,
        to: dbTable.name,
      });
      continue;
    }

    dropTables.push(dbTable);
  }

  if (compareSql.expressions.length) {
    const {
      rows: [results],
    } = await adapter.arrays({
      text:
        'SELECT ' +
        compareSql.expressions
          .map((x) => `${x.inDb} = (${x.inCode})`)
          .join(', '),
      values: compareSql.values,
    });

    for (let i = 0; i < results.length; i++) {
      if (!results[i]) {
        compareSql.expressions[i].change();
      }
    }
  }

  if (tableExpressions.length) {
    let id = 1;
    await Promise.all(
      tableExpressions.map(async ({ source, compare, handle }) => {
        const viewName = `orchidTmpView${id++}`;
        try {
          const sql = `CREATE TEMPORARY VIEW ${viewName} AS (SELECT ${compare
            .map(
              ({ inDb, inCode }, i) =>
                `${inDb} AS "*inDb-${i}*", ${inCode
                  .map((s, j) => `(${s}) "*inCode-${i}-${j}*"`)
                  .join(', ')}`,
            )
            .join(', ')} FROM ${source})`;
          await adapter.query(sql);
        } catch (err) {
          handle();
          return;
        }

        const {
          rows: [{ v }],
        } = await adapter.query<{ v: string }>(
          `SELECT pg_get_viewdef('${viewName}') v`,
        );

        await adapter.query(`DROP VIEW ${viewName}`);

        let pos = 7;
        const rgx = /\s+AS\s+"\*(inDb-\d+|inCode-\d+-\d+)\*",?/g;
        let match;
        let inDb = '';
        let codeI = 0;
        const matches = compare[0].inCode.map(() => true);
        while ((match = rgx.exec(v))) {
          const sql = v.slice(pos, rgx.lastIndex - match[0].length).trim();
          const arr = match[1].split('-');
          if (arr.length === 2) {
            inDb = sql;
            codeI = 0;
          } else {
            if (inDb !== sql) {
              matches[codeI] = false;
            }
            codeI++;
          }
          pos = rgx.lastIndex;
        }

        const firstMatching = matches.indexOf(true);
        handle(firstMatching === -1 ? undefined : firstMatching);
      }),
    );
  }

  for (const codeTable of createTables) {
    if (dropTables.length) {
      const index = await promptCreateOrRename(
        'table',
        codeTable.table,
        dropTables.map((x) => x.name),
      );
      if (index) {
        const drop = dropTables[index - 1];
        dropTables.splice(index - 1, 1);

        ast.push({
          type: 'renameType',
          kind: 'TABLE',
          fromSchema: drop.schemaName,
          from: drop.name,
          toSchema: codeTable.q.schema ?? currentSchema,
          to: codeTable.table,
        });

        continue;
      }
    }

    ast.push(createTableAst(currentSchema, codeTable));
  }

  for (const dbTable of dropTables) {
    ast.push(
      tableToAst(structureToAstCtx, dbStructure, dbTable, 'drop', domainsMap),
    );
  }

  return ast;
};

const createTableAst = (
  currentSchema: string,
  table: QueryWithTable,
): RakeDbAst.Table => {
  return {
    type: 'table',
    action: 'create',
    schema: table.q.schema === currentSchema ? undefined : table.q.schema,
    comment: table.internal.comment,
    name: table.table,
    shape: makeTableShape(table),
    ...(table.internal as TableData),
    noPrimaryKey: table.internal.noPrimaryKey ? 'ignore' : 'error',
  };
};

const makeTableShape = (table: QueryWithTable): ColumnsShape => {
  const shape: ColumnsShape = {};
  for (const key in table.shape) {
    const column = table.shape[key];
    if (!(column instanceof VirtualColumn)) {
      shape[key] = column as ColumnType;
    }
  }
  return shape;
};

const processTableChange = async (
  structureToAstCtx: StructureToAstCtx,
  dbStructure: IntrospectedStructure,
  domainsMap: DbStructureDomainsMap,
  ast: RakeDbAst[],
  currentSchema: string,
  config: AnyRakeDbConfig,
  dbTable: DbStructure.Table,
  codeTable: QueryWithTable,
  compareSql: CompareSql,
  compareExpressions: CompareExpression[],
) => {
  const shape: RakeDbAst.ChangeTableShape = {};
  const add: TableData = {};
  const drop: TableData = {};
  const schema = codeTable.q.schema ?? currentSchema;
  const tableName = codeTable.table;
  const changeTableAst: RakeDbAst.ChangeTable = {
    type: 'changeTable',
    schema,
    name: tableName,
    shape,
    add,
    drop,
  };
  const pushedChangeTableRef = { current: false };
  const tableData = getDbStructureTableData(dbStructure, dbTable);

  await processColumns(
    structureToAstCtx,
    dbStructure,
    domainsMap,
    dbTable,
    codeTable,
    tableData,
    shape,
    ast,
    currentSchema,
    compareSql,
    pushedChangeTableRef,
    changeTableAst,
  );

  const delayedAst: RakeDbAst[] = [];

  processPrimaryKey(
    delayedAst,
    tableData,
    codeTable,
    shape,
    add,
    drop,
    schema,
    tableName,
  );

  processIndexes(
    config,
    tableData,
    codeTable,
    shape,
    add,
    drop,
    delayedAst,
    ast,
    schema,
    tableName,
    compareExpressions,
    pushedChangeTableRef,
    changeTableAst,
  );

  if (
    Object.keys(shape).length ||
    Object.keys(add).length ||
    Object.keys(drop).length
  ) {
    pushedChangeTableRef.current = true;
    ast.push(changeTableAst);
  }

  if (delayedAst.length) ast.push(...delayedAst);
};
