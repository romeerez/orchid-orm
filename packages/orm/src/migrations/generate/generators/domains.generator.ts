import { Adapter, ArrayColumn, ColumnType, RawSQL } from 'pqb';
import {
  RakeDbAst,
  getSchemaAndTableFromName,
  DbStructure,
  IntrospectedStructure,
  DbStructureDomainsMap,
  instantiateDbColumn,
  StructureToAstCtx,
} from 'rake-db';
import {
  ColumnDataCheckBase,
  deepCompare,
  TemplateLiteralArgs,
} from 'orchid-core';
import { getColumnDbType } from './columns.generator';
import {
  CompareExpression,
  compareSqlExpressions,
  TableExpression,
} from './generators.utils';

interface ComparableDomainCompare
  extends Omit<DbStructure.Domain, 'schemaName' | 'name'> {
  hasDefault: boolean;
  hasCheck: boolean;
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
  adapter: Adapter,
  structureToAstCtx: StructureToAstCtx,
  domainsMap: DbStructureDomainsMap,
  dbStructure: IntrospectedStructure,
  currentSchema: string,
  domains: CodeDomain[],
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

    if (domain.check) {
      dbColumn.data.check = {
        sql: new RawSQL([[domain.check]] as unknown as TemplateLiteralArgs),
      };
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

    if ((domain.default || domain.check) && found.length) {
      for (const codeDomain of found) {
        holdCodeDomains.add(codeDomain);
      }

      const compare: CompareExpression['compare'] = [];
      pushCompare(compare, domain, found, 'default');
      pushCompare(compare, domain, found, 'check');

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
      }

      codeDomains.splice(i, 1);
    } else {
      ast.push(dropAst(dbDomain));
    }
  }

  for (const codeDomain of codeDomains) {
    if (!holdCodeDomains.has(codeDomain)) {
      ast.push(createAst(codeDomain));
    }
  }

  if (tableExpressions.length) {
    await compareSqlExpressions(tableExpressions, adapter);

    if (holdCodeDomains.size) {
      for (const codeDomain of holdCodeDomains.keys()) {
        ast.push(createAst(codeDomain));
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
      hasCheck: column.data.check !== undefined,
    },
  };
};

const pushCompare = (
  compare: CompareExpression['compare'],
  domain: DbStructure.Domain,
  found: ComparableDomain[],
  key: 'default' | 'check',
) => {
  const inDb = domain[key];
  if (inDb) {
    compare.push({
      inDb,
      inCode: found.map((codeDomain) => {
        const value = codeDomain.column.data[key];
        if ('sql' in (value as ColumnDataCheckBase)) {
          return (value as ColumnDataCheckBase).sql;
        }
        return value as string;
      }),
    });
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
