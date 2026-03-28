# Default Privileges

## Overview

Default privileges automatically grant permissions to roles for database objects created in the future. They can be applied to objects created within a specific schema or globally across all schemas. When a table, sequence, function, type, or schema is created, the specified role automatically receives the configured permissions without requiring explicit `GRANT` statements.

## Use Cases

- **Application roles**: Ensure an `app_user` role always has SELECT/INSERT/UPDATE access to tables as they're created
- **Read-only roles**: Give analytics roles automatic read access to new tables
- **Administrative roles**: Grant EXECUTE permissions on new functions to admin roles
- **Simplified permission management**: Avoid manual grants after every schema change

## Defining Default Privileges

Default privileges are configured per-role when instantiating the ORM:

```ts
const orm = createOrchidOrm({
  roles: [
    {
      name: 'app_user',
      defaultPrivileges: [
        {
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
}, {
  // ...table definitions
});
```

## Configuration Options

Each default privilege entry accepts:

- `owner` (optional): Corresponds to PostgreSQL `FOR ROLE` target role. Objects created by this role will have the default privileges applied. Defaults to the current user.
- `schema` (optional): The schema where objects will be created. If omitted, the default privileges apply globally across all schemas.
- Object type configurations (optional): `tables`, `sequences`, `functions`, `types`, `schemas` (global only), `largeObjects` (global only)
- `all` (optional): When set to `true`, grants ALL privileges on all object types (tables, sequences, functions, types)
- `allGrantable` (optional): When set to `true`, grants ALL privileges with GRANT OPTION on all object types. Takes precedence over `all`.

Each object type accepts:

- `privileges`: Privileges granted to the role
- `grantablePrivileges`: Privileges granted WITH GRANT OPTION (role can grant these to others)

When `all` or `allGrantable` is used, individual object type configurations are merged on top. For example, `all: true` with `tables: { privileges: ['SELECT'] }` will grant SELECT specifically for tables, while granting ALL for sequences, functions, and types.

## Supported Privileges by Object Type

| Object Type | Available Privileges |
|-------------|---------------------|
| Tables | ALL, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN |
| Sequences | ALL, USAGE, SELECT, UPDATE |
| Functions | ALL, EXECUTE |
| Types | ALL, USAGE |
| Schemas | ALL, USAGE, CREATE |
| Large Objects | ALL, SELECT, UPDATE |

When `ALL` is specified, it grants all available privileges for that object type. In SQL, this is rendered as `ALL PRIVILEGES`.

## Migration Generation

When you run migration generation, the system compares your configured default privileges against the database state and generates migrations to synchronize them:

```ts
// Generated migration for granting new privileges
change(async (db) => {
  await db.changeDefaultPrivileges({
    owner: 'admin',
    grantee: 'app_user',
    schema: 'public',
    grant: {
      tables: {
        privileges: ['SELECT', 'INSERT'],
        grantablePrivileges: ['DELETE'],
      },
    },
  });
});
```

```ts
// Generated migration for revoking removed privileges
change(async (db) => {
  await db.changeDefaultPrivileges({
    grantee: 'app_user',
    schema: 'public',
    revoke: {
      sequences: {
        privileges: ['USAGE'],
      },
    },
  });
});
```

## Scope and Limitations

- Default privileges can be **schema-scoped** (applying to objects in a specific schema) or **global** (applying to all schemas).
- A role can have multiple default privilege entries for different schemas, and one global entry.
- `schemas` and `largeObjects` privileges are only available in global default privileges.
