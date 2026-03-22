# Default Privileges

## Goal

Allow user to keep roles default privileges config in the query builder.

This config will be used by `rake-db` for corresponding migrations, and by migration generators of `orm`.

This feature exposes types and constants for other packages to use.
The types and constants should be based on PostgreSQL's default privileges specifics.

For now this is only supported for defining default privileges within database schemas, which makes `schema` property requred in a default privilege.
Global default privileges are not supported yet.

## Exports

### Constants

All constants are grouped under a single `DEFAULT_PRIVILEGE` export:

- `DEFAULT_PRIVILEGE.OBJECT_TYPES` - Array of object types: `'TABLES'`, `'SEQUENCES'`, `'FUNCTIONS'`, `'TYPES'`
- `DEFAULT_PRIVILEGE.PRIVILEGES.TABLE` - Array of table privileges: ALL, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
- `DEFAULT_PRIVILEGE.PRIVILEGES.SEQUENCE` - Array of sequence privileges: ALL, USAGE, SELECT, UPDATE
- `DEFAULT_PRIVILEGE.PRIVILEGES.FUNCTION` - Array of function privileges: ALL, EXECUTE
- `DEFAULT_PRIVILEGE.PRIVILEGES.TYPE` - Array of type privileges: ALL, USAGE

### Types

Types are exported in the `DefaultPrivileges` namespace:

- `DefaultPrivileges.ObjectType` - Type of object types
- `DefaultPrivileges.Privilege` - Interface with privilege type properties:
  - `Privilege.Table` - Type of table privileges
  - `Privilege.Sequence` - Type of sequence privileges
  - `Privilege.Function` - Type of function privileges
  - `Privilege.Type` - Type of type privileges
- `DefaultPrivileges.SchemaConfig` - Interface for schema-scoped default privileges config with `schema`, `tables`, `sequences`, `functions`, and `types` properties. Also supports `all` and `allGrantable` boolean options for granting ALL privileges on all object types.

## Requirements

When processing default privileges, if a privilege appears in both `allow` (or `privileges`) and `allowGrantable` (or `grantablePrivileges`) for the same object type, it should be filtered out from `allow` and only appear in `allowGrantable`. This prevents redundant GRANT statements for the same privilege.

When `all` is set to `true`, it grants ALL privileges on all object types (tables, sequences, functions, types). When `allGrantable` is set to `true`, it grants ALL privileges with GRANT OPTION on all object types. If `allGrantable` is provided, `all` is ignored. Individual object type configurations are merged on top of the `all` or `allGrantable` base.

## Usage

User will be able to define default privileges per a role when instantiating orm:

```ts
const orm = createOrchidOrm({
  roles: [
    {
      name: 'app_user',
      defaultPrivileges: {
        schema: 'schema-name',
        tables: {
          allow: ['SELECT', 'INSERT'],
          allowGrantable: ['UPDATE', 'DELETE'],
        },
        sequences: {
          allow: ['USAGE'],
        },
        functions: {
          allow: ['EXECUTE'],
        },
        types: {
          allow: ['USAGE'],
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


