# Default privilege migration generator

In `generate.ts` and `verify-migrations.ts` needs to provide `loadDefaultPrivileges: !!roles` to `introspectDbSchema`: privileges are defined per role, so no need to load it when user doesn't provide roles.

In `generate.ts` a schema of every default privilege of every role is added to `codeItems.schemas`, to prevent this schema from dropping if it has no other objects rather than this privilege.

`roles.generator.ts` should omit `defaultPrivileges` from both `codeRoles` and db roles in order for them to not affect `deepCompare` logic.

`default-privilege.generator.ts` should:

- collect default privileges of all roles
- map them to `RakeDbAst.DefaultPrivilege` objects using the role name as `grantee`
- determine a propef diff between code objects and db objects
- revoke the privileges that were not found in the code by pushing an item to `ast`
- grant the privileges that are in the code but not found in db objects by pushing an item to `ast`
- make sure matching privileges aren't granting or revoking anything

## report

Similar to how SQL statements are generated in rake-db `default-privilege.ts`, we want a single message per object type (table, sequence, function, etc.), `privileges` and `grantablePrivileges` should be logged separately.

It should report `+ grant default privileges` (green) and `- revoke default privileges` (red) messages, for example `+ grant default privileges insert, select, updated on *tables* to *role* with grant option` (grant option for `grantablePrivileges`). Dynamic values should be uncolored.
