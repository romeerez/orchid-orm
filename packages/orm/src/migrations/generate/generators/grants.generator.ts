import { GeneratorIgnore, Grant } from 'pqb/internal';
import {
  getSchemaAndTableFromName,
  IntrospectedStructure,
  RakeDbAst,
} from 'rake-db';
import { ComposeMigrationParams } from '../compose-migration';

const targetKeys = [
  'schemas',
  'tables',
  'sequences',
  'routines',
  'types',
  'domains',
  'databases',
] as const;

const schemaWideTargetKeys = [
  'allTablesIn',
  'allSequencesIn',
  'allRoutinesIn',
] as const;

type TargetKey = (typeof targetKeys)[number];
type SchemaWideTargetKey = (typeof schemaWideTargetKeys)[number];

interface GrantState {
  // Direct target kind used by rake-db grant AST.
  targetKey: TargetKey;
  // Normalized target name used for comparisons.
  target: string;
  // Target name preserved for generated migration output.
  outputTarget: string;
  // Normalized grantee role.
  to: string;
  // Normalized grantor role when metadata scopes comparison to a grantor.
  grantedBy?: string;
  // Ordinary direct privileges.
  privileges: Set<string>;
  // Privileges with grant option.
  grantablePrivileges: Set<string>;
}

interface TargetItem {
  // Normalized target name used for comparisons.
  target: string;
  // Target name preserved for generated migration output.
  outputTarget: string;
}

interface ManagedGrantTargets {
  tables: Set<string>;
  domains: Set<string>;
  types: Set<string>;
}

const supportedPrivileges: Record<TargetKey, string[]> = {
  schemas: ['USAGE', 'CREATE'],
  tables: [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER',
    'MAINTAIN',
  ],
  sequences: ['USAGE', 'SELECT', 'UPDATE'],
  routines: ['EXECUTE'],
  types: ['USAGE'],
  domains: ['USAGE'],
  databases: ['CREATE', 'CONNECT', 'TEMPORARY'],
};

const schemaWideToConcreteTarget: Record<SchemaWideTargetKey, TargetKey> = {
  allTablesIn: 'tables',
  allSequencesIn: 'sequences',
  allRoutinesIn: 'routines',
};

export const processGrants = (
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  params: ComposeMigrationParams,
) => {
  const { grants } = params.internal;
  if (!grants || !dbStructure.grants) return;

  const codeStates = collectCodeGrants(dbStructure, params).filter(
    (grant) => !isIgnoredGrant(grant, params),
  );
  const dbStates = collectDbGrants(dbStructure, params.currentSchema).filter(
    (grant) => !isIgnoredGrant(grant, params),
  );
  const managedTargets = getManagedGrantTargets(params);

  for (const code of codeStates) {
    const actual = dbStates.filter((db) => isSameGrantTarget(code, db));

    addGrantAst(
      ast,
      'grant',
      code,
      missingPrivileges(
        code.grantablePrivileges,
        actual,
        'grantablePrivileges',
      ),
      'grantablePrivileges',
    );

    addGrantAst(
      ast,
      'revoke',
      code,
      grantOptionsToRevoke(code.privileges, code.grantablePrivileges, actual),
      'grantablePrivileges',
    );
    addGrantAst(
      ast,
      'grant',
      code,
      missingPrivileges(code.privileges, actual, 'privileges'),
      'privileges',
    );
  }

  for (const actual of dbStates) {
    const configured = codeStates.filter((code) =>
      isSameGrantTarget(code, actual),
    );
    if (!shouldRevokeActualGrant(actual, configured, managedTargets)) continue;

    const revokeGrant = getRevokeGrantState(actual, configured);

    addGrantAst(
      ast,
      'revoke',
      revokeGrant,
      privilegesToRevoke(actual.privileges, configured),
      'privileges',
    );
    addGrantAst(
      ast,
      'revoke',
      revokeGrant,
      privilegesToRevoke(actual.grantablePrivileges, configured),
      'grantablePrivileges',
    );
  }
};

