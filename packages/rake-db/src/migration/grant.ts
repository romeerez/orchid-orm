import { Grant as PqbGrant } from 'pqb/internal';
import { Migration } from './migration';
import { getSchemaAndTableFromName } from '../common';

export type RevokeMode = 'CASCADE' | 'RESTRICT';

export type GrantMigrationArg = PqbGrant.Privilege & {
  revokeMode?: RevokeMode;
};

export interface GrantPrivilege extends PqbGrant.InternalPrivilege {
  action: 'grant' | 'revoke';
  revokeMode?: RevokeMode;
}

type ConcreteTargetKey =
  | 'tables'
  | 'sequences'
  | 'routines'
  | 'types'
  | 'domains';

type SchemaWideTargetKey = 'allTablesIn' | 'allSequencesIn' | 'allRoutinesIn';

type SchemaOrDatabaseTargetKey = 'schemas' | 'databases';

const concreteTargetKeyToSql: Record<ConcreteTargetKey, string> = {
  tables: 'TABLE',
  sequences: 'SEQUENCE',
  routines: 'ROUTINE',
  types: 'TYPE',
  domains: 'DOMAIN',
};

const schemaWideTargetKeyToSql: Record<SchemaWideTargetKey, string> = {
  allTablesIn: 'ALL TABLES IN SCHEMA',
  allSequencesIn: 'ALL SEQUENCES IN SCHEMA',
  allRoutinesIn: 'ALL ROUTINES IN SCHEMA',
};

const schemaOrDatabaseTargetKeyToSql: Record<
  SchemaOrDatabaseTargetKey,
  string
> = {
  schemas: 'SCHEMA',
  databases: 'DATABASE',
};

export const changeGrant = async (
  migration: Migration,
  up: boolean,
  params: GrantMigrationArg,
): Promise<void> => {
  const ast: GrantPrivilege = {
    ...params,
    to: typeof params.to === 'string' ? [params.to] : params.to,
    action: up ? 'grant' : 'revoke',
  };

  const sql = privilegeToSql(migration, ast);

  if (sql.length) {
    await migration.adapter.arrays(sql.join(';\n'));
  }
};

const privilegeToSql = (
  migration: Migration,
  ast: GrantPrivilege,
): string[] => {
  const queries: string[] = [];
  const isRevoke = ast.action === 'revoke';
  const currentSchema = migration.adapter.getSchema();

  const concreteTargetKeys: ConcreteTargetKey[] = [
    'tables',
    'sequences',
    'routines',
    'types',
    'domains',
  ];

  for (const key of concreteTargetKeys) {
    const targetNames = ast[key];
    if (!targetNames?.length) continue;

    const privileges = ast.privileges;
    const grantablePrivileges = ast.grantablePrivileges;

    // Apply default schema for unqualified names
    const quotedTargets = targetNames.map((name) => {
      const [schema, objName] = getSchemaAndTableFromName(currentSchema, name);
      if (schema) {
        return `"${schema}"."${objName}"`;
      }
      // For routines, keep the name as-is (schema-less)
      return `"${objName}"`;
    });

    addTargetQueries(
      queries,
      ast,
      `ON ${concreteTargetKeyToSql[key]} ${quotedTargets.join(', ')}`,
      privileges,
      grantablePrivileges,
      isRevoke,
    );
  }

  // Process schema-wide targets (schema names, already qualified)
  const schemaWideTargetKeys: SchemaWideTargetKey[] = [
    'allTablesIn',
    'allSequencesIn',
    'allRoutinesIn',
  ];

  for (const key of schemaWideTargetKeys) {
    const targetNames = ast[key];
    if (!targetNames?.length) continue;

    const targetList = targetNames.map((name) => `"${name}"`);

    const privileges = ast.privileges;
    const grantablePrivileges = ast.grantablePrivileges;

    addTargetQueries(
      queries,
      ast,
      `ON ${schemaWideTargetKeyToSql[key]} ${targetList.join(', ')}`,
      privileges,
      grantablePrivileges,
      isRevoke,
    );
  }

  // Process schema and database targets.
  const schemaOrDatabaseTargetKeys: SchemaOrDatabaseTargetKey[] = [
    'schemas',
    'databases',
  ];

  for (const key of schemaOrDatabaseTargetKeys) {
    const targetNames = ast[key];
    if (!targetNames?.length) continue;

    const targetList = targetNames.map((name) => `"${name}"`);

    const privileges = ast.privileges;
    const grantablePrivileges = ast.grantablePrivileges;

    addTargetQueries(
      queries,
      ast,
      `ON ${schemaOrDatabaseTargetKeyToSql[key]} ${targetList.join(', ')}`,
      privileges,
      grantablePrivileges,
      isRevoke,
    );
  }

  return queries;
};

const addTargetQueries = (
  queries: string[],
  ast: GrantPrivilege,
  targetSql: string,
  privileges: string[] | undefined,
  grantablePrivileges: string[] | undefined,
  isRevoke: boolean,
): void => {
  if (privileges?.length) {
    queries.push(buildQuery(ast, privileges, targetSql, false, isRevoke));
  }

  if (grantablePrivileges?.length) {
    queries.push(
      buildQuery(ast, grantablePrivileges, targetSql, true, isRevoke),
    );
  }
};

const buildQuery = (
  ast: GrantPrivilege,
  privileges: string[],
  targetSql: string,
  grantable: boolean,
  isRevoke: boolean,
): string => {
  const parts: string[] = [];

  if (isRevoke) {
    parts.push('REVOKE');
    if (grantable) {
      parts.push('GRANT OPTION FOR');
    }
  } else {
    parts.push('GRANT');
  }

  // Convert ALL to ALL PRIVILEGES and TEMP to TEMPORARY for SQL output
  const privilegeList = privileges
    .map((p) =>
      p === 'ALL' ? 'ALL PRIVILEGES' : p === 'TEMP' ? 'TEMPORARY' : p,
    )
    .join(', ');
  parts.push(privilegeList);

  parts.push(targetSql);

  if (isRevoke) {
    parts.push('FROM');
  } else {
    parts.push('TO');
  }

  parts.push(ast.to.map((role) => `"${role}"`).join(', '));

  if (ast.grantedBy) {
    parts.push('GRANTED BY', `"${ast.grantedBy}"`);
  }

  if (isRevoke && ast.revokeMode) {
    parts.push(ast.revokeMode);
  }

  if (!isRevoke && grantable) {
    parts.push('WITH GRANT OPTION');
  }

  return parts.join(' ');
};
