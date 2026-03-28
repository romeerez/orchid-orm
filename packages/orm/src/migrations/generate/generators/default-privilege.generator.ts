import { DbStructure, IntrospectedStructure, RakeDbAst } from 'rake-db';
import { ComposeMigrationParams } from '../composeMigration';
import { getSupportedDefaultPrivileges } from 'pqb';

const ALL_OBJECT_TYPES: DbStructure.DefaultPrivilegeObjectConfig['object'][] = [
  'TABLES',
  'SEQUENCES',
  'FUNCTIONS',
  'TYPES',
  'SCHEMAS',
  'LARGE_OBJECTS',
];

// Create object configs for all object types with given isGrantable flag
const createAllObjectConfigs = (
  isGrantable: boolean,
  schema?: string,
): DbStructure.DefaultPrivilegeObjectConfig[] => {
  const types = schema
    ? ALL_OBJECT_TYPES.filter((t) => t !== 'SCHEMAS' && t !== 'LARGE_OBJECTS')
    : ALL_OBJECT_TYPES;
  return types.map((object) => ({
    object,
    privilegeConfigs: [{ privilege: 'ALL', isGrantable }],
  }));
};

// Map object type to the corresponding grant/revoke key
const objectTypeToKey: Record<
  DbStructure.DefaultPrivilegeObjectConfig['object'],
  'tables' | 'sequences' | 'functions' | 'types' | 'schemas' | 'largeObjects'
> = {
  TABLES: 'tables',
  SEQUENCES: 'sequences',
  FUNCTIONS: 'functions',
  TYPES: 'types',
  SCHEMAS: 'schemas',
  LARGE_OBJECTS: 'largeObjects',
};

// Split privilege configs into regular and grantable privilege names
const splitPrivilegeConfigs = (
  configs: DbStructure.DefaultPrivilegeConfig[],
): { regular: string[]; grantable: string[] } => {
  const regular: string[] = [];
  const grantable: string[] = [];
  for (const p of configs) {
    if (p.isGrantable) {
      grantable.push(p.privilege);
    } else {
      regular.push(p.privilege);
    }
  }
  return { regular, grantable };
};

// Create a setting object from regular and grantable privilege arrays
const createPrivilegeSetting = (
  regular: string[],
  grantable: string[],
): { privileges?: string[]; grantablePrivileges?: string[] } => {
  const setting: { privileges?: string[]; grantablePrivileges?: string[] } = {};
  if (regular.length) setting.privileges = regular;
  if (grantable.length) setting.grantablePrivileges = grantable;
  return setting;
};

// Collapse privilege configs into ALL if all expected privileges are present.
// Mutates newPrivilegeConfigs by pushing the result.
const collapsePrivileges = (
  privs: DbStructure.DefaultPrivilegeConfig[],
  newPrivilegeConfigs: DbStructure.DefaultPrivilegeConfig[],
  expectedPrivs: string[],
  isGrantable: boolean,
): void => {
  const hasAll = privs.some((p) => p.privilege === 'ALL');
  const allPresent =
    hasAll ||
    (privs.length > 0 &&
      privs.length === expectedPrivs.length &&
      expectedPrivs.every((priv) => privs.some((p) => p.privilege === priv)));

  if (allPresent) {
    newPrivilegeConfigs.push({ privilege: 'ALL', isGrantable });
  } else if (privs.length > 0) {
    newPrivilegeConfigs.push(...privs);
  }
};

