import { Migration } from './migration';
import { RakeDbAst } from '../ast';
import { DefaultPrivileges } from 'pqb';

type ObjectType =
  | 'tables'
  | 'sequences'
  | 'functions'
  | 'types'
  | 'schemas'
  | 'largeObjects';

const SCHEMA_OBJECT_TYPES: ObjectType[] = [
  'tables',
  'sequences',
  'functions',
  'types',
];

const GLOBAL_ONLY_OBJECT_TYPES: ObjectType[] = ['schemas', 'largeObjects'];

const ALL_OBJECT_TYPES: ObjectType[] = [
  ...SCHEMA_OBJECT_TYPES,
  ...GLOBAL_ONLY_OBJECT_TYPES,
];

const objectTypeToSql: Record<ObjectType, string> = {
  tables: 'TABLES',
  sequences: 'SEQUENCES',
  functions: 'FUNCTIONS',
  types: 'TYPES',
  schemas: 'SCHEMAS',
  largeObjects: 'LARGE OBJECTS',
};

// Process and filter privileges for a single object type, removing duplicates from grantable
const processObjectPrivileges = <T>(
  value: DefaultPrivilegeObjectSetting<T> | undefined,
): { privileges?: T[]; grantablePrivileges?: T[] } | undefined => {
  if (!value) return undefined;

  const { privileges, grantablePrivileges } = value;

  const grantableSet = new Set(grantablePrivileges ?? []);
  const filteredPrivileges = privileges?.filter((p) => !grantableSet.has(p));

  const result: { privileges?: T[]; grantablePrivileges?: T[] } = {};
  if (filteredPrivileges?.length) {
    result.privileges = [...filteredPrivileges];
  }
  if (grantablePrivileges?.length) {
    result.grantablePrivileges = [...grantablePrivileges];
  }

  return Object.keys(result).length ? result : undefined;
};

const filterAndTransformConfig = (
  config: DefaultPrivilegeObjectConfig | undefined,
  schema: string | undefined,
): RakeDbAst.DefaultPrivilegeObjectConfig | undefined => {
  if (!config) return undefined;

  const objectTypes = schema ? SCHEMA_OBJECT_TYPES : ALL_OBJECT_TYPES;

  // Start with either allGrantable, all, or empty base
  const result: RakeDbAst.DefaultPrivilegeObjectConfig = {};

  // Handle allGrantable first (takes precedence over all)
  if (config.allGrantable) {
    for (const key of objectTypes) {
      result[key] = { grantablePrivileges: ['ALL'] };
    }
  } else if (config.all) {
    // Handle all
    for (const key of objectTypes) {
      result[key] = { privileges: ['ALL'] };
    }
  }

  // Merge specific object type configs on top of the base
  for (const key of ALL_OBJECT_TYPES) {
    const value = config[key];
    if (!value) continue;

    // Process and merge on top of any existing config (from all/allGrantable)
    const processed = processObjectPrivileges(value);
    if (processed) {
      result[key] = processed;
    }
  }

  return Object.keys(result).length ? result : undefined;
};

interface DefaultPrivilegeObjectSetting<T> {
  privileges?: readonly T[];
  grantablePrivileges?: readonly T[];
}

interface DefaultPrivilegeObjectConfig {
  all?: boolean;
  allGrantable?: boolean;
  tables?: DefaultPrivilegeObjectSetting<DefaultPrivileges.Privilege['Table']>;
  sequences?: DefaultPrivilegeObjectSetting<
    DefaultPrivileges.Privilege['Sequence']
  >;
  functions?: DefaultPrivilegeObjectSetting<
    DefaultPrivileges.Privilege['Function']
  >;
  types?: DefaultPrivilegeObjectSetting<DefaultPrivileges.Privilege['Type']>;
  schemas?: DefaultPrivilegeObjectSetting<
    DefaultPrivileges.Privilege['Schema']
  >;
  largeObjects?: DefaultPrivilegeObjectSetting<
    DefaultPrivileges.Privilege['LargeObject']
  >;
}

export interface ChangeDefaultPrivilegesArg {
  owner?: string;
  grantee: string;
  schema?: string;
  grant?: DefaultPrivilegeObjectConfig;
  revoke?: DefaultPrivilegeObjectConfig;
}

export const changeDefaultPrivileges = async (
  migration: Migration,
  up: boolean,
  arg: ChangeDefaultPrivilegesArg,
): Promise<void> => {
  const ast = makeAst(up, arg);
  const sql = astToSql(ast);

  if (sql.length) {
    await migration.adapter.arrays(sql.join(';\n'));
  }
};

const makeAst = (
  up: boolean,
  arg: ChangeDefaultPrivilegesArg,
): RakeDbAst.DefaultPrivilege => {
  if (!up) {
    // Swap grant and revoke when rolling back
    const { grant, revoke } = arg;
    arg = {
      ...arg,
      grant: revoke,
      revoke: grant,
    };
  }

  return {
    type: 'defaultPrivilege',
    owner: arg.owner,
    grantee: arg.grantee,
    schema: arg.schema,
    grant: filterAndTransformConfig(arg.grant, arg.schema),
    revoke: filterAndTransformConfig(arg.revoke, arg.schema),
  };
};

const astToSql = (ast: RakeDbAst.DefaultPrivilege): string[] => {
  const queries: string[] = [];

  if (ast.grant) {
    queries.push(...objectConfigToSql(ast, ast.grant, 'GRANT'));
  }

  if (ast.revoke) {
    queries.push(...objectConfigToSql(ast, ast.revoke, 'REVOKE'));
  }

  return queries;
};

const objectConfigToSql = (
  ast: RakeDbAst.DefaultPrivilege,
  config: NonNullable<RakeDbAst.DefaultPrivilege['grant']>,
  action: 'GRANT' | 'REVOKE',
): string[] => {
  const queries: string[] = [];

  for (const [key, value] of Object.entries(config)) {
    const objectType = key as ObjectType;
    if (!value) continue;

    const { privileges, grantablePrivileges } = value;

    if (privileges?.length) {
      queries.push(buildQuery(ast, objectType, privileges, false, action));
    }

    if (grantablePrivileges?.length) {
      queries.push(
        buildQuery(ast, objectType, grantablePrivileges, true, action),
      );
    }
  }

  return queries;
};

const buildQuery = (
  ast: RakeDbAst.DefaultPrivilege,
  objectType: ObjectType,
  privileges: string[],
  grantable: boolean,
  action: 'GRANT' | 'REVOKE',
): string => {
  const parts: string[] = ['ALTER DEFAULT PRIVILEGES'];
  if (ast.owner) {
    parts.push(`FOR ROLE "${ast.owner}"`);
  }

  if (ast.schema) {
    parts.push(`IN SCHEMA "${ast.schema}"`);
  }

  // Convert ALL to ALL PRIVILEGES for SQL output
  const privilegeList = privileges
    .map((p) => (p === 'ALL' ? 'ALL PRIVILEGES' : p))
    .join(', ');

  if (action === 'GRANT') {
    parts.push(
      `GRANT ${privilegeList} ON ${objectTypeToSql[objectType]} TO "${ast.grantee}"`,
    );
    if (grantable) {
      parts.push('WITH GRANT OPTION');
    }
  } else {
    parts.push(
      `REVOKE ${privilegeList} ON ${objectTypeToSql[objectType]} FROM "${ast.grantee}"`,
    );
  }

  return parts.join(' ');
};
