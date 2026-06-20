import {
  concatSchemaAndName,
  DbStructure,
  IntrospectedStructure,
  RakeDbAst,
  getSchemaAndTableFromName,
} from 'rake-db';
import {
  Adapter,
  GeneratorIgnore,
  RlsPolicy,
  RawSqlBase,
  Rls,
} from 'pqb/internal';
import { CodeTable } from '../generate';
import { SqlExpression, compareSqlExpressions } from './generators.utils';

interface TableRlsState {
  enable: boolean;
  force: boolean;
}

interface NormalizedPolicy {
  name: string;
  as: RlsPolicy.PolicyMode;
  for: RlsPolicy.PolicyCommand;
  to: string[];
  using?: string;
  withCheck?: string;
}

interface GeneratorIgnoreRlsPolicy {
  table: string;
  names: string[];
}

interface GeneratorIgnoreRls {
  tables?: string[];
  policies?: GeneratorIgnoreRlsPolicy[];
}

interface GeneratorIgnoreWithRls extends GeneratorIgnore {
  rls?: GeneratorIgnoreRls;
}

const defaultRlsState: TableRlsState = {
  enable: false,
  force: true,
};

const normalizeRlsFlag = (value: unknown, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  return value === true || value === 'true' || value === 't';
};

export const processTableRls = async (
  adapter: Adapter,
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  tables: CodeTable[],
  currentSchema: string,
  generatorIgnore: GeneratorIgnore | undefined,
): Promise<void> => {
  const projectRlsDefaults = tables[0]?.internal.rls?.tableRlsDefaults;
  const ignore = generatorIgnore as GeneratorIgnoreWithRls | undefined;
  const ignoredTableSet = toIgnoredTableSet(ignore?.tables, currentSchema);
  const ignoredRlsTableSet = toIgnoredTableSet(
    ignore?.rls?.tables,
    currentSchema,
  );
  const ignoredPolicyMap = toIgnoredPolicyMap(
    ignore?.rls?.policies,
    currentSchema,
  );

  for (const table of tables) {
    const tableRls = table.internal.tableRls as Rls.TableConfig | undefined;
    if (!tableRls) continue;

    const schemaName = table.q.schema ?? currentSchema;
    const tableId = `${schemaName}.${table.table}`;
    if (ignoredTableSet.has(tableId) || ignoredRlsTableSet.has(tableId)) {
      continue;
    }

    const dbTable = dbStructure.tables.find(
      (item) => item.schemaName === schemaName && item.name === table.table,
    );
    const ignoredPolicyNames = ignoredPolicyMap.get(tableId);

    const codeRls: TableRlsState = {
      enable: normalizeRlsFlag(
        tableRls.enable ?? projectRlsDefaults?.enable,
        defaultRlsState.enable,
      ),
      force: normalizeRlsFlag(
        tableRls.force ?? projectRlsDefaults?.force,
        defaultRlsState.force,
      ),
    };
    const dbRls: TableRlsState = {
      enable: normalizeRlsFlag(dbTable?.rls?.enable, defaultRlsState.enable),
      force: normalizeRlsFlag(dbTable?.rls?.force, false),
    };
    const policyExpressionComparisons: SqlExpression[] = [];
    const policyChanges = collectPolicyChanges(
      schemaName,
      table.table,
      normalizeCodePolicies(tableRls, ignoredPolicyNames),
      normalizeDbPolicies(dbTable?.rls?.policies, ignoredPolicyNames),
      policyExpressionComparisons,
      concatSchemaAndName({ schema: schemaName, name: table.table }),
    );

    if (policyExpressionComparisons.length) {
      await compareSqlExpressions(policyExpressionComparisons, adapter);
    }

    const disableFirst = !codeRls.enable && dbRls.enable;

    if (!disableFirst) {
      pushPolicyChanges(ast, policyChanges);
    }

    if (codeRls.enable !== dbRls.enable) {
      ast.push({
        type: 'tableRls',
        action: codeRls.enable ? 'enable' : 'disable',
        schema: schemaName,
        table: table.table,
      });
    }

    if (codeRls.force !== dbRls.force) {
      ast.push({
        type: 'tableRls',
        action: codeRls.force ? 'force' : 'noForce',
        schema: schemaName,
        table: table.table,
      });
    }

    if (disableFirst) {
      pushPolicyChanges(ast, policyChanges);
    }
  }
};

