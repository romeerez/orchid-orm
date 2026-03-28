# Default Privilege

## Migration DSL

Only `grantee` is required. `schema` is optional (defaults to global).
In an object like `table` the `allow` array is required.

You can also use `all: true` to grant ALL privileges on all object types, or `allGrantable: true` to grant ALL privileges with GRANT OPTION on all object types. When `allGrantable` is provided, `all` is ignored. When `all` or `allGrantable` is used, individual object type configurations (tables, sequences, etc.) are merged on top of the base `all` configuration.

Supported privileges per object type:
- Tables: ALL, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN (MAINTAIN is supported starting with PostgreSQL 17)
- Sequences: ALL, USAGE, SELECT, UPDATE
- Functions: ALL, EXECUTE
- Types: ALL, USAGE
- Schemas: ALL, USAGE, CREATE
- Large Objects: ALL, SELECT, UPDATE

When `ALL` is specified, it grants all available privileges for that object type. In SQL, this is rendered as `ALL PRIVILEGES`.

```ts
change(async (db) => {
  await db.changeDefaultPrivileges({
    owner: 'some_user',
    grantee: 'some_role',
    schema: 'some_schema',
    grant: {
      all: true,  // grant ALL privileges on all object types
    },
  });

  await db.changeDefaultPrivileges({
    owner: 'admin',
    grantee: 'manager',
    schema: 'app_schema',
    grant: {
      allGrantable: true,  // grant ALL privileges with GRANT OPTION on all object types
    },
  });
});
```

```ts
change(async (db) => {
  await db.changeDefaultPrivileges({
    owner: 'some_user',
    grantee: 'some_role',
    schema: 'some_schema',
    grant: {
      tables: {
        privileges: ['SELECT', 'INSERT'],
        grantablePrivileges: ['UPDATE', 'DELETE'],
      },
      sequences: {
        privileges: ['USAGE'],
      },
    },
    revoke: {
      functions: {
        grantablePrivileges: ['EXECUTE'],
      },
    },
  });
});
```

## AST

The `RakeDbAst.DefaultPrivilege` will be used by migration DSL to generate SQL queries, and by migration generator for generating migrations.

## Introspection

`db-structure.ts` introspects default privileges into a `defaultPrivilege` field of `introspectDbSchema` result.

Doesn't load default privileges by default, but can be enabled by passing `loadDefaultPrivileges: true` to `introspectDbSchema`.

Has the following type:

```ts
export namespace DbStructure {
  export interface DefaultPrivilegeConfig {
    privilege: string;
    isGrantable: boolean;
  }

  export interface DefaultPrivilegeObjectConfig {
    object: DefaultPrivileges.ObjectType;
    privilegeConfigs: DefaultPrivilegeConfig[];
  }

  export interface DefaultPrivilege {
    owner?: string;
    grantee: string;
    schema?: string;
    objectConfigs: DefaultPrivilegeObjectConfig[];
  }
}
```

### Filtering

1. **Global privileges included**: Entries without a `schema`, or with `object` of `'schema'` or `'large_object'` are now supported.

### Grouping

Privileges are grouped by the combination of `owner` + `grantee` + `schema` into a single `DbStructure.DefaultPrivilege` entry.

### Output Structure

Each group produces a `DefaultPrivilege` with:
- `owner`: from raw data
- `grantee`: from raw data
- `schema`: from raw data
- `objectConfigs`: Array of objects grouped by object type, each containing:
  - `object`: Mapped object type ('TABLES', 'SEQUENCES', etc.)
  - `privilegeConfigs`: Array of privilege configurations

## Generating migration code

`ast-to-generate-items.ts` logic for `defaultPrivilege` should:
- add `schema` (if present) to `deps`: privilege uses a schema
- add `owner` (if available) and `grantee` to `deps`
- to differentiate roles from other db objects in `deps`, prefix roles in `deps` with `role:`

## Generating migration

`ast-to-migration.ts` should convert `RakeDbAst.DefaultPrivilege` to a migration code.

Example input ast:

```ts
{
  type: 'defaultPrivilege',
  owner: 'some_user',
  grantee: 'some_role',
  schema: 'some_schema',
  grant: {
    tables: {
      privileges: ['SELECT', 'INSERT'],
      grantablePrivileges: ['UPDATE', 'DELETE'],
    },
    sequences: {
      privileges: ['USAGE'],
    },
  },
  revoke: {
    functions: {
      grantablePrivileges: ['EXECUTE'],
    },
  },
}
```

Example output code:

```ts
await db.changeDefaultPrivileges({
  grant: {
    tables: {
      privileges: ['SELECT', 'INSERT'],
      grantablePrivileges: ['UPDATE', 'DELETE'],
    },
    sequences: {
      privileges: ['USAGE'],
    },
  },
  revoke: {
    functions: {
      grantablePrivileges: ['EXECUTE'],
    },
  },
});
```

The output code is array of arrays of strings.
Every string element is a new line.
Every nested array adds 1 level of indentation.