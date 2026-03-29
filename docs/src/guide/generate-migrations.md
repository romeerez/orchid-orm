---
description: Automatic migration generation, role management, default privileges, and generatorIgnore configuration.
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
tables, columns, schemas, enums, primary keys, foreign keys, indexes, database checks, exclude constraints, extensions, domain types.

Let me know by opening an issue if you'd like to have a support for additional database features such as views, triggers, procedures.

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

## generatorIgnore

`db g` command attempts to drop all the database entities that it cannot find in the code.

Use `generatorIgnore` option to preserve db entities that are needed but not reflected in the code.
Such as when using certain extensions, or libraries, they can create schemas, tables, types, etc.

Ignoring a schema also ignores all its tables, domains, enums.

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
      // you can ignore individual enums, domains, extensions.
      enums: [],
      domains: [],
      extensions: [],
    },
  },
  { ...tables },
);
```