const toIgnoredTableSet = (
  tables: string[] | undefined,
  currentSchema: string,
): Set<string> => {
  const ignored = new Set<string>();
  if (!tables) return ignored;

  for (const name of tables) {
    const [schema = currentSchema, table] = getSchemaAndTableFromName(
      currentSchema,
      name,
    );
    ignored.add(`${schema}.${table}`);
  }

  return ignored;
};

const toIgnoredPolicyMap = (
  items: GeneratorIgnoreRlsPolicy[] | undefined,
  currentSchema: string,
): Map<string, Set<string>> => {
  const result = new Map<string, Set<string>>();
  if (!items) return result;

  for (const item of items) {
    const [schema = currentSchema, table] = getSchemaAndTableFromName(
      currentSchema,
      item.table,
    );
    const key = `${schema}.${table}`;
    let set = result.get(key);
    if (!set) {
      set = new Set<string>();
      result.set(key, set);
    }
    for (const name of item.names) {
      set.add(name);
    }
  }

  return result;
};

const normalizeCodePolicies = (
  tableRls: Rls.TableConfig,
  ignoredPolicyNames: Set<string> | undefined,
): NormalizedPolicy[] => {
  const result: NormalizedPolicy[] = [];
  const permit = tableRls.permit ?? [];
  const restrict = tableRls.restrict ?? [];

  for (const policy of permit) {
    const normalized = normalizeCodePolicy('PERMISSIVE', policy);
    if (normalized && !ignoredPolicyNames?.has(normalized.name)) {
      result.push(normalized);
    }
  }

  for (const policy of restrict) {
    const normalized = normalizeCodePolicy('RESTRICTIVE', policy);
    if (normalized && !ignoredPolicyNames?.has(normalized.name)) {
      result.push(normalized);
    }
  }

  return result;
};

const normalizeCodePolicy = (
  as: RlsPolicy.PolicyMode,
  policy: RlsPolicy.Policy | undefined,
): NormalizedPolicy | undefined => {
  if (!policy?.name) return;

  return {
    name: policy.name,
    as,
    for: policy.for ?? 'ALL',
    to: normalizePolicyRoles(policy.to),
    using: toSqlText(policy.using),
    withCheck: toSqlText(policy.withCheck),
  };
};

const normalizeDbPolicies = (
  policies: DbStructure.RlsPolicy[] | undefined,
  ignoredPolicyNames: Set<string> | undefined,
): NormalizedPolicy[] => {
  if (!policies) return [];

  const result: NormalizedPolicy[] = [];
  for (const policy of policies) {
    if (ignoredPolicyNames?.has(policy.name)) continue;
    result.push({
      name: policy.name,
      as: policy.mode,
      for: policy.command,
      to: normalizePolicyRoles(policy.roles),
      using: policy.using,
      withCheck: policy.withCheck,
    });
  }

  return result;
};

const normalizePolicyRoles = (
  roles: string | string[] | undefined,
): string[] => {
  const result = (
    Array.isArray(roles) ? roles : roles ? [roles] : ['public']
  ).map((role) => (role.toLowerCase() === 'public' ? 'public' : role));
  return result.length ? result : ['public'];
};

const toSqlText = (value: RawSqlBase | undefined): string | undefined => {
  if (!value) return;
  const values: unknown[] = [];
  return value.toSQL({ values });
};

