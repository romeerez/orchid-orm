## 0. read spec.md and guidelines

- 0.1 Read `spec.md`, including `spec.md` `## Detailed Design`, before starting any later task. Follow that design for every later task, and make sure the final implementation matches it exactly.
- 0.2 Check whether any later task you were prompted to do requires coding. If yes, read and follow every guideline below for that work, and verify that all produced code follows them to the letter.

- you must follow guidelines/code.md for coding

## 1. rake-db

- [x] 1.1 Add common ACL grant introspection
  - 1.1.1 Add normalized introspected grant state and a raw parsing path for actual PostgreSQL ACL grants that uses the same target keys and ordinary/grantable privilege split as `pqb` grant metadata.
  - 1.1.2 Define the raw db-level grant shape under the existing `RawDbStructure` namespace and wire `introspectDbSchema` to include normalized grants only when `loadGrants` is requested.
  - 1.1.3 Cover concrete target kinds, null ACL default handling for supported objects, grantor/grantee normalization, and the boundary that schema-wide `ALL ... IN SCHEMA` forms are not returned as stored ACL objects.
  - 1.1.4 verify if the implementation conforms to guidelines
  - 1.1.5 make sure you didn't forget to cover the implementation with tests
  - 1.1.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.1.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them
- [x] 1.2 Support grant AST in generated migrations (don't change orm yet)
  - 1.2.1 Render `RakeDbAst.Grant` items as generated `db.grant` or `db.revoke` calls, preserving target keys, role lists, `grantedBy`, ordinary privileges, grantable privileges, and `revokeMode` only when present.
  - 1.2.2 Add grant dependency metadata so generated grants are ordered with roles, grantors, schemas, and target objects consistently with the existing role and default-privilege generation model.
  - 1.2.3 Preserve manual migration grant/revoke behavior while removing the current generated-migration rejection for grant AST nodes.
  - 1.2.4 verify if the implementation conforms to guidelines
  - 1.2.5 make sure you didn't forget to cover the implementation with tests
  - 1.2.6 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 1.2.7 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 2. orm

- [ ] 2.1 Add `grants.generator.ts`
  - 2.1.1 Request `loadGrants: true` during initial generation and verification whenever ORM grant metadata is present.
  - 2.1.2 Normalize configured grant metadata and introspected grants into comparable direct-grant state, including effective grantor, current-schema handling, supported privilege expansion, and concrete state derived from schema-wide metadata.
  - 2.1.3 Generate grant AST items for missing configured privileges and revoke AST items for stale actual privileges, including the grant-option transition rules from `spec.md`.
  - 2.1.4 Apply `generatorIgnore.grants` and relevant top-level object ignores to both configured and actual grants so ignored grants neither grant nor revoke.
  - 2.1.5 Add schemas referenced by grant metadata to generation's known schema set without treating grant metadata as ownership of the referenced target objects.
  - 2.1.6 Add generated migration report output for grant and revoke AST items, including separate ordinary privilege and grant-option messages.
  - 2.1.7 Keep roles/default-privileges responsibilities separate by not requiring grant grantees or grantors to be declared roles and not changing role comparison behavior.
  - 2.1.8 verify if the implementation conforms to guidelines
  - 2.1.9 make sure you didn't forget to cover the implementation with tests
  - 2.1.10 make sure the package test and typecheck commands are passing (`pnpm <pkg> check` and `pnpm <pkg> types`; `<pkg>` is the folder name under `packages/`, not the `package.json` name)
  - 2.1.11 ensure that if user-prompted implementation changes have a meaningful impact on the feature, `spec.md` was updated to reflect them

## 3. docs

- [ ] 3.1 Document grants across generated and manual migration workflows
  - 3.1.1 Document the full grants feature implemented across ideas 1, 2, and 3, not only this generator idea.
  - 3.1.2 Update migration generation docs for defining grants in `orchidORM` with `grants`, `defaultGrantedBy`, generated reconciliation behavior, and `generatorIgnore.grants`, using roles and default privileges as adjacent reference concepts.
  - 3.1.3 Update migration writing docs for the rake-db manual `db.grant` and `db.revoke` methods, including supported target keys, grant option behavior, `revokeMode`, and rollback semantics.
  - 3.1.4 Update RLS docs so ordinary grant support is no longer described as future-only and so users can find existing-object grants, default privileges, and grant gotchas from the RLS guide.
  - 3.1.5 Keep docs index metadata and generated docs support files consistent with the source docs changes when this repo expects them to be checked in.

## 4. changeset

- [ ] 4.1 Finalize the change
  - 4.1.1 Follow `.agents/skills/changeset/SKILL.md` to finalize the change.
