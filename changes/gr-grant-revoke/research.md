# Postgres GRANT and REVOKE Capabilities

## Purpose and goals

This document captures what PostgreSQL supports for object `GRANT` and `REVOKE` statements so later ORM and migration design can be based on a reliable capability reference.

## Valuable external context

### GRANT has two distinct forms

PostgreSQL `GRANT` supports:

- granting privileges on database objects;
- granting membership in roles.

This research is about object privileges. Role membership grants use different options (`ADMIN`, `INHERIT`, `SET`) and cannot be granted to `PUBLIC`; they should not be conflated with object privilege grants.

### Object targets and allowed privileges

PostgreSQL 18 supports these object grant targets and privilege sets:

| Target                                 | Privileges                                                                                                  | Notes                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `TABLE table_name`                     | `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN`, `ALL [PRIVILEGES]` | `TABLE` covers tables, views, materialized views, foreign tables, and other table-like objects where the privilege applies. |
| `ALL TABLES IN SCHEMA schema_name`     | same as table                                                                                               | Applies to existing tables, views, and foreign tables in the listed schemas. Does not set defaults for future objects.      |
| table columns                          | `SELECT`, `INSERT`, `UPDATE`, `REFERENCES`, `ALL [PRIVILEGES]` with a column list                           | Column grants are written as `GRANT SELECT (col1, col2) ON TABLE table_name TO role`.                                       |
| `SEQUENCE sequence_name`               | `USAGE`, `SELECT`, `UPDATE`, `ALL [PRIVILEGES]`                                                             | Sequence permissions are independent from table permissions, including serial or identity-backed tables.                    |
| `ALL SEQUENCES IN SCHEMA schema_name`  | same as sequence                                                                                            | Existing sequences only.                                                                                                    |
| `DATABASE database_name`               | `CREATE`, `CONNECT`, `TEMPORARY` / `TEMP`, `ALL [PRIVILEGES]`                                               | `TEMP` is an alternate spelling for `TEMPORARY`.                                                                            |
| `DOMAIN domain_name`                   | `USAGE`, `ALL [PRIVILEGES]`                                                                                 | Domains are also types, but PostgreSQL has a distinct `DOMAIN` syntax.                                                      |
| `FOREIGN DATA WRAPPER fdw_name`        | `USAGE`, `ALL [PRIVILEGES]`                                                                                 | Allows creating foreign servers using that wrapper.                                                                         |
| `FOREIGN SERVER server_name`           | `USAGE`, `ALL [PRIVILEGES]`                                                                                 | Allows creating foreign tables using the server and managing own user mappings.                                             |
| `FUNCTION function_name(args)`         | `EXECUTE`, `ALL [PRIVILEGES]`                                                                               | Works for plain functions, aggregate functions, and window functions, not procedures.                                       |
| `PROCEDURE procedure_name(args)`       | `EXECUTE`, `ALL [PRIVILEGES]`                                                                               | Procedures use `PROCEDURE`, or `ROUTINE` if either function/procedure is acceptable.                                        |
| `ROUTINE routine_name(args)`           | `EXECUTE`, `ALL [PRIVILEGES]`                                                                               | Covers functions, aggregate functions, window functions, and procedures.                                                    |
| `ALL FUNCTIONS IN SCHEMA schema_name`  | `EXECUTE`, `ALL [PRIVILEGES]`                                                                               | Includes aggregate and window functions, not procedures.                                                                    |
| `ALL PROCEDURES IN SCHEMA schema_name` | `EXECUTE`, `ALL [PRIVILEGES]`                                                                               | Existing procedures only.                                                                                                   |
| `ALL ROUTINES IN SCHEMA schema_name`   | `EXECUTE`, `ALL [PRIVILEGES]`                                                                               | Includes functions and procedures.                                                                                          |
| `LANGUAGE lang_name`                   | `USAGE`, `ALL [PRIVILEGES]`                                                                                 | Procedural language usage.                                                                                                  |
| `LARGE OBJECT loid`                    | `SELECT`, `UPDATE`, `ALL [PRIVILEGES]`                                                                      | Target is a large-object OID, not a schema-qualified name.                                                                  |
| `PARAMETER configuration_parameter`    | `SET`, `ALTER SYSTEM`, `ALL [PRIVILEGES]`                                                                   | Useful mainly for parameters normally restricted to superusers.                                                             |
| `SCHEMA schema_name`                   | `CREATE`, `USAGE`, `ALL [PRIVILEGES]`                                                                       | `USAGE` permits object lookup in the schema, but object-specific privileges are still required.                             |
| `TABLESPACE tablespace_name`           | `CREATE`, `ALL [PRIVILEGES]`                                                                                | Allows objects or databases to use the tablespace.                                                                          |
| `TYPE type_name`                       | `USAGE`, `ALL [PRIVILEGES]`                                                                                 | Controls creation of dependencies on types; it does not control every query-time value usage.                               |

