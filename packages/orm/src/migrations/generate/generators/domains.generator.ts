import {
  ArrayColumn,
  ColumnType,
  DbStructureDomainsMap,
  RawSQL,
  AdapterBase,
  ColumnDataCheckBase,
  deepCompare,
  emptyArray,
  TemplateLiteralArgs,
} from 'pqb';
import {
  RakeDbAst,
  getSchemaAndTableFromName,
  DbStructure,
  IntrospectedStructure,
  instantiateDbColumn,
} from 'rake-db';
import { getColumnDbType } from './columns.generator';
import {
  CompareExpression,
  compareSqlExpressions,
  TableExpression,
} from './generators.utils';
import { ComposeMigrationParams, PendingDbTypes } from '../composeMigration';

interface ComparableDomainCompare
  extends Omit<DbStructure.Domain, 'schemaName' | 'name'> {
  hasDefault: boolean;
  hasChecks: boolean;
}

interface ComparableDomain {
  schemaName: string;
  name: string;
  column: ColumnType;
  compare: ComparableDomainCompare;
}

export interface CodeDomain {
  schemaName: string;
  name: string;
  column: ColumnType;
}

export const processDomains = async (
  ast: RakeDbAst[],
  adapter: AdapterBase,
  domainsMap: DbStructureDomainsMap,
  dbStructure: IntrospectedStructure,
  {
    codeItems: { domains },
    structureToAstCtx,
    currentSchema,
    internal: { generatorIgnore },
  }: ComposeMigrationParams,
  pendingDbTypes: PendingDbTypes,
) => {
  const codeDomains: ComparableDomain[] = [];
  if (domains) {
    for (const { schemaName, name, column } of domains) {
      codeDomains.push(
        makeComparableDomain(currentSchema, schemaName, name, column),
      );
    }
  }

  const tableExpressions: TableExpression[] = [];
  const holdCodeDomains = new Set<ComparableDomain>();

  for (const domain of dbStructure.domains) {
    if (
      generatorIgnore?.schemas?.includes(domain.schemaName) ||
      generatorIgnore?.domains?.includes(domain.name)
    ) {
      continue;
    }

    const dbColumn = instantiateDbColumn(
      structureToAstCtx,
      dbStructure,
      domainsMap,
      {
        // not destructuring `domain` because need to ignore `numericPrecision`, `numericScale`, etc.,
        // that are loaded from db, but not defined in the code
        schemaName: domain.typeSchema,
        tableName: 'N/A',
        name: domain.name,
        typeSchema: domain.typeSchema,
        type: domain.type,
        arrayDims: domain.arrayDims,
        default: domain.default,
        isNullable: domain.isNullable,
        collate: domain.collate,
        maxChars: domain.maxChars,
        typmod: -1,
      },
    );

    if (domain.checks) {
      dbColumn.data.checks = domain.checks.map((check) => ({
        sql: new RawSQL([[check]] as unknown as TemplateLiteralArgs),
      }));
    }

    const dbDomain = makeComparableDomain(
      currentSchema,
      domain.schemaName,
      domain.name,
      dbColumn,
    );

    const found = codeDomains.filter((codeDomain) =>
      deepCompare(dbDomain.compare, codeDomain.compare),
    );

    if ((domain.default || domain.checks?.length) && found.length) {
      for (const codeDomain of found) {
        holdCodeDomains.add(codeDomain);
      }

      const compare: CompareExpression['compare'] = [];
      pushCompareDefault(compare, domain, found);
      pushCompareChecks(compare, domain, found);

      const source = `(VALUES (NULL::${getColumnDbType(
        dbColumn,
        currentSchema,
      )})) t(value)`;

      tableExpressions.push({
        compare,
        source,
        handle(i) {
          const codeDomain = i === undefined ? undefined : found[i];
          if (!codeDomain) {
            ast.push(dropAst(dbDomain));
          } else {
            holdCodeDomains.delete(codeDomain);
          }
        },
      });
    } else if (found.length) {
      let i = codeDomains.findIndex(
        (codeDomain) =>
          codeDomain.name === dbDomain.name &&
          codeDomain.schemaName === dbDomain.schemaName,
      );
      if (i === -1) {
        i = 0;
        const first = found[0];
        ast.push({
          type: 'renameType',
          kind: 'DOMAIN',
          fromSchema: dbDomain.schemaName,
          from: dbDomain.name,
          toSchema: first.schemaName,
          to: first.name,
        });
        pendingDbTypes.add(first.schemaName, first.name);
      }

      codeDomains.splice(i, 1);
    } else {
      ast.push(dropAst(dbDomain));
    }
  }

  for (const codeDomain of codeDomains) {
    if (!holdCodeDomains.has(codeDomain)) {
      ast.push(createAst(codeDomain));
      pendingDbTypes.add(codeDomain.schemaName, codeDomain.name);
    }
  }

  if (tableExpressions.length) {
    await compareSqlExpressions(tableExpressions, adapter);

    if (holdCodeDomains.size) {
      for (const codeDomain of holdCodeDomains.keys()) {
        ast.push(createAst(codeDomain));
        pendingDbTypes.add(codeDomain.schemaName, codeDomain.name);
      }
    }
  }
};

const makeComparableDomain = (
  currentSchema: string,
  schemaName: string,
  name: string,
  column: ColumnType,
): ComparableDomain => {
  let arrayDims = 0;
  const isNullable = column.data.isNullable ?? false;
  let inner = column;
  while (inner instanceof ArrayColumn) {
    inner = inner.data.item;
    arrayDims++;
  }
  const fullType = getColumnDbType(inner, currentSchema);
  const [typeSchema = 'pg_catalog', type] = getSchemaAndTableFromName(fullType);

  return {
    schemaName,
    name,
    column,
    compare: {
      type,
      typeSchema,
      arrayDims,
      isNullable,
      maxChars: inner.data.maxChars,
      numericPrecision: inner.data.numericPrecision,
      numericScale: inner.data.numericScale,
      dateTimePrecision: inner.data.dateTimePrecision,
      collate: column.data.collate,
      hasDefault: column.data.default !== undefined,
      hasChecks: !!column.data.checks?.length,
    },
  };
};

const pushCompareDefault = (
  compare: CompareExpression['compare'],
  domain: DbStructure.Domain,
  found: ComparableDomain[],
) => {
  if (domain.default) {
    compare.push({
      inDb: domain.default,
      inCode: found.map((codeDomain) => {
        const value = codeDomain.column.data.default;
        if ('sql' in (value as ColumnDataCheckBase)) {
          return (value as ColumnDataCheckBase).sql;
        }
        return value as string;
      }),
    });
  }
};

const pushCompareChecks = (
  compare: CompareExpression['compare'],
  domain: DbStructure.Domain,
  found: ComparableDomain[],
) => {
  if (domain.checks?.length) {
    const inCode = found.flatMap(
      (codeDomain) =>
        codeDomain.column.data.checks?.map((check) =>
          typeof check === 'string' ? check : check.sql,
        ) || emptyArray,
    );

    compare.push(
      ...domain.checks.map((check) => ({
        inDb: check,
        inCode,
      })),
    );
  }
};

const dropAst = (dbDomain: ComparableDomain): RakeDbAst.Domain => ({
  type: 'domain',
  action: 'drop',
  schema: dbDomain.schemaName,
  name: dbDomain.name,
  baseType: dbDomain.column,
});

const createAst = (codeDomain: ComparableDomain): RakeDbAst.Domain => ({
  type: 'domain',
  action: 'create',
  schema: codeDomain.schemaName,
  name: codeDomain.name,
  baseType: codeDomain.column,
});
