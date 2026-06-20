---
description: Automatic migration generation, role management, grants, default privileges, and generatorIgnore configuration.
---

# Generate Migrations

## generate migrations

After defining, modifying, or deleting tables or columns in the app code,
run `db g` command to generate corresponding migration:

```shell
npm run db g
# or
pnpm db g
```

Optionally, provide a migration file name:

```shell
pnpm db g create-some-tables
pnpm db g "create some tables" # spaces are replaced with dashes
```

It automatically calls `db up` to apply existing migrations when it starts.

Pass `up` argument if you'd like to apply the migration right after it generates:

```shell
pnpm db g create-some-tables up

# or, with a default "generated" file name
pnpm db g up
```

:::warning
Use this approach **only** if is the database can be fully managed by your application.

This tool will drop all database entities (schemas, tables, etc.) that aren't referenced by your application's code.
:::

This tool will automatically write a migration to create, drop, change, rename database items.

When you're renaming a table, column, enum, or a schema in the code, it will interactively ask via the terminal whether you want to create a new item or to rename the old one.
Such as when renaming a column, you may choose to drop the old one and create a new (data will be lost), or to rename the existing (data is preserved).

If you don't set a custom constraint name for indexes, primary keys, foreign keys, exclude constraints, they have a default name such as `table_pkey`, `table_column_idx`, `table_someId_fkey`, `table_column_exclude`.
When renaming a table, the table primary key will be also renamed. When renaming a column, its index or foreign key will be renamed as well.

The tool handles migration generation for
tables, columns, schemas, enums, primary keys, foreign keys, indexes, database checks, exclude constraints, extensions, domain types, and configured views.

Let me know by opening an issue if you'd like to have a support for additional database features such as triggers and procedures.

## row level security

Migration generation supports table-level RLS flags and policies declared in code with `defineRls`.
Project-wide defaults are configured in `orchidORM`:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    rls: {
      tableRlsDefaults: {
        enable: true,
      },
    },
  },
  { ...tables },
);
```

On the code side, an omitted table `force` value defaults to `true` after project `tableRlsDefaults` are applied.
This intentionally differs from PostgreSQL's database default, where table owners bypass RLS unless the table is forced.
The safer Orchid default makes generated migrations add `FORCE ROW LEVEL SECURITY` for declared RLS tables unless you opt out, which helps owner-like test and migration connections exercise the same policy boundary as application roles.

To keep PostgreSQL owner-bypass behavior, set `force: false` on the table declaration or set `rls.tableRlsDefaults.force: false` for the project.

For tables with `rls` declarations, generated migrations compare:

- table flags: `enable` and `force`
- policies from required non-empty `permit` declarations and optional `restrict` declarations

See [Row Level Security](/guide/row-level-security#table-rls-declaration-and-defaults) for setup and behavior details, including policy declaration and how defaults are applied.

## roles

By default, migrations generator doesn't track Postgres ORMs, you can manage them manually if needed.

Provide `roles` array to the options to activate role management:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    roles: [
      {
        // a simple role with no options
        name: 'guest',
      },
      {
        name: 'admin',
        super: true,
        inherit: true,
        createRole: true,
        createDb: true,
        canLogin: true,
        replication: true,
        connLimit: 123,
        validUntil: new Date('2030-01-01'),
        bypassRls: true,
        // config is of type Record<string, string>:
        // consult with Postgres docs for supported variables.
        config: {
          statement_timeout: '30s',
          work_mem: '128MB',
        },
      },
    ],
  },
  { ...tables },
);
```

The migration logic will ignore the `postgres` role and all the roles that starts with `pg_`,
it will synchronize all other roles.

You can tweak this filter by setting `managedRolesSql` that's being applied to a query of `pg_roles` table:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    roles: [...roles],
    // it's a default SQL
    managedRolesSql: `rolname != 'postgres' AND rolname !~ '^pg_'`,
  },
  { ...tables },
);
```

## default privileges

Default privileges automatically grant permissions to roles for database objects (tables, sequences, functions, types, schemas, large objects) created in the future. They can be applied within a specific schema or globally.

This is configured per-role in the `roles` array:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    roles: [
      {
        name: 'app_user',
        defaultPrivileges: [
          {
            owner: 'admin',
            schema: 'public',
            tables: {
              privileges: ['SELECT', 'INSERT', 'UPDATE'],
              grantablePrivileges: ['DELETE'],
            },
            sequences: {
              privileges: ['USAGE'],
            },
          },
          {
            schema: 'analytics',
            tables: {
              privileges: ['SELECT'],
            },
          },
        ],
      },
      {
        name: 'admin',
        defaultPrivileges: [
          {
            schema: 'public',
            functions: {
              privileges: ['EXECUTE'],
            },
            types: {
              privileges: ['USAGE'],
            },
          },
        ],
      },
    ],
  },
  { ...tables },
);
```