`ALL [PRIVILEGES]` means all privileges available for that object type. PostgreSQL treats `PRIVILEGES` as optional, although strict SQL requires it.

Most object forms accept multiple objects and multiple grantees in one statement. The `ALL ... IN SCHEMA` forms accept multiple schema names. The schema-wide `ALL ... IN SCHEMA` shortcut exists only for tables, sequences, functions, procedures, and routines; other object types must be granted by naming concrete objects.

For table targets, `TABLE` is optional in `ON [ TABLE ] table_name`. For routine targets, PostgreSQL accepts an optional argument list and permits argument modes and names in that list; for stable identity, only the argument data types matter.

### Privilege meanings

Important privilege semantics from PostgreSQL docs:

- `SELECT`: read from table-like objects, specific columns, sequences via `currval`, or large objects; also needed by many `UPDATE`, `DELETE`, or `MERGE` statements that reference existing values.
- `INSERT`: insert into table-like objects or specific columns; also allows `COPY FROM`.
- `UPDATE`: update table-like objects or specific columns; for sequences, allows `nextval` and `setval`; for large objects, allows writing or truncation.
- `DELETE`: delete rows from table-like objects; nontrivial deletes often also need `SELECT`.
- `TRUNCATE`: truncate tables.
- `REFERENCES`: create foreign keys referencing a table or specific columns.
- `TRIGGER`: create triggers on table-like objects.
- `CREATE`: create schemas/publications/extensions in a database, objects in a schema, or objects/databases using a tablespace.
- `CONNECT`: connect to a database; checked at connection startup.
- `TEMPORARY` / `TEMP`: create temporary tables in a database.
- `EXECUTE`: call functions or procedures, including operators implemented by functions.
- `USAGE`: object-type-specific lookup or creation capability for schemas, languages, sequences, types/domains, foreign data wrappers, and foreign servers.
- `SET`: set a configuration parameter in the current session.
- `ALTER SYSTEM`: set a configuration parameter with `ALTER SYSTEM`.
- `MAINTAIN`: run table maintenance operations such as `VACUUM`, `ANALYZE`, `CLUSTER`, `REFRESH MATERIALIZED VIEW`, `REINDEX`, `LOCK TABLE`, and statistics-manipulation functions.

### Grantees

Object privileges may be granted to:

- role names;
- `PUBLIC`;
- `CURRENT_ROLE`;
- `CURRENT_USER`;
- `SESSION_USER`.

`PUBLIC` means every role, including roles created later. Effective permissions for a role are the union of direct grants, grants to roles it is currently a member of, and grants to `PUBLIC`.

The optional noise word `GROUP` may appear before a role name in object privilege syntax, but users and groups have been unified as roles since PostgreSQL 8.1.

### Grant option

`WITH GRANT OPTION` gives the recipient permission to grant that same privilege to other roles.

Limitations and edge cases:

- PostgreSQL does not allow grant options to be granted to `PUBLIC` for object privileges.
- Object owners do not need explicit grants; they have all privileges by default and are treated as holding all grant options.
- PostgreSQL allows owners to revoke their own ordinary privileges, for example to make a table read-only for themselves. Owners still retain implicit grant options and can re-grant privileges.
- The right to drop an object or alter its definition is inherent to ownership and cannot be granted or revoked as an object privilege.
- Superusers bypass object privilege checks. If they issue `GRANT` or `REVOKE`, PostgreSQL records the object owner as the grantor for object privileges.
- A non-owner can grant only privileges for which it has grant option. `GRANT ALL PRIVILEGES` can therefore grant less than the literal full set when executed by a non-owner without every grant option.

### Grantor and `GRANTED BY`

Object grants accept optional `GRANTED BY role_specification`.