const getManagedGrantTargets = ({
  codeItems,
  currentSchema,
}: ComposeMigrationParams): ManagedGrantTargets => {
  const targets: ManagedGrantTargets = {
    tables: new Set(),
    domains: new Set(),
    types: new Set(),
  };

  for (const table of codeItems.tables) {
    targets.tables.add(`${table.q.schema ?? currentSchema}.${table.table}`);
  }

  for (const domain of codeItems.domains) {
    targets.domains.add(`${domain.schemaName}.${domain.name}`);
  }

  for (const enumItem of codeItems.enums.values()) {
    targets.types.add(`${enumItem.schema ?? currentSchema}.${enumItem.name}`);
  }

  return targets;
};

const shouldRevokeActualGrant = (
  actual: GrantState,
  configured: GrantState[],
  managedTargets: ManagedGrantTargets,
): boolean => {
  if (configured.length) return true;

  if (actual.targetKey === 'tables') {
    return managedTargets.tables.has(actual.target);
  }

  if (actual.targetKey === 'domains') {
    return managedTargets.domains.has(actual.target);
  }

  if (actual.targetKey === 'types') {
    return managedTargets.types.has(actual.target);
  }

  return false;
};

const getRevokeGrantState = (
  actual: GrantState,
  configured: GrantState[],
): GrantState => {
  if (configured.some((grant) => grant.grantedBy)) {
    return actual;
  }

  return { ...actual, grantedBy: undefined };
};

const collectCodeGrants = (
  dbStructure: IntrospectedStructure,
  { currentSchema, internal }: ComposeMigrationParams,
): GrantState[] => {
  const states: GrantState[] = [];

  for (const grant of internal.grants ?? []) {
    for (const targetKey of targetKeys) {
      const values = grant[targetKey];
      if (!values?.length) continue;

      addStates(
        states,
        withEffectiveGrantor(grant, internal),
        targetKey,
        values,
        currentSchema,
      );
    }

    for (const targetKey of schemaWideTargetKeys) {
      const values = grant[targetKey];
      if (!values?.length) continue;

      const concreteTargetKey = schemaWideToConcreteTarget[targetKey];
      addStates(
        states,
        withEffectiveGrantor(grant, internal),
        concreteTargetKey,
        getSchemaWideTargets(dbStructure, concreteTargetKey, values),
        currentSchema,
      );
    }
  }

  return states;
};

const collectDbGrants = (
  dbStructure: IntrospectedStructure,
  currentSchema: string,
): GrantState[] => {
  const states: GrantState[] = [];

  for (const grant of dbStructure.grants ?? []) {
    for (const targetKey of targetKeys) {
      const values = grant[targetKey];
      if (!values?.length) continue;

      addStates(states, grant, targetKey, values, currentSchema);
    }
  }

  return states;
};

const withEffectiveGrantor = (
  grant: Grant.InternalPrivilege,
  internal: ComposeMigrationParams['internal'],
): Grant.InternalPrivilege => {
  return {
    ...grant,
    grantedBy: grant.grantedBy ?? internal.defaultGrantedBy,
  };
};

const isIgnoredGrant = (
  grant: GrantState,
  { currentSchema, internal: { generatorIgnore } }: ComposeMigrationParams,
): boolean => {
  const { grants } = generatorIgnore ?? {};
  if (matchesSelector(grants?.roles, grant.to)) return true;

  const names = getGrantTargetNames(grant, currentSchema);
  if (matchesSelector(grants?.[grant.targetKey], names)) return true;

  if (
    grant.targetKey === 'tables' &&
    names.schema &&
    matchesSelector(grants?.allTablesIn, names.schema)
  ) {
    return true;
  }

  if (
    grant.targetKey === 'sequences' &&
    names.schema &&
    matchesSelector(grants?.allSequencesIn, names.schema)
  ) {
    return true;
  }

  if (
    grant.targetKey === 'routines' &&
    names.schema &&
    matchesSelector(grants?.allRoutinesIn, names.schema)
  ) {
    return true;
  }

  return isTopLevelIgnoredGrant(grant, names, generatorIgnore);
};

