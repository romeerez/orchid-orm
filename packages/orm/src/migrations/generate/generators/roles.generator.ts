import { DbStructure, IntrospectedStructure, RakeDbAst } from 'rake-db';
import { ComposeMigrationParams } from '../compose-migration';
import { MigrationDecisionCtx } from '../migration-decider';
import { deepCompare } from 'pqb/internal';

const defaults = {
  super: false,
  inherit: false,
  createRole: false,
  createDb: false,
  canLogin: false,
  replication: false,
  connLimit: -1,
  bypassRls: false,
};

export const processRoles = async (
  ast: RakeDbAst[],
  dbStructure: IntrospectedStructure,
  { internal: { roles } }: ComposeMigrationParams,
  { decider }: MigrationDecisionCtx,
) => {
  if (!dbStructure.roles || !roles) return;

  const codeRoles = roles.map((role): DbStructure.Role => {
    //
    const { defaultPrivileges: _, ...roleWithoutPrivileges } = role;
    return {
      ...defaults,
      ...roleWithoutPrivileges,
    };
  });

  const found = new Set<string>();
  const dropRoles: DbStructure.Role[] = [];

  for (const dbRole of dbStructure.roles) {
    // Strip defaultPrivileges from dbRole for comparison
    const {
      //
      defaultPrivileges: _,
      ...dbRoleWithoutPrivileges
    } = dbRole as DbStructure.Role & { defaultPrivileges?: unknown };

    const codeRole = codeRoles.find(
      (codeRole) => dbRole.name === codeRole.name,
    );
    if (codeRole) {
      found.add(dbRole.name);

      if (!deepCompare(dbRoleWithoutPrivileges, codeRole)) {
        ast.push({
          type: 'changeRole',
          name: dbRole.name,
          from: dbRoleWithoutPrivileges,
          to: codeRole,
        });
      }

      continue;
    }

    dropRoles.push(dbRole);
  }

  for (const codeRole of codeRoles) {
    if (found.has(codeRole.name)) continue;

    if (dropRoles.length) {
      const dbRole = await decider.createOrRename({
        kind: 'role',
        target: { name: codeRole.name },
        candidates: dropRoles,
        candidateSource: (x) => ({ name: x.name }),
        name: codeRole.name,
        candidateName: (x) => x.name,
      });
      if (dbRole) {
        dropRoles.splice(dropRoles.indexOf(dbRole), 1);

        ast.push(makeRenameOrChangeAst(dbRole, codeRole));

        continue;
      }
    }

    ast.push({
      type: 'role',
      action: 'create',
      ...codeRole,
    });
  }

  for (const dbRole of dropRoles) {
    ast.push({
      type: 'role',
      action: 'drop',
      ...dbRole,
    });
  }
};

const makeRenameOrChangeAst = (
  dbRole: DbStructure.Role,
  codeRole: DbStructure.Role,
): RakeDbAst.RenameRole | RakeDbAst.ChangeRole => {
  const { name: dbRoleName, ...dbRoleRest } = dbRole;
  const { name: codeRoleName, ...codeRoleRest } = codeRole;
  if (deepCompare(dbRoleRest, codeRoleRest) && dbRoleName !== codeRoleName) {
    return {
      type: 'renameRole',
      from: dbRoleName,
      to: codeRoleName,
    };
  } else {
    return {
      type: 'changeRole',
      name: dbRole.name,
      from: dbRole,
      to: codeRole,
    };
  }
};
