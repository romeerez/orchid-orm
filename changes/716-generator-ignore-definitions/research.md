# Generator Ignore on Definitions

## Purpose and goals

Orchid ORM already has a generator-level `generatorIgnore` option for excluding arbitrary database objects from migration generation. This research evaluates whether a definition-side opt-out should also exist, starting with the desired `generatorIgnore = true` support for manually managed views and tables.

The goal is to identify which database entities the migration generator currently supports, decide where a definition-side ignore flag has clear user value, and avoid adding redundant or confusing flags to objects where the existing config-level ignore is sufficient.

## Valuable external context

Django has a mature definition-side concept for this problem: `Meta.managed = False`. Django documents it as disabling table creation, modification, and deletion for a model while leaving normal model behavior otherwise intact. The documented use cases are existing tables and database views created outside Django.

TypeORM exposes a similar idea through synchronization controls. It has a global `synchronize` setting, definition-level synchronization opt-outs for database objects such as indexes, and user demand for the same ability on view entities. Its index documentation is especially relevant: unsupported or database-specific index definitions can be created manually, then marked so the synchronizer does not try to remove or alter them.

Alembic handles this class of problem with autogenerate filters rather than definition-side flags. Its migration generation compares database state to application metadata and produces candidate migrations that users review. This supports Orchid's existing config-level `generatorIgnore` style: broad filters are appropriate when the object is not naturally represented by an ORM definition or when the ignore rule is environment-specific.

Prisma's `@@ignore` is related but has a different primary meaning: it excludes a model from generated Prisma Client APIs. Prisma discussion around views shows the pain point behind a migration ignore feature: users sometimes need to model a view for querying while preventing generated schema operations from managing it.

Drizzle Kit exposes config-level filters such as `tablesFilter`, `schemaFilter`, `extensionsFilters`, and role management settings. This is useful precedent for keeping broad database-object exclusions in central configuration, especially for provider-created objects and global entities.

## Community ideas and pain points

Common pain points across tools:

- Users map ORM definitions to database views, materialized views, legacy tables, extension-created objects, temporary tables, or custom DDL objects so application code can query them.
- Migration generators can misinterpret manually created objects as objects to create, alter, or drop.
- Config-level ignore filters solve arbitrary exclusions but are farther away from the definition that caused the migration diff, so they are less discoverable for tables and views intentionally defined in code.
- Object-level ignore flags are most valuable when the object remains useful to the ORM at runtime but should be unmanaged by migration generation.

## Requirements and edge cases

- A definition-side ignore should not remove the definition from runtime query APIs. It should only affect migration generation.
- The option should be complementary to the existing ORM config-level `generatorIgnore`, not a replacement.
- The option should be useful only where users can define an object for runtime use while wanting migration generation to leave that exact object unmanaged.
- Config-defined entities should usually not receive an additional ignore flag, because users can already omit them from config or list them in config-level `generatorIgnore`.
- Objects that only exist as part of another definition should usually not receive their own definition-side ignore flag. If the parent object is managed but a nested object is not, migration behavior becomes ambiguous.
- Definition-side ignore should avoid implying partial management unless the product explicitly supports it. A table-level ignore should mean the table is unmanaged by the generator; it should not mean "manage columns but ignore indexes" unless a separate feature says so.
- If both config-level ignore and definition-side ignore can match an object, they should be consistent: either one should be enough to exclude the object from generator processing.

## Existing support in orchid-orm

This feature does not already exist as a definition-side API. It exists partially as the ORM/database option `generatorIgnore`.

Current `GeneratorIgnore` supports:

- `schemas`
- `enums`
- `domains`
- `extensions`
- `tables`
- `views`, including regular and materialized views
- `grants`
- RLS-specific ignores are documented and implemented through an extended generator ignore shape: `rls.tables` and `rls.policies`

The public docs describe `db g` as handling tables, columns, schemas, enums, primary keys, foreign keys, indexes, checks, exclude constraints, extensions, domains, and configured views. The generator filenames add the currently supported generator areas:

