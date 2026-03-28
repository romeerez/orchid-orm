# Default Privileges

## Goal

Allow user to keep roles default privileges config in the query builder.

This config will be used by `rake-db` for corresponding migrations, and by migration generators of `orm`.

This feature exposes types and constants for other packages to use.
The types and constants should be based on PostgreSQL's default privileges specifics.

This is supported for defining default privileges within database schemas (using the `schema` property) or globally (by omitting the `schema` property).

## Exports

### Constants

All constants are grouped under a single `DEFAULT_PRIVILEGE` export:

- `DEFAULT_PRIVILEGE.OBJECT_TYPES` - Array of object types: `'TABLES'`, `'SEQUENCES'`, `'FUNCTIONS'`, `'TYPES'`, `'SCHEMAS'`, `'LARGE_OBJECTS'`
- `DEFAULT_PRIVILEGE.PRIVILEGES.TABLE` - Array of table privileges: ALL, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN (MAINTAIN is supported starting with PostgreSQL 17)
- `DEFAULT_PRIVILEGE.PRIVILEGES.SEQUENCE` - Array of sequence privileges: ALL, USAGE, SELECT, UPDATE
- `DEFAULT_PRIVILEGE.PRIVILEGES.FUNCTION` - Array of function privileges: ALL, EXECUTE
- `DEFAULT_PRIVILEGE.PRIVILEGES.TYPE` - Array of type privileges: ALL, USAGE
- `DEFAULT_PRIVILEGE.PRIVILEGES.SCHEMA` - Array of schema privileges: ALL, USAGE, CREATE
- `DEFAULT_PRIVILEGE.PRIVILEGES.LARGE_OBJECT` - Array of large object privileges: ALL, SELECT, UPDATE

### Types

Types are exported in the `DefaultPrivileges` namespace:

- `DefaultPrivileges.ObjectType` - Type of object types
- `DefaultPrivileges.Privilege` - Interface with privilege type properties:
  - `Privilege.Table` - Type of table privileges
  - `Privilege.Sequence` - Type of sequence privileges
  - `Privilege.Function` - Type of function privileges
  - `Privilege.Type` - Type of type privileges
  - `Privilege.Schema` - Type of schema privileges
  - `Privilege.LargeObject` - Type of large object privileges
- `DefaultPrivileges.SchemaConfig` - Interface for default privileges config. It is a union of `SchemaTargetConfig` (requires `schema`) and `GlobalTargetConfig` (no `schema`). Both support `owner` (optional, corresponds to PostgreSQL `FOR ROLE`), `tables`, `sequences`, `functions`, and `types`. `GlobalTargetConfig` additionally supports `schemas` and `largeObjects`. Both also support `all` and `allGrantable` boolean options.

## Requirements

When processing default privileges, if a privilege appears in both `privileges` and `grantablePrivileges` for the same object type, it should be filtered out from `privileges` and only appear in `grantablePrivileges`. This prevents redundant GRANT statements for the same privilege.

When `all` is set to `true`, it grants ALL privileges on all object types (tables, sequences, functions, types). When `allGrantable` is set to `true`, it grants ALL privileges with GRANT OPTION on all object types. If `allGrantable` is provided, `all` is ignored. Individual object type configurations are merged on top of the `all` or `allGrantable` base.

## Usage

User will be able to define default privileges per a role when instantiating orm:

```ts
const orm = createOrchidOrm({
  roles: [
    {
      name: 'app_user',
      defaultPrivileges: {
        owner: 'admin',
        schema: 'schema-name',
        tables: {
          privileges: ['SELECT', 'INSERT'],
          grantablePrivileges: ['UPDATE', 'DELETE'],
        },
        sequences: {
          privileges: ['USAGE'],
        },
        functions: {
          privileges: ['EXECUTE'],
        },
        types: {
          privileges: ['USAGE'],
        },
      },
    },
  ],
}, {
  // ...tables
});
```

For granting ALL privileges on all object types, use `all` or `allGrantable`:

```ts
const orm = createOrchidOrm({
  roles: [
    {
      name: 'admin',
      defaultPrivileges: {
        schema: 'schema-name',
        all: true,  // grants ALL privileges on all object types
      },
    },
    {
      name: 'superadmin',
      defaultPrivileges: {
        schema: 'schema-name',
        allGrantable: true,  // grants ALL privileges with GRANT OPTION on all object types
      },
    },
  ],
}, {
  // ...tables
});
```


