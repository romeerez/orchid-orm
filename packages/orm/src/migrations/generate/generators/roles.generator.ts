import { DbStructure, IntrospectedStructure, RakeDbAst } from 'rake-db';
import { ComposeMigrationParams } from '../composeMigration';
import { deepCompare } from 'pqb/internal';
import { promptCreateOrRename } from './generators.utils';

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
  { verifying, internal: { roles } }: ComposeMigrationParams,
) => {
  if (!dbStructure.roles || !roles) return;

  const codeRoles = roles.map((role): DbStructure.Role => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      const i = await promptCreateOrRename(
        'table',
        codeRole.name,
        dropRoles.map((x) => x.name),
        verifying,
      );
      if (i) {
        const dbRole = dropRoles[i - 1];
        dropRoles.splice(i - 1, 1);

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
