# Columns Guidance

## JSON operators

Postgres reads the path parameter of `jsonSet`, `jsonReplace`, `jsonInsert`,
and `jsonRemove` as a `text[]` literal, so a generated SQL assertion does not
prove which path it selects. Test a change of this path against the database,
with keys that the literal syntax treats specially and with a number used as
an array index.