For object grants, PostgreSQL currently requires the specified grantor to be the current user; the clause exists mainly for SQL compatibility. Grants executed through ownership role membership or grant-option membership are recorded as granted by the role that owns the object or holds grant option. If multiple membership paths could justify the grant, PostgreSQL does not specify which containing role is recorded; using `SET ROLE` first is the recommended way to control this.

### REVOKE variants

Object privilege revocation mirrors `GRANT` targets and privilege lists:

```sql
REVOKE [ GRANT OPTION FOR ] privileges
ON target
FROM grantee [, ...]
[ GRANTED BY grantor ]
[ CASCADE | RESTRICT ]
```

`REVOKE` without `GRANT OPTION FOR` removes both the privilege and its grant option. `REVOKE GRANT OPTION FOR` removes only the grant option and keeps the underlying privilege.

Revocation behavior:

- If a revoked privilege or grant option has dependent privileges that were granted onward by the revoked role, `RESTRICT` fails and `CASCADE` recursively revokes dependent privileges.
- `RESTRICT` is the default behavior when neither `CASCADE` nor `RESTRICT` is specified.
- Recursive revocation follows only grant chains traceable to the role targeted by the `REVOKE`; a dependent role may still effectively keep access through another grant path.
- A user can revoke only privileges that were granted directly by that user or by a role represented by the current grantor context.
- Revoking table privileges also revokes corresponding column privileges on that table. Revoking a privilege from individual columns does not remove a table-level grant of the same privilege.

### Object defaults and PUBLIC defaults

When an object is created, its owner normally has all grantable permissions. PostgreSQL also grants some object privileges to `PUBLIC` by default:

| Object type                                                                                                      | Default `PUBLIC` privileges |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Database                                                                                                         | `CONNECT`, `TEMPORARY`      |
| Function or procedure                                                                                            | `EXECUTE`                   |
| Language                                                                                                         | `USAGE`                     |
| Type and domain                                                                                                  | `USAGE`                     |
| Table, table column, sequence, foreign data wrapper, foreign server, large object, schema, tablespace, parameter | none                        |

Security-sensitive designs commonly revoke default `PUBLIC` privileges in the same transaction that creates the object to avoid a temporary access window.

`GRANT` and `REVOKE` affect existing objects only. Future-object defaults are managed separately with `ALTER DEFAULT PRIVILEGES` and are intentionally outside this feature scope except as a related concept.

### ACL representation and introspection facts

PostgreSQL stores privileges in ACL arrays. The user-facing display format is approximately:

```text
grantee=privilege-abbreviation[*].../grantor
```

Important facts for anyone reading or comparing ACL state:

- an empty grantee in an ACL entry means `PUBLIC`;
- `*` after a privilege abbreviation means that privilege was granted with grant option;
- separate ACL entries can exist for the same grantee when grants came from different grantors;
- a null ACL column means built-in default privileges for that object type;
- the first `GRANT` or `REVOKE` on an object instantiates default privileges into an explicit ACL and then modifies it;
- owner implicit grant options are not marked with `*`; only explicit grant options are displayed;
- `aclexplode(aclitem[])` expands ACL arrays to one row per privilege with `grantor`, `grantee`, `privilege_type`, and `is_grantable`;
- `acldefault(type, ownerOid)` can construct the default ACL that applies when a catalog ACL column is null.

Useful ACL abbreviations:

| Privilege      | Abbreviation |
| -------------- | ------------ |
| `SELECT`       | `r`          |
| `INSERT`       | `a`          |
| `UPDATE`       | `w`          |
| `DELETE`       | `d`          |
| `TRUNCATE`     | `D`          |
| `REFERENCES`   | `x`          |
| `TRIGGER`      | `t`          |
| `CREATE`       | `C`          |
| `CONNECT`      | `c`          |
| `TEMPORARY`    | `T`          |
| `EXECUTE`      | `X`          |
| `USAGE`        | `U`          |
| `SET`          | `s`          |
| `ALTER SYSTEM` | `A`          |
| `MAINTAIN`     | `m`          |

### Information schema limitations

Information schema views expose some privileges, for example table, column, and usage privileges, but they are not a complete PostgreSQL-specific representation of every grant target and nuance. PostgreSQL-specific catalog ACLs plus `aclexplode` are the more complete base for full object-grant introspection.

