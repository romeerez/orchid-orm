import { getSchemaAndTableFromName, quoteTable } from '../common';
import { quoteIdentifier, RawSqlBase, type RlsPolicy } from 'pqb/internal';
import { Migration } from './migration';

const actionToSql = {
  enable: 'ENABLE ROW LEVEL SECURITY',
  disable: 'DISABLE ROW LEVEL SECURITY',
  force: 'FORCE ROW LEVEL SECURITY',
  noForce: 'NO FORCE ROW LEVEL SECURITY',
} as const;

type RlsAction = keyof typeof actionToSql;

interface RlsPolicyForSelectOrDelete {
  for: 'SELECT' | 'DELETE';
  using: RawSqlBase;
  withCheck?: never;
}

interface RlsPolicyForInsert {
  for: 'INSERT';
  using?: never;
  withCheck: RawSqlBase;
}

interface RlsPolicyForAllOrUpdate {
  for?: 'ALL' | 'UPDATE';
  using: RawSqlBase;
  withCheck: RawSqlBase;
}

type RlsPolicyExpressions =
  | RlsPolicyForSelectOrDelete
  | RlsPolicyForInsert
  | RlsPolicyForAllOrUpdate;

export type RlsPolicyDefinition = RlsPolicyExpressions & {
  as: RlsPolicy.PolicyMode;
  to?: string | string[];
};

export interface ChangeRlsPolicyAlterDefinition {
  name?: string;
  to?: string | string[];
  using?: RawSqlBase;
  withCheck?: RawSqlBase;
}

export type ChangeRlsPolicyRecreateDefinition = RlsPolicyDefinition & {
  table?: string;
  name?: string;
};

export type ChangeRlsPolicyParams =
  | {
      from: ChangeRlsPolicyAlterDefinition;
      to: ChangeRlsPolicyAlterDefinition;
    }
  | {
      from: ChangeRlsPolicyRecreateDefinition;
      to: ChangeRlsPolicyRecreateDefinition;
    };

const setRls = async (
  migration: Migration,
  tableName: string,
  action: RlsAction,
): Promise<void> => {
  const [schema, table] = getSchemaAndTableFromName(
    migration.adapter.getSchema(),
    tableName,
  );

  await migration.adapter.arrays(
    `ALTER TABLE ${quoteTable(schema, table)} ${actionToSql[action]}`,
  );
};

export const enableOrDisableRls = (
  migration: Migration,
  up: boolean,
  tableName: string,
): Promise<void> => {
  return setRls(migration, tableName, up ? 'enable' : 'disable');
};

export const forceOrNoForceRls = (
  migration: Migration,
  up: boolean,
  tableName: string,
): Promise<void> => {
  return setRls(migration, tableName, up ? 'force' : 'noForce');
};

const quotedRoles = (
  roles: string | string[] | undefined,
): string | undefined => {
  if (!roles) return;

  const arr = Array.isArray(roles) ? roles : [roles];
  if (!arr.length) return;

  return arr.map(quoteIdentifier).join(', ');
};

const normalizeRoles = (
  roles: string | string[] | undefined,
): string[] | undefined => {
  if (!roles) return;
  return Array.isArray(roles) ? roles : [roles];
};

const rolesEqual = (
  a: string | string[] | undefined,
  b: string | string[] | undefined,
): boolean => {
  const left = normalizeRoles(a);
  const right = normalizeRoles(b);
  return JSON.stringify(left) === JSON.stringify(right);
};

const rawSql = (_migration: Migration, sql: RawSqlBase, values: unknown[]) =>
  sql.toSQL({ values });

const createPolicySql = (
  migration: Migration,
  tableName: string,
  policyName: string,
  params: RlsPolicyDefinition,
): { text: string; values: unknown[] } => {
  const [schema, table] = getSchemaAndTableFromName(
    migration.adapter.getSchema(),
    tableName,
  );
  const values: unknown[] = [];
  const rolesSql = quotedRoles(params.to);
  let usingSql: string | undefined;
  let withCheckSql: string | undefined;

  if (params.for === 'SELECT' || params.for === 'DELETE') {
    usingSql = rawSql(migration, params.using, values);
  } else if (params.for === 'INSERT') {
    withCheckSql = rawSql(migration, params.withCheck, values);
  } else {
    if (!params.withCheck) {
      throw new Error('WITH CHECK is required for ALL and UPDATE policies');
    }
    usingSql = rawSql(migration, params.using, values);
    withCheckSql = rawSql(migration, params.withCheck, values);
  }

  return {
    text: `CREATE POLICY ${quoteIdentifier(policyName)}
ON ${quoteTable(schema, table)}
AS ${params.as}
FOR ${params.for ?? 'ALL'}${
      rolesSql
        ? `
TO ${rolesSql}`
        : ''
    }${
      usingSql
        ? `
USING (${usingSql})`
        : ''
    }${
      withCheckSql
        ? `
WITH CHECK (${withCheckSql})`
        : ''
    }`,
    values,
  };
};