Each default privilege entry accepts:

- `owner`: (optional) Corresponds to PostgreSQL `FOR ROLE target_role`. Objects created by this role will have the default privileges applied. Defaults to the current user.
- `schema`: (optional) The schema where objects will be created. If omitted, it applies globally to all schemas.
- Object type configurations: `tables`, `sequences`, `functions`, `types`, `schemas` (global only), `largeObjects` (global only).

Each object type accepts:

- `privileges`: Privileges granted to the role
- `grantablePrivileges`: Privileges granted WITH GRANT OPTION (role can grant these to others)

**Supported privileges by object type:**

| Object Type   | Available Privileges                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| Tables        | ALL, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| Sequences     | ALL, USAGE, SELECT, UPDATE                                                   |
| Functions     | ALL, EXECUTE                                                                 |
| Types         | ALL, USAGE                                                                   |
| Schemas       | ALL, USAGE, CREATE                                                           |
| Large Objects | ALL, SELECT, UPDATE                                                          |

When `ALL` is specified, it grants all available privileges for that object type. In SQL, this is rendered as `ALL PRIVILEGES`.

The migration generator will automatically create or update default privileges when you run `db g`.

Use `changeDefaultPrivileges` in [migration writing](/guide/migration-writing#changedefaultprivileges) to grant or revoke default privileges manually.

## grants

`grants` declare direct PostgreSQL privileges for existing database objects.
When you run `db g`, Orchid compares declared grants with database ACLs and generates reversible `db.grant` and `db.revoke` migration calls.

Use grants for objects that already exist, or for objects managed by generated migrations.
Use [default privileges](/guide/generate-migrations#default-privileges) when you want PostgreSQL to automatically apply privileges to objects created in the future.

Project-wide grants are configured in `orchidORM`:

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    roles: [{ name: 'app_user' }, { name: 'readonly' }],
    defaultGrantedBy: 'app_owner', // optional, defaults to the current role executing the migrations
    grants: [
      {
        to: 'app_user',
        schemas: ['public'],
        privileges: ['USAGE'],
      },
      {
        to: 'app_user',
        allTablesIn: ['public'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      {
        to: 'app_user',
        allSequencesIn: ['public'],
        privileges: ['USAGE', 'SELECT', 'UPDATE'],
      },
      {
        to: 'readonly',
        tables: ['public.project', 'public.task'],
        privileges: ['SELECT'],
        grantablePrivileges: ['REFERENCES'],
      },
    ],
  },
  { ...tables },
);
```

`defaultGrantedBy` sets the default `GRANTED BY` role for generated grant SQL.
A grant-specific `grantedBy` overrides `defaultGrantedBy`.
When neither is provided, generated comparison is grantor-agnostic and generated SQL omits `GRANTED BY`.

Each grant item accepts:

- `to`: one role or a non-empty array of roles. `PUBLIC`, `CURRENT_ROLE`, `CURRENT_USER`, and `SESSION_USER` are accepted PostgreSQL role specifications.
- `grantedBy`: optional grantor role for this grant.
- exactly one target key: `schemas`, `tables`, `allTablesIn`, `sequences`, `allSequencesIn`, `routines`, `allRoutinesIn`, `types`, `domains`, or `databases`.
- `privileges`: ordinary privileges to grant.
- `grantablePrivileges`: privileges to grant with `WITH GRANT OPTION`.

Supported grant target keys:

| Target key       | PostgreSQL target            | Privileges                                                                   |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| `schemas`        | `ON SCHEMA`                  | ALL, USAGE, CREATE                                                           |
| `tables`         | `ON TABLE`                   | ALL, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| `allTablesIn`    | `ON ALL TABLES IN SCHEMA`    | ALL, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| `sequences`      | `ON SEQUENCE`                | ALL, USAGE, SELECT, UPDATE                                                   |
| `allSequencesIn` | `ON ALL SEQUENCES IN SCHEMA` | ALL, USAGE, SELECT, UPDATE                                                   |
| `routines`       | `ON ROUTINE`                 | ALL, EXECUTE                                                                 |
| `allRoutinesIn`  | `ON ALL ROUTINES IN SCHEMA`  | ALL, EXECUTE                                                                 |
| `types`          | `ON TYPE`                    | ALL, USAGE                                                                   |
| `domains`        | `ON DOMAIN`                  | ALL, USAGE                                                                   |
| `databases`      | `ON DATABASE`                | ALL, CREATE, CONNECT, TEMPORARY, TEMP                                        |

`ALL` renders as `ALL PRIVILEGES`.
`TEMP` is accepted as a database privilege alias for `TEMPORARY`.
`MAINTAIN` is a PostgreSQL 17+ table privilege; older PostgreSQL versions reject SQL that uses it.

Concrete table, sequence, routine, type, and domain names may be schema-qualified, such as `public.project`, or unqualified.
Unqualified concrete object names are interpreted relative to the configured migration schema.
Schema-wide targets such as `allTablesIn` contain schema names directly.

### table grants

For privileges that belong to one table, declare grants next to the table class with `setGrants`:

```ts
import { setGrants } from 'orchid-orm';
import { BaseTable } from './base-table';

export class ProjectTable extends BaseTable {
  readonly table = 'project';

  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
  }));

  grants = setGrants([
    {
      to: 'app_user',
      privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    },
    {
      to: 'reporting_user',
      privileges: ['SELECT'],
    },
  ]);
}
```

Table-local grants are converted into ordinary table grants during migration generation.
They use the table name and schema from the table class, and `defaultGrantedBy` applies to them the same way as to top-level grants.

Use top-level `grants` for schema grants, sequence grants, routine grants, database grants, schema-wide grants, and cross-cutting grants that should not be repeated on every table.
Table grants do not grant access to sequences used by identity or serial columns; grant sequence privileges separately.

Generated grant reconciliation manages direct ACL entries.
It does not try to prove effective access through role membership, ownership, `PUBLIC`, or superuser bypass.

For manual grant and revoke migrations, see [migration writing](/guide/migration-writing#grant-revoke).

## generatorIgnore

`db g` command attempts to drop all the database entities that it cannot find in the code.

Use `generatorIgnore` option to preserve db entities that are needed but not reflected in the code.
Such as when using certain extensions, or libraries, they can create schemas, tables, views, types, etc.

Ignoring a schema also ignores all its tables, views, domains, enums.

```ts
export const db = orchidORM(
  {
    databaseURL: process.env.DATABASE_URL,
    extensions: ['postgis'],
    generatorIgnore: {
      // pgboss library keeps all its db objects in the `pgboss` schema.
      schemas: ['pgboss'],
      // spatial_ref_sys is automatically created by postgis
      tables: ['spatial_ref_sys'],
      // ignore views managed outside Orchid.
      // use schema-qualified names for views outside the current schema.
      views: ['legacy_view', 'analytics.external_view', /^external_/],
      // you can ignore individual enums, domains, extensions.
      enums: [],
      domains: [],
      extensions: [],
      // keep table RLS state managed outside Orchid while still diffing the table itself.
      rls: {
        tables: ['externally_managed_table'],
        policies: [
          {
            table: 'project',
            names: ['project_external_policy'],
          },
        ],
      },
      // keep these grants managed outside Orchid while still diffing the roles and objects.
      grants: {
        roles: ['external_role'],
        tables: [/^audit_/, 'external_table'],
        allTablesIn: ['external_schema'],
      },
    },
  },
  { ...tables },
);
```

Top-level `generatorIgnore.tables` ignores the whole table, including its RLS flags and policies.
Top-level `generatorIgnore.views` ignores view DDL reconciliation for matching views, whether the view exists only in the database, only in code, or in both places.
`generatorIgnore.rls.tables` ignores only RLS flags and policies for the listed tables without disabling ordinary table diffing.
`generatorIgnore.rls.policies` ignores only the listed policy names for a table; policy names are matched exactly.
`generatorIgnore.grants.roles` ignores grants for matching grantee roles.
`generatorIgnore.grants.<targetKey>` ignores grants for matching grant targets, such as `tables`, `allTablesIn`, `sequences`, `routines`, `types`, `domains`, or `databases`.
Schema-qualified table names use the same `schema.table` string format as other ignore settings.
View names use the same format: `view_name` for the current schema or `schema.view_name` for another schema.
`generatorIgnore.views` selectors may be strings or regular expressions; regular expressions match the normalized view name.

Grant ignore selectors may be a string, a regular expression, or an array of strings and regular expressions.
Grant-specific ignores suppress grant reconciliation only; they do not disable ordinary object diffing.
For views, use `generatorIgnore.views` to ignore the view itself: create, drop, SQL, columns, and options.
Use `generatorIgnore.grants.tables` to ignore privileges on the view, such as `GRANT SELECT ON TABLE my_view`.
If both the view and its grants are managed outside Orchid, list it in both places.
