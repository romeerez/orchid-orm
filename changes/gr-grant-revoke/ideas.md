# Postgres GRANT and REVOKE Capabilities

## Must haves

### 1. Declare database-level grants in ORM options

- Why: Users need one central place to describe object grants that belong to the database setup, matching the way default privileges are already configured and retained for migration generation.
- Adds: A declarative `grants` option on `orchidORM` that records grant intent in database metadata, plus `generatorIgnore.grants` support for users who want the metadata stored but ignored by later grant generation.
- How:
  - Accept grants in `orchidORM` options near existing role and default-privilege configuration.
  - Store the normalized grants configuration in the same metadata flow used by default privileges.
  - Do not apply or generate grant SQL from this metadata yet; it is captured so later generator work can compare against it.
  - Let `generatorIgnore` include `grants` so projects can opt out of grant reconciliation before or after generator support exists.
- Depends on: None.

**Use cases**:

- An application defines grants for app roles once in ORM setup, keeps that intent in schema metadata, and can later enable generated migrations without moving the grant definitions to a different API.
- A project that manages grants outside Orchid can still store grant metadata for documentation or future use while adding `grants` to `generatorIgnore` to prevent generated grant changes.

### 2. Write GRANT and REVOKE statements in rake-db migrations

- Why: Users need a typed migration DSL for changing privileges on existing PostgreSQL objects instead of relying on raw SQL for every grant or revoke.
- Adds: Migration-level support for object `GRANT` and `REVOKE` operations, including common privilege targets, grantees, grant options, and revoke behavior.
- How:
  - Let migrations express granting privileges to roles or `PUBLIC` on existing objects such as tables, schemas, sequences, databases, routines, and types.
  - Let migrations express revoking privileges, revoking only grant options, and choosing `CASCADE` or `RESTRICT` where PostgreSQL supports it.
  - Keep PostgreSQL concepts visible enough that users can distinguish table privileges from sequence privileges and existing-object grants from default privileges for future objects.
- Depends on: None.

**Use cases**:

- A migration creates application roles, grants schema usage, grants table read/write access, and separately grants sequence usage needed by inserted rows.
- A hardening migration revokes default `PUBLIC` access from a function or database object in the same migration flow as the schema change.

### 3. Generate migrations that reconcile grants with metadata

- Why: Once users declare expected grants in ORM metadata, generated migrations should detect drift between the actual database ACL state and the configured grant intent.
- Adds: ORM migration generation for grants and revokes that can bring the database privilege state back in line with the metadata declared in ORM options.
- How:
  - Compare actual PostgreSQL grants from database introspection with stored grant metadata.
  - Generate `GRANT` statements for missing configured privileges.
  - Generate `REVOKE` statements for privileges that should no longer exist, respecting `generatorIgnore.grants` when users opt out.
  - Treat grant options as part of the grant state so adding or removing `WITH GRANT OPTION` can be reconciled deliberately.
- Depends on: Declare database-level grants in ORM options, Write GRANT and REVOKE statements in rake-db migrations.

**Use cases**:

- A team changes the declared privileges for an application role and the generated migration grants the new table privileges needed by production.
- A manually added database grant is removed from code, and the generated migration revokes it so the database does not accumulate stale access.

## Valuables

### 4. Declare table-specific grants on table classes

- Why: Grants are often easiest to review next to the table they protect, especially when table access rules differ across models.
- Adds: A table-level grants declaration, similar in placement to `defineRls`, that is merged with grants declared in `orchidORM` options.
- How:
  - Let a table class define grants for that table close to its columns, relations, and RLS configuration.
  - Merge table-level grants with global ORM grants so teams can keep cross-cutting grants centralized and table-specific grants local.
  - Preserve one combined metadata view for later migration generation so users do not have to reason about two separate grant sources.
- Depends on: Declare database-level grants in ORM options.

**Use cases**:

- A table with special read access for a reporting role declares that grant directly on the table class, while common app-role grants remain in `orchidORM` options.
- A table using RLS keeps its policies and required table grants near each other, making the security boundary easier to review.