const isTopLevelIgnoredGrant = (
  grant: GrantState,
  names: GrantTargetNames,
  generatorIgnore: GeneratorIgnore | undefined,
): boolean => {
  if (grant.targetKey === 'schemas') {
    return !!generatorIgnore?.schemas?.includes(grant.target);
  }

  if (names.schema && generatorIgnore?.schemas?.includes(names.schema)) {
    return true;
  }

  if (grant.targetKey === 'tables') {
    return isIgnoredByName(generatorIgnore?.tables, names);
  }

  if (grant.targetKey === 'domains') {
    return isIgnoredByName(generatorIgnore?.domains, names);
  }

  return false;
};

interface GrantTargetNames {
  // Schema part for schema-scoped targets.
  schema?: string;
  // Unqualified target name.
  name: string;
  // Schema-qualified target name when schema-scoped.
  qualified: string;
}

const getGrantTargetNames = (
  grant: GrantState,
  currentSchema: string,
): GrantTargetNames => {
  if (grant.targetKey === 'schemas' || grant.targetKey === 'databases') {
    return {
      name: grant.target,
      qualified: grant.target,
    };
  }

  const [schema, name] = getSchemaAndTableFromName(currentSchema, grant.target);

  return {
    schema,
    name,
    qualified: schema ? `${schema}.${name}` : name,
  };
};

const isIgnoredByName = (
  ignored: string[] | undefined,
  names: GrantTargetNames,
): boolean => {
  return !!ignored?.some(
    (name) =>
      name === names.qualified ||
      name === names.name ||
      (names.schema ? name === `${names.schema}.${names.name}` : false),
  );
};

const matchesSelector = (
  selector: Grant.IgnoreSelector | undefined,
  value: string | GrantTargetNames,
): boolean => {
  if (!selector) return false;

  const values =
    typeof value === 'string'
      ? [value]
      : [value.qualified, value.name, value.schema].filter(isString);

  const selectors = Array.isArray(selector) ? selector : [selector];

  return selectors.some((item) =>
    values.some((name) =>
      typeof item === 'string' ? item === name : item.test(name),
    ),
  );
};

const isString = (value: string | undefined): value is string => {
  return !!value;
};

const addStates = (
  states: GrantState[],
  grant: Grant.InternalPrivilege,
  targetKey: TargetKey,
  values: string[] | TargetItem[],
  currentSchema: string,
) => {
  for (const to of grant.to) {
    for (const value of values) {
      const target =
        typeof value === 'string'
          ? normalizeTarget(targetKey, value, currentSchema)
          : value.target;

      addOrMergeState(states, {
        targetKey,
        target,
        outputTarget:
          typeof value === 'string'
            ? normalizeOutputTarget(target, currentSchema)
            : value.outputTarget,
        to: normalizeRoleName(to),
        grantedBy: grant.grantedBy
          ? normalizeRoleName(grant.grantedBy)
          : undefined,
        privileges: expandPrivileges(targetKey, grant.privileges),
        grantablePrivileges: expandPrivileges(
          targetKey,
          grant.grantablePrivileges,
        ),
      });
    }
  }
};

const addOrMergeState = (states: GrantState[], state: GrantState) => {
  const existing = states.find((item) => isSameExactGrantTarget(item, state));
  if (!existing) {
    removeGrantableFromOrdinary(state);
    states.push(state);
    return;
  }

  for (const privilege of state.privileges) {
    if (!existing.grantablePrivileges.has(privilege)) {
      existing.privileges.add(privilege);
    }
  }

  for (const privilege of state.grantablePrivileges) {
    existing.grantablePrivileges.add(privilege);
    existing.privileges.delete(privilege);
  }
};

const removeGrantableFromOrdinary = (state: GrantState) => {
  for (const privilege of state.grantablePrivileges) {
    state.privileges.delete(privilege);
  }
};

const normalizeRoleName = (name: string): string => {
  return name.startsWith('"') && name.endsWith('"') ? name.slice(1, -1) : name;
};

const getSchemaWideTargets = (
  dbStructure: IntrospectedStructure,
  targetKey: TargetKey,
  schemas: string[],
): TargetItem[] => {
  const selectedSchemas = new Set(schemas);

  if (targetKey === 'tables') {
    const views = dbStructure.views || [];

    return [
      ...dbStructure.tables.map((table) => ({
        target: `${table.schemaName}.${table.name}`,
        outputTarget: `${table.schemaName}.${table.name}`,
      })),
      ...views.map((view) => ({
        target: `${view.schemaName}.${view.name}`,
        outputTarget: `${view.schemaName}.${view.name}`,
      })),
    ].filter((item) => selectedSchemas.has(item.target.split('.')[0]));
  }

  if (targetKey === 'sequences' || targetKey === 'routines') {
    return getSchemaWideGrantTargets(dbStructure, targetKey, selectedSchemas);
  }

  return [];
};

