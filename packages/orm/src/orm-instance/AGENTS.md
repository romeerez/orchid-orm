# ORM Instance Guidance

Creating an ORM must not call a dynamic `schema` function of a table, a view,
or the ORM: it may rely on a context that exists only when queries are built.

The table and view name check does not compare a dynamic schema, even when
both have the same function: it can return a different schema for each.

An ORM bound to an existing `db` inherits `log` from `q.log` of `db`, not
from an option stored apart from it: `.log()` on `db` changes only `q.log`.
pqb makes the default callbacks of the inherited log write to a `logger`
passed next to `db`.

Test ORM creation from a bundle, as `orchidORM` of the driver entry points
does: `orchidORMWithAdapter` without views does not reach the name check.