const dropPolicySql = (
  migration: Migration,
  tableName: string,
  policyName: string,
): string => {
  const [schema, table] = getSchemaAndTableFromName(
    migration.adapter.getSchema(),
    tableName,
  );

  return `DROP POLICY ${quoteIdentifier(policyName)} ON ${quoteTable(schema, table)}`;
};

export const createOrDropPolicy = async (
  migration: Migration,
  up: boolean,
  tableName: string,
  policyName: string,
  params: RlsPolicyDefinition,
): Promise<void> => {
  if (up) {
    const { text, values } = createPolicySql(
      migration,
      tableName,
      policyName,
      params,
    );
    await migration.adapter.arrays(text, values);
  } else {
    await migration.adapter.arrays(
      dropPolicySql(migration, tableName, policyName),
    );
  }
};

const isRecreateDefinition = (
  value: ChangeRlsPolicyAlterDefinition | ChangeRlsPolicyRecreateDefinition,
): value is ChangeRlsPolicyRecreateDefinition => {
  return 'as' in value || 'for' in value || 'table' in value;
};

const changePolicyInPlace = async (
  migration: Migration,
  tableName: string,
  policyName: string,
  from: ChangeRlsPolicyAlterDefinition,
  to: ChangeRlsPolicyAlterDefinition,
): Promise<void> => {
  const [schema, table] = getSchemaAndTableFromName(
    migration.adapter.getSchema(),
    tableName,
  );
  const quotedTable = quoteTable(schema, table);

  let currentName = from.name ?? policyName;
  const targetName = to.name ?? policyName;

  if (currentName !== targetName) {
    await migration.adapter.arrays(
      `ALTER POLICY ${quoteIdentifier(currentName)}
ON ${quotedTable}
RENAME TO ${quoteIdentifier(targetName)}`,
    );
    currentName = targetName;
  }

  if ('to' in from && 'to' in to && !rolesEqual(from.to, to.to)) {
    await migration.adapter.arrays(
      `ALTER POLICY ${quoteIdentifier(currentName)}
ON ${quotedTable}
TO ${quotedRoles(to.to) ?? 'PUBLIC'}`,
    );
  }

  if ('using' in from && 'using' in to && from.using && to.using) {
    const fromUsingValues: unknown[] = [];
    const fromUsing = rawSql(migration, from.using, fromUsingValues);
    const toUsingValues: unknown[] = [];
    const toUsing = rawSql(migration, to.using, toUsingValues);

    if (fromUsing !== toUsing) {
      await migration.adapter.arrays(
        `ALTER POLICY ${quoteIdentifier(currentName)}
ON ${quotedTable}
USING (${toUsing})`,
        toUsingValues,
      );
    }
  }

  if (
    'withCheck' in from &&
    'withCheck' in to &&
    from.withCheck &&
    to.withCheck
  ) {
    const fromWithCheckValues: unknown[] = [];
    const fromWithCheck = rawSql(
      migration,
      from.withCheck,
      fromWithCheckValues,
    );
    const toWithCheckValues: unknown[] = [];
    const toWithCheck = rawSql(migration, to.withCheck, toWithCheckValues);

    if (fromWithCheck !== toWithCheck) {
      await migration.adapter.arrays(
        `ALTER POLICY ${quoteIdentifier(currentName)}
ON ${quotedTable}
WITH CHECK (${toWithCheck})`,
        toWithCheckValues,
      );
    }
  }
};

const recreatePolicy = async (
  migration: Migration,
  tableName: string,
  policyName: string,
  from: ChangeRlsPolicyRecreateDefinition,
  to: ChangeRlsPolicyRecreateDefinition,
): Promise<void> => {
  const fromTable = from.table ?? tableName;
  const fromName = from.name ?? policyName;

  await migration.adapter.arrays(dropPolicySql(migration, fromTable, fromName));

  const toTable = to.table ?? tableName;
  const toName = to.name ?? policyName;
  const { text, values } = createPolicySql(migration, toTable, toName, to);
  await migration.adapter.arrays(text, values);
};

export const changePolicy = async (
  migration: Migration,
  up: boolean,
  tableName: string,
  policyName: string,
  params: ChangeRlsPolicyParams,
): Promise<void> => {
  const from = (up ? params.from : params.to) as
    | ChangeRlsPolicyAlterDefinition
    | ChangeRlsPolicyRecreateDefinition;
  const to = (up ? params.to : params.from) as
    | ChangeRlsPolicyAlterDefinition
    | ChangeRlsPolicyRecreateDefinition;

  if (isRecreateDefinition(from) || isRecreateDefinition(to)) {
    await recreatePolicy(
      migration,
      tableName,
      policyName,
      from as ChangeRlsPolicyRecreateDefinition,
      to as ChangeRlsPolicyRecreateDefinition,
    );
  } else {
    await changePolicyInPlace(migration, tableName, policyName, from, to);
  }
};
export const dropOrCreatePolicy = (
  migration: Migration,
  up: boolean,
  tableName: string,
  policyName: string,
  params: RlsPolicyDefinition,
): Promise<void> => {
  return createOrDropPolicy(migration, !up, tableName, policyName, params);
};
