## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding
- you must follow packages/pqb/src/query/guidelines/code.md for coding

## 1. rake-db

- [x] 1.1 Add one strict migration argument type
  - 1.1.1 Define one public `GrantMigrationArg` type used by both `grant` and `revoke`, based on `pqb` `Grant.Privilege` and extended only with strict `revokeMode`.
  - 1.1.2 Define one internal `GrantPrivilege` type in the rake-db grant migration subsystem that extends `pqb` `Grant.InternalPrivilege` with loose `revokeMode` for SQL rendering.
  - 1.1.3 Add one `RakeDbAst.Grant` shape with `type: 'grant'`, `action: 'grant' | 'revoke'`, and the internal `GrantPrivilege` fields; do not add separate grant and revoke AST target bags.
  - 1.1.4 verify if the implementation conforms to guidelines
  - 1.1.5 make sure you didn't forget to cover the implementation with tests
  - 1.1.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.2 Implement grant and revoke SQL execution
  - 1.2.1 Add `grant` and `revoke` methods to the migration interface with rollback behavior matching the spec, including `grantablePrivileges` as grant-option handling and `revokeMode` for emitted revokes.
  - 1.2.2 Render SQL for every supported target key from the grant metadata contract, preserving PostgreSQL distinctions between concrete object targets and `ALL ... IN SCHEMA` targets.
  - 1.2.3 Apply the existing rake-db default-schema prefixing behavior for unqualified concrete schema-scoped objects while leaving schema-wide target names unprefixed.
  - 1.2.4 Organize the grant migration code as a focused feature module, similar in shape to `pqb` default privileges, with grant-specific target/privilege mapping kept out of generic migration code.
  - 1.2.5 Preserve existing migration logging, adapter execution, and rollback conventions while keeping grant introspection and generated migration reconciliation out of scope.
  - 1.2.6 verify if the implementation conforms to guidelines
  - 1.2.7 make sure you didn't forget to cover the implementation with tests
  - 1.2.8 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.9 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. docs

- [ ] 2.1 Document existing-object grant migrations
  - 2.1.1 Update the migration writing guide with `grant` and `revoke` examples that use the same argument shape, supported target/privilege lists, rollback behavior, and the distinction from default privileges for future objects.
  - 2.1.2 Call out important PostgreSQL gotchas from the spec: table grants do not cover sequences, schema `USAGE` is separate, revoking from `PUBLIC` does not prove effective access is gone, schema prefixes are optional for concrete schema-scoped objects, and `GRANT` / `REVOKE` affect existing objects only.

## 3. changeset

- [ ] 3.1 Finalize the change
  - 3.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