### Version-sensitive behavior

PostgreSQL 17 added the table `MAINTAIN` privilege. It is present in PostgreSQL 17 and 18 table privilege summaries and absent from PostgreSQL 16 privilege summaries. Any support for PostgreSQL versions before 17 must avoid emitting `MAINTAIN` for `TABLE` and `ALL TABLES IN SCHEMA` targets.

PostgreSQL 16 changed role membership dependency tracking for `CASCADE`, but this only affects role membership grants. Object privilege cascading behavior is still relevant for this feature; role membership grant cascading is out of scope.

## Community ideas and pain points

Common operational confusion around grants is not about syntax volume; it is about privilege composition and object lifetime:

- granting privileges on a table does not grant privileges on sequences used by that table;
- granting privileges on existing tables does not affect tables created later;
- revoking from `PUBLIC` or a direct user does not prove the role cannot access the object through another role membership or grant path;
- schema `USAGE` and object privileges are both needed for normal schema-qualified object access;
- default `PUBLIC` privileges on functions, procedures, databases, languages, and types can surprise users who expect newly-created objects to be private.

These points should stay visible in later product design because a syntactically complete grant feature can still feel broken if users do not understand effective privileges.

## Requirements and edge cases

A complete capability model for PostgreSQL object grants should account for:

- every object target listed in the PostgreSQL `GRANT` and `REVOKE` syntax, including less common targets such as `PARAMETER`, `LARGE OBJECT`, foreign data wrappers, and foreign servers;
- concrete object targets and schema-wide existing-object targets as different concepts;
- `ALL [PRIVILEGES]` as object-type-specific expansion, not as a global fixed privilege list;
- `TEMP` as an accepted alias for database `TEMPORARY`;
- `WITH GRANT OPTION` as an attribute of individual granted privileges;
- `PUBLIC` as a valid object-privilege grantee but not a valid recipient of grant options;
- optional `GRANTED BY`, while recognizing PostgreSQL's restrictions and grantor-recording behavior;
- `REVOKE GRANT OPTION FOR` separately from full privilege revocation;
- `CASCADE` and `RESTRICT` behavior for dependent grants;
- owner and superuser behavior, including owner implicit privileges and superuser bypass;
- table-level versus column-level privilege interactions;
- sequence privileges independent from related table privileges;
- schema `USAGE` being necessary but not sufficient for object access;
- multi-object and multi-grantee syntax, even if later generated SQL chooses one object or grantee per statement for simpler diffing;
- routine identity by argument types, not argument names;
- grant chains and role membership making effective access broader than direct ACL entries;
- null ACL columns representing defaults rather than no privileges;
- default `PUBLIC` privileges by object type;
- PostgreSQL version filtering for `MAINTAIN` before version 17.

## Existing support in orchid-orm

Direct object `GRANT` / `REVOKE` support for existing database objects appears absent.

Related support exists:

- `pqb` has a `DefaultPrivileges` feature and exports privilege constants/types for default privileges.
- `orm` roles can carry `defaultPrivileges` configuration.
- `rake-db` can introspect, render, and generate migration changes for default privileges.
- RLS research and specs already call out that row-level policies do not replace normal SQL grants.

This means future grant/revoke design can reuse concepts and lessons from existing default-privilege support, but this document intentionally does not propose how that reuse should look.

## Proposed user-facing design

Out of scope for this research. The next design step should use this document only as the PostgreSQL capability baseline and separately decide:

- which object targets Orchid should expose first;
- whether the feature is declarative, migration-only, or both;
- how much of PostgreSQL's uncommon surface should be represented in the public API;
- how grants for existing objects should relate to existing role and default-privilege support.

## References

- PostgreSQL 18 `GRANT`: https://www.postgresql.org/docs/current/sql-grant.html
- PostgreSQL 18 `REVOKE`: https://www.postgresql.org/docs/current/sql-revoke.html
- PostgreSQL 18 privileges: https://www.postgresql.org/docs/current/ddl-priv.html
- PostgreSQL 18 ACL functions: https://www.postgresql.org/docs/current/functions-info.html
- PostgreSQL 18 `ALTER DEFAULT PRIVILEGES`: https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html
- PostgreSQL 16 privileges: https://www.postgresql.org/docs/16/ddl-priv.html
- Existing design note: `notes/plans/grant-revoke-design.md`