// Collapse privileges into ALL when all non-ALL privileges are present.
// Returns a new DefaultPrivilege with collapsed privileges.
const collapsePrivilegesToAll = (
  privilege: DbStructure.DefaultPrivilege,
  objectTypeToAllPrivileges: Record<
    DbStructure.DefaultPrivilegeObjectConfig['object'],
    readonly string[]
  >,
): DbStructure.DefaultPrivilege => {
  const collapsedObjectConfigs = privilege.objectConfigs.map(
    (objConfig): DbStructure.DefaultPrivilegeObjectConfig => {
      const allPrivileges = objectTypeToAllPrivileges[objConfig.object];
      const expectedPrivs = allPrivileges.filter((p) => p !== 'ALL');

      // Group privilege configs by isGrantable using imperative loop
      const regularPrivs: DbStructure.DefaultPrivilegeConfig[] = [];
      const grantablePrivs: DbStructure.DefaultPrivilegeConfig[] = [];
      for (const p of objConfig.privilegeConfigs) {
        if (p.isGrantable) {
          grantablePrivs.push(p);
        } else {
          regularPrivs.push(p);
        }
      }

      const newPrivilegeConfigs: DbStructure.DefaultPrivilegeConfig[] = [];

      // Collapse regular privileges to ALL if all are present
      collapsePrivileges(
        regularPrivs,
        newPrivilegeConfigs,
        expectedPrivs,
        false,
      );

      // Collapse grantable privileges to ALL if all are present
      collapsePrivileges(
        grantablePrivs,
        newPrivilegeConfigs,
        expectedPrivs,
        true,
      );

      return {
        object: objConfig.object,
        privilegeConfigs: newPrivilegeConfigs,
      };
    },
  );

  return {
    owner: privilege.owner,
    grantee: privilege.grantee,
    schema: privilege.schema,
    objectConfigs: collapsedObjectConfigs,
  };
};

// Check if two privilege configs match, considering ALL expansion
const privilegeConfigsMatch = (
  a: DbStructure.DefaultPrivilegeConfig,
  b: DbStructure.DefaultPrivilegeConfig,
  objectType: DbStructure.DefaultPrivilegeObjectConfig['object'],
  objectTypeToAllPrivileges: Record<
    DbStructure.DefaultPrivilegeObjectConfig['object'],
    readonly string[]
  >,
): boolean => {
  // Exact match
  if (a.privilege === b.privilege && a.isGrantable === b.isGrantable) {
    return true;
  }

  const allPrivileges = objectTypeToAllPrivileges[objectType];
  const expectedPrivs = allPrivileges.filter((p) => p !== 'ALL');

  // Check if a is ALL and b has all expected privileges (or vice versa)
  if (a.privilege === 'ALL' && a.isGrantable === b.isGrantable) {
    // Check if b has all expected privileges
    return expectedPrivs.includes(b.privilege);
  }
  if (b.privilege === 'ALL' && a.isGrantable === b.isGrantable) {
    // Check if a has all expected privileges
    return expectedPrivs.includes(a.privilege);
  }

  return false;
};

// Normalize role name by stripping quotes that may come from database introspection
const normalizeRoleName = (name: string): string => {
  if (name.startsWith('"') && name.endsWith('"')) {
    return name.slice(1, -1);
  }
  return name;
};

// Process privilege config (tables, sequences, functions, types) into object configs
const processPrivilegeConfig = (
  config: { privileges?: string[]; grantablePrivileges?: string[] } | undefined,
  objectType: DbStructure.DefaultPrivilegeObjectConfig['object'],
): DbStructure.DefaultPrivilegeObjectConfig | undefined => {
  if (!config) return;

  const privilegeConfigs: DbStructure.DefaultPrivilegeConfig[] = [];
  if (config.privileges) {
    for (const p of config.privileges) {
      privilegeConfigs.push({ privilege: p, isGrantable: false });
    }
  }
  if (config.grantablePrivileges) {
    for (const p of config.grantablePrivileges) {
      privilegeConfigs.push({ privilege: p, isGrantable: true });
    }
  }
  if (privilegeConfigs.length) {
    return { object: objectType, privilegeConfigs };
  }
  return;
};

