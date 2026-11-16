# ORM Instance Guidance

Creating an ORM must not call a dynamic `schema` function of a table, a view,
or the ORM: it may rely on a context that exists only when queries are built.

The table and view name check does not compare a dynamic schema, even when
both have the same function: it can return a different schema for each.

Test ORM creation from a bundle, as `orchidORM` of the driver entry points
does: `orchidORMWithAdapter` without views does not reach the name check.