const collectPolicyChanges = (
  schema: string,
  table: string,
  codePolicies: NormalizedPolicy[],
  dbPolicies: NormalizedPolicy[],
  compareExpressions: SqlExpression[],
  source: string,
): RakeDbAst[] => {
  const changes: RakeDbAst[] = [];
  const dbPolicyMap = new Map<string, NormalizedPolicy>();
  for (const policy of dbPolicies) {
    dbPolicyMap.set(policy.name, policy);
  }

  const codePolicyMap = new Map<string, NormalizedPolicy>();
  for (const policy of codePolicies) {
    codePolicyMap.set(policy.name, policy);
  }

  const unmatchedCodePolicies: NormalizedPolicy[] = [];
  const unmatchedDbPolicies: NormalizedPolicy[] = [];

  for (const policy of codePolicies) {
    const dbPolicy = dbPolicyMap.get(policy.name);
    if (!dbPolicy) {
      unmatchedCodePolicies.push(policy);
      continue;
    }

    const recreate = policy.as !== dbPolicy.as || policy.for !== dbPolicy.for;
    const toChanged = !isSameStringArray(policy.to, dbPolicy.to);

    const from: RakeDbAst.PolicyChangeDefinition = {};
    const to: RakeDbAst.PolicyChangeDefinition = {};
    const codeUsing = policy.using;
    const dbUsing = dbPolicy.using;
    const codeWithCheck = policy.withCheck;
    const dbWithCheck = dbPolicy.withCheck;

    const hasUsing = codeUsing !== undefined || dbUsing !== undefined;
    const hasWithCheck =
      codeWithCheck !== undefined || dbWithCheck !== undefined;

    if (toChanged) {
      from.to = dbPolicy.to;
      to.to = policy.to;
    }

    const usingCanCompare = codeUsing !== undefined && dbUsing !== undefined;
    const withCheckCanCompare =
      codeWithCheck !== undefined && dbWithCheck !== undefined;

    const applyExpressionDiff = (matched: boolean) => {
      const usingChanged = usingCanCompare
        ? !matched
        : hasUsing && !usingCanCompare;
      const withCheckChanged = withCheckCanCompare
        ? !matched
        : hasWithCheck && !withCheckCanCompare;

      if (usingChanged) {
        from.using = dbPolicy.using;
        to.using = policy.using;
      }

      if (withCheckChanged) {
        from.withCheck = dbPolicy.withCheck;
        to.withCheck = policy.withCheck;
      }

      if (recreate) {
        changes.push({
          type: 'changePolicy',
          schema,
          table,
          name: policy.name,
          from: {
            as: dbPolicy.as,
            for: dbPolicy.for,
            to: dbPolicy.to,
            using: dbPolicy.using,
            withCheck: dbPolicy.withCheck,
          },
          to: {
            as: policy.as,
            for: policy.for,
            to: policy.to,
            using: policy.using,
            withCheck: policy.withCheck,
          },
        });
        return;
      }

      if (!Object.keys(from).length) return;
      changes.push({
        type: 'changePolicy',
        schema,
        table,
        name: policy.name,
        from,
        to,
      });
    };

    if (!hasUsing && !hasWithCheck) {
      applyExpressionDiff(true);
      continue;
    }

    const compare: SqlExpression['compare'] = [];
    if (usingCanCompare) {
      compare.push({
        inDb: dbUsing,
        inCode: [codeUsing],
      });
    }
    if (withCheckCanCompare) {
      compare.push({
        inDb: dbWithCheck,
        inCode: [codeWithCheck],
      });
    }

    if (!compare.length) {
      applyExpressionDiff(false);
      continue;
    }

    compareExpressions.push({
      source,
      compare,
      handle(i) {
        applyExpressionDiff(i !== undefined);
      },
    });
  }

  for (const policy of dbPolicies) {
    if (codePolicyMap.has(policy.name)) continue;
    unmatchedDbPolicies.push(policy);
  }

  const pairedDbPolicyNames = new Set<string>();
  const pairedCodePolicyNames = new Set<string>();
  for (const policy of unmatchedCodePolicies) {
    const renamedFrom = unmatchedDbPolicies.find(
      (item) =>
        !pairedDbPolicyNames.has(item.name) &&
        item.as === policy.as &&
        item.for === policy.for,
    );
    if (!renamedFrom) continue;

    pairedDbPolicyNames.add(renamedFrom.name);
    pairedCodePolicyNames.add(policy.name);
    changes.push({
      type: 'changePolicy',
      schema,
      table,
      name: renamedFrom.name,
      from: {
        name: renamedFrom.name,
        to: renamedFrom.to,
        using: renamedFrom.using,
        withCheck: renamedFrom.withCheck,
      },
      to: {
        name: policy.name,
        to: policy.to,
        using: policy.using,
        withCheck: policy.withCheck,
      },
    });
  }

  for (const policy of unmatchedCodePolicies) {
    if (pairedCodePolicyNames.has(policy.name)) continue;

    changes.push({
      type: 'policy',
      action: 'create',
      schema,
      table,
      name: policy.name,
      as: policy.as,
      for: policy.for,
      to: policy.to,
      using: policy.using,
      withCheck: policy.withCheck,
    });
  }

  for (const policy of unmatchedDbPolicies) {
    if (pairedDbPolicyNames.has(policy.name)) continue;
    changes.push({
      type: 'policy',
      action: 'drop',
      schema,
      table,
      name: policy.name,
      as: policy.as,
      for: policy.for,
      to: policy.to,
      using: policy.using,
      withCheck: policy.withCheck,
    });
  }

  return changes;
};

const pushPolicyChanges = (ast: RakeDbAst[], changes: RakeDbAst[]) => {
  for (const change of changes) {
    ast.push(change);
  }
};

const isSameStringArray = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};