// Check if a default privilege object config has any privileges set
const hasAnyPrivilege = (
  obj: RakeDbAst.DefaultPrivilegeObjectConfig | undefined,
): boolean => {
  if (!obj) return false;
  for (const key of ALL_OBJECT_TYPES) {
    const setting = obj[objectTypeToKey[key]];
    if (setting?.privileges?.length || setting?.grantablePrivileges?.length) {
      return true;
    }
  }
  return false;
};

export const processDefaultPrivileges = (
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  { internal: { roles } }: ComposeMigrationParams,
) => {
  if (!dbStructure.defaultPrivileges || !roles) return;

  const supportedPrivileges = getSupportedDefaultPrivileges(
    dbStructure.version,
  );

  const objectTypeToAllPrivileges: Record<
    DbStructure.DefaultPrivilegeObjectConfig['object'],
    readonly string[]
  > = {
    TABLES: supportedPrivileges.PRIVILEGES.TABLE,
    SEQUENCES: supportedPrivileges.PRIVILEGES.SEQUENCE,
    FUNCTIONS: supportedPrivileges.PRIVILEGES.FUNCTION,
    TYPES: supportedPrivileges.PRIVILEGES.TYPE,
    SCHEMAS: supportedPrivileges.PRIVILEGES.SCHEMA,
    LARGE_OBJECTS: supportedPrivileges.PRIVILEGES.LARGE_OBJECT,
  };

  // Collect default privileges from code roles
  const codePrivileges: Map<string, DbStructure.DefaultPrivilege> = new Map();

  for (const role of roles) {
    if (!role.defaultPrivileges) continue;

    for (const privilege of role.defaultPrivileges) {
      const key = `${role.name}.${privilege.schema}`;

      const objectConfigs: DbStructure.DefaultPrivilegeObjectConfig[] = [];

      // Start with allGrantable or all base config
      if (privilege.allGrantable) {
        objectConfigs.push(...createAllObjectConfigs(true, privilege.schema));
      } else if (privilege.all) {
        objectConfigs.push(...createAllObjectConfigs(false, privilege.schema));
      }

      for (const objectType of ALL_OBJECT_TYPES) {
        if (
          privilege.schema &&
          (objectType === 'SCHEMAS' || objectType === 'LARGE_OBJECTS')
        ) {
          continue;
        }
        const key = objectTypeToKey[objectType];
        if (key in privilege) {
          const config = privilege[key as keyof typeof privilege];
          const processed = processPrivilegeConfig(config as never, objectType);
          if (processed) {
            const existingIndex = objectConfigs.findIndex(
              (o) => o.object === objectType,
            );
            if (existingIndex >= 0) {
              objectConfigs[existingIndex] = processed;
            } else {
              objectConfigs.push(processed);
            }
          }
        }
      }

      if (objectConfigs.length) {
        // Store code privileges as-is (don't collapse - preserve user intent)
        codePrivileges.set(key, {
          owner: undefined,
          grantee: role.name,
          schema: privilege.schema,
          objectConfigs,
        });
      }
    }
  }

  // Compare with database privileges and generate AST items
  const found = new Set<string>();

  for (const dbPrivilege of dbStructure.defaultPrivileges) {
    // Normalize grantee to handle quotes from database
    const grantee = normalizeRoleName(dbPrivilege.grantee);
    if (grantee === 'postgres') continue;

    const key = `${grantee}.${dbPrivilege.schema}`;
    const codePrivilege = codePrivileges.get(key);

    if (codePrivilege) {
      found.add(key);

      const grant: RakeDbAst.DefaultPrivilege['grant'] = {};
      const revoke: RakeDbAst.DefaultPrivilege['revoke'] = {};

      // Compare object configs for each object type
      for (const objectType of ALL_OBJECT_TYPES) {
        const dbObj = dbPrivilege.objectConfigs.find(
          (o) => o.object === objectType,
        );
        const codeObj = codePrivilege.objectConfigs.find(
          (o) => o.object === objectType,
        );

        const dbPrivs = dbObj?.privilegeConfigs ?? [];
        const codePrivs = codeObj?.privilegeConfigs ?? [];

        // Collapse db privileges for comparison (but keep original for output)
        const collapsedDbPrivilege: DbStructure.DefaultPrivilege = {
          owner: dbPrivilege.owner,
          grantee: dbPrivilege.grantee,
          schema: dbPrivilege.schema,
          objectConfigs: [{ object: objectType, privilegeConfigs: dbPrivs }],
        };
        const collapsedDbObj = collapsePrivilegesToAll(
          collapsedDbPrivilege,
          objectTypeToAllPrivileges,
        ).objectConfigs[0];
        const collapsedDbPrivs = collapsedDbObj?.privilegeConfigs ?? [];

        // Find privileges to grant (in code but not in collapsed db)
        const toGrant = codePrivs.filter(
          (cp) =>
            !collapsedDbPrivs.some((dp) =>
              privilegeConfigsMatch(
                cp,
                dp,
                objectType,
                objectTypeToAllPrivileges,
              ),
            ),
        );

        // Find privileges to revoke (in db but not in code)
        // Use original dbPrivs for output, but collapsed for comparison
        const toRevoke = dbPrivs.filter(
          (dp) =>
            !codePrivs.some((cp) =>
              privilegeConfigsMatch(
                cp,
                dp,
                objectType,
                objectTypeToAllPrivileges,
              ),
            ),
        );

        if (toGrant.length) {
          const { regular, grantable } = splitPrivilegeConfigs(toGrant);
          const setting = createPrivilegeSetting(regular, grantable);
          if (setting.privileges || setting.grantablePrivileges) {
            grant[objectTypeToKey[objectType]] = setting;
          }
        }

        if (toRevoke.length) {
          const { regular, grantable } = splitPrivilegeConfigs(toRevoke);
          const setting = createPrivilegeSetting(regular, grantable);
          if (setting.privileges || setting.grantablePrivileges) {
            revoke[objectTypeToKey[objectType]] = setting;
          }
        }
      }

      const hasGrant = hasAnyPrivilege(grant);
      const hasRevoke = hasAnyPrivilege(revoke);

      if (hasGrant || hasRevoke) {
        ast.push({
          type: 'defaultPrivilege',
          grantee: grantee,
          schema: dbPrivilege.schema,
          grant: hasGrant ? grant : undefined,
          revoke: hasRevoke ? revoke : undefined,
        });
      }
    } else {
      // Revoke all existing privileges
      const revoke: RakeDbAst.DefaultPrivilege['revoke'] = {};

      for (const obj of dbPrivilege.objectConfigs) {
        const { regular, grantable } = splitPrivilegeConfigs(
          obj.privilegeConfigs,
        );
        const setting = createPrivilegeSetting(regular, grantable);
        if (setting.privileges || setting.grantablePrivileges) {
          revoke[objectTypeToKey[obj.object]] = setting;
        }
      }

      if (hasAnyPrivilege(revoke)) {
        ast.push({
          type: 'defaultPrivilege',
          grantee: grantee,
          schema: dbPrivilege.schema,
          revoke,
        });
      }
    }
  }

  // Grant privileges that are in code but not in db
  for (const [key, codePrivilege] of codePrivileges) {
    if (found.has(key)) continue;

    const grant: RakeDbAst.DefaultPrivilege['grant'] = {};

    for (const obj of codePrivilege.objectConfigs) {
      const { regular, grantable } = splitPrivilegeConfigs(
        obj.privilegeConfigs,
      );
      const setting = createPrivilegeSetting(regular, grantable);
      if (setting.privileges || setting.grantablePrivileges) {
        grant[objectTypeToKey[obj.object]] = setting;
      }
    }

    if (hasAnyPrivilege(grant)) {
      ast.push({
        type: 'defaultPrivilege',
        grantee: codePrivilege.grantee,
        schema: codePrivilege.schema,
        grant,
      });
    }
  }
};