| Generator filename                  | Entity or feature represented         | Definition-side `generatorIgnore` recommendation                                                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tables.generator.ts`               | Tables                                | **Yes.** A table class is a runtime query object and users may need to map an existing or externally managed table without letting generated migrations create, change, or drop it.                                                                                 |
| `views.generator.ts`                | Regular views                         | **Yes.** A view class is a runtime query object under `$views`; manually created views are the core use case.                                                                                                                                                       |
| `materialized-views.generator.ts`   | Materialized views                    | **Yes.** Same rationale as regular views. Existing docs use one `views` option and one `generatorIgnore.views` selector for both regular and materialized views.                                                                                                    |
| `schemas.generator.ts`              | Schemas                               | **No for this feature.** Schemas are not definition-side runtime query objects. Config-level `generatorIgnore.schemas` already covers schema-wide exclusion and also ignores contained tables, views, domains, and enums.                                           |
| `columns.generator.ts`              | Columns                               | **No.** Columns are parts of a table definition. Ignoring individual columns creates partial table ownership and can conflict with runtime insert/update/select expectations.                                                                                       |
| `primary-key.generator.ts`          | Primary keys                          | **No new generic flag.** Primary keys are table constraints. Orchid already has `noPrimaryKey` for the specific "do not require/manage a primary key" case.                                                                                                         |
| `foreign-keys.generator.ts`         | Foreign keys                          | **No for this feature.** Foreign keys are nested table constraints. Ignoring them independently would be partial table management and needs a more specific design if ever required.                                                                                |
| `indexes-and-excludes.generator.ts` | Indexes and exclude constraints       | **Not in this feature.** There is external precedent for per-index sync opt-outs, but Orchid does not currently expose config-level index/exclude ignores. This should be separate research if users need unmanaged custom indexes while keeping the table managed. |
| `checks.generator.ts`               | Check constraints                     | **No for this feature.** Checks are nested table constraints and do not provide runtime query behavior on their own.                                                                                                                                                |
| `enums.generator.ts`                | Enum types                            | **No.** Enums are normally discovered through table column definitions; managing a table while saying its enum type is unmanaged is confusing. Existing config-level `generatorIgnore.enums` is enough for arbitrary external enum types.                           |
| `domains.generator.ts`              | Domain types                          | **No.** Domains are configured as reusable type metadata and used by columns. If a domain is external, config-level `generatorIgnore.domains` is the right control.                                                                                                 |
| `extensions.generator.ts`           | Extensions                            | **No.** Extensions are configured in ORM options, and config-level `generatorIgnore.extensions` already exists for externally managed extensions.                                                                                                                   |
| `roles.generator.ts`                | Roles                                 | **No.** Roles are configured in ORM options and already have global management controls, including `managedRolesSql`. There is no definition-side runtime object.                                                                                                   |
| `default-privilege.generator.ts`    | Default privileges                    | **No.** Default privileges are configured under roles. Config-level ignore or simply not declaring the config is clearer than adding nested ignore flags.                                                                                                           |
| `grants.generator.ts`               | Direct grants                         | **No for this feature.** Grants can be project-wide or table-local, but they are migration metadata rather than runtime query objects. Existing `generatorIgnore.grants` already supports target-specific and grantee-specific filtering.                           |
| `rls.generator.ts`                  | Row-level security flags and policies | **No for this feature.** RLS is table-local migration metadata. Existing `generatorIgnore.rls.tables` and `generatorIgnore.rls.policies` already cover the meaningful partial-management cases.                                                                     |

Test samples confirm the current model:

- Table tests already use `generatorIgnore.schemas` and `generatorIgnore.tables` to prevent dropping externally managed tables.
- View and materialized-view tests already use `generatorIgnore.views` to ignore both database-only and code-defined views.
- View docs state that views are managed only when listed in ORM `views`, and that regular and materialized views share `generatorIgnore.views`.
- RLS tests and docs show separate table-level and policy-level ignores when partial management is intentionally supported.
- Enum and domain tests show those types are derived from table columns or ORM options, not standalone runtime query definitions.

Implication: the new feature should be a local, ergonomic alias for existing table/view ignore intent, not a broad new ignore vocabulary for every generator.

## Proposed user-facing design

Add a definition-side migration-generator opt-out only to table-like runtime definitions:

```ts
class LegacyReport extends BaseTable {
  readonly table = 'legacy_report';
  generatorIgnore = true;

  columns = this.setColumns((t) => ({
    id: t.integer().primaryKey(),
    payload: t.json(),
  }));
}

class LegacyReportView extends BaseTable.View {
  name = 'legacy_report_view';
  generatorIgnore = true;

  columns = this.setColumns((t) => ({
    id: t.integer(),
    payload: t.json(),
  }));
}
```

The same option should be available on `BaseTable.MaterializedView`.

User-facing behavior:

- The table or view remains queryable.
- The migration generator treats the object as ignored, equivalent to listing its resolved name in `generatorIgnore.tables` or `generatorIgnore.views`.
- For a table, the whole table is unmanaged by generated migrations: table creation/drop/change, columns, constraints, indexes, RLS, policies, and table-local grants should not be reconciled through that table.
- For a regular or materialized view, the whole view DDL is unmanaged: create/drop, SQL, columns, options, materialized-view options, dependencies, and view indexes should not be reconciled through that view definition.
- Ignoring the table or view object should not automatically ignore grants unless existing top-level ignore semantics already do that. Docs should keep the current distinction: object ignore controls object DDL; `generatorIgnore.grants` controls grants.
- Config-level `generatorIgnore` remains necessary for objects that are not represented by a table/view class, for regular-expression selectors, for schema-wide ignores, and for environment/provider-generated objects.
- If both definition-side and config-level ignore match the same object, behavior should be idempotent.

Recommended scope for feature 716:

1. Add definition-side ignore support for `BaseTable` table classes.
2. Add definition-side ignore support for `BaseTable.View`.
3. Add definition-side ignore support for `BaseTable.MaterializedView`.
4. Document this as a local alternative to config-level `generatorIgnore.tables` and `generatorIgnore.views`.
5. Do not add `generatorIgnore` to enums, domains, roles, extensions, schemas, columns, primary keys, foreign keys, checks, indexes, excludes, grants, default privileges, or RLS in this feature.

## References

- Django model `managed` option: https://docs.djangoproject.com/en/6.0/ref/models/options/#managed
- TypeORM index synchronization opt-out: https://typeorm.io/docs/indexes/#disabling-synchronization
- TypeORM migration setup and global synchronization guidance: https://typeorm.io/docs/migrations/setup/
- TypeORM view entity synchronization request: https://github.com/typeorm/typeorm/issues/4317
- Alembic autogenerate documentation: https://alembic.sqlalchemy.org/en/latest/autogenerate.html
- Prisma schema `@ignore` and `@@ignore`: https://www.prisma.io/docs/orm/reference/prisma-schema-reference#ignore
- Prisma discussion about excluding models from `db push` and the view problem: https://github.com/prisma/prisma/discussions/14161
- Drizzle Kit config filters and entity management settings: https://orm.drizzle.team/docs/drizzle-config-file
