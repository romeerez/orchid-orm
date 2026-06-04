```ts
db.grantDefaultSchemaPrivileges('schema', {
  toRole: 'role',
  objects: ['relation', 'sequence'],
  privileges: ['INSERT', 'SELECT'],
  isGrantable: true,
});
```

---

Read the code in last "wip" commit: there is a mistake for you to fix.
All you need to do is within those changes.

Currently, `defaultPrivilege` types and structures have:

- list of objects (tables, sequences)
- list of privileges (insert, select, etc.)

The problem is different objects support different sets of privileges.

Here is correspondence (key is object, value is a list of privileges):
TABLES: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
SEQUENCES: USAGE, SELECT, UPDATE
FUNCTIONS: EXECUTE
TYPES: USAGE
SCHEMAS: USAGE, CREATE
LARGE OBJECTS: SELECT, UPDATE

Instead of `objects` and `privileges` in `DbDefaultPrivilege` in this file,
It should have (all optional) a key for every object, value is array of supported privileges.

Update all Privilege types in structures with this change.