const getSchemaWideGrantTargets = (
  dbStructure: IntrospectedStructure,
  targetKey: 'sequences' | 'routines',
  selectedSchemas: Set<string>,
): TargetItem[] => {
  const targets = new Map<string, TargetItem>();

  for (const grant of dbStructure.grants ?? []) {
    for (const target of grant[targetKey] ?? []) {
      const [schema] = target.split('.');
      if (!selectedSchemas.has(schema)) continue;

      targets.set(target, {
        target,
        outputTarget: target,
      });
    }
  }

  return [...targets.values()];
};

const normalizeTarget = (
  targetKey: TargetKey,
  value: string,
  currentSchema: string,
): string => {
  if (targetKey === 'schemas' || targetKey === 'databases') return value;

  const [schema, name] = getSchemaAndTableFromName(currentSchema, value);
  return `${schema ?? currentSchema}.${name}`;
};

const normalizeOutputTarget = (
  target: string,
  currentSchema: string,
): string => {
  const [schema, name] = target.split('.');
  if (!name) return target;

  return schema === currentSchema ? name : target;
};

const expandPrivileges = (
  targetKey: TargetKey,
  privileges: string[] | undefined,
): Set<string> => {
  const set = new Set<string>();

  for (const privilege of privileges ?? []) {
    if (privilege === 'ALL') {
      for (const supported of supportedPrivileges[targetKey]) {
        set.add(supported);
      }
    } else {
      set.add(privilege === 'TEMP' ? 'TEMPORARY' : privilege);
    }
  }

  return set;
};

const isSameGrantTarget = (a: GrantState, b: GrantState): boolean => {
  return (
    a.targetKey === b.targetKey &&
    a.target === b.target &&
    a.to === b.to &&
    (!a.grantedBy || !b.grantedBy || a.grantedBy === b.grantedBy)
  );
};

const isSameExactGrantTarget = (a: GrantState, b: GrantState): boolean => {
  return (
    a.targetKey === b.targetKey &&
    a.target === b.target &&
    a.to === b.to &&
    a.grantedBy === b.grantedBy
  );
};

const missingPrivileges = (
  expected: Set<string>,
  actual: GrantState[],
  key: 'privileges' | 'grantablePrivileges',
): string[] => {
  const result: string[] = [];

  for (const privilege of expected) {
    if (!actual.some((state) => state[key].has(privilege))) {
      result.push(privilege);
    }
  }

  return result;
};

const grantOptionsToRevoke = (
  expectedOrdinary: Set<string>,
  expectedGrantable: Set<string>,
  actual: GrantState[],
): string[] => {
  const result: string[] = [];

  for (const privilege of expectedOrdinary) {
    if (expectedGrantable.has(privilege)) continue;

    if (actual.some((state) => state.grantablePrivileges.has(privilege))) {
      result.push(privilege);
    }
  }

  return result;
};

const privilegesToRevoke = (
  actual: Set<string>,
  configured: GrantState[],
): string[] => {
  const result: string[] = [];

  for (const privilege of actual) {
    if (
      !configured.some(
        (state) =>
          state.privileges.has(privilege) ||
          state.grantablePrivileges.has(privilege),
      )
    ) {
      result.push(privilege);
    }
  }

  return result;
};

const addGrantAst = (
  ast: RakeDbAst[],
  action: RakeDbAst.Grant['action'],
  grant: GrantState,
  privileges: string[],
  privilegeKey: 'privileges' | 'grantablePrivileges',
) => {
  if (!privileges.length) return;

  ast.push({
    type: 'grant',
    action,
    to: [grant.to],
    [grant.targetKey]: [grant.outputTarget],
    [privilegeKey]: privileges,
    grantedBy: grant.grantedBy,
  });
};
