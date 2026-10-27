# Relations Guidance

A relation query returns only the records of its parent. Conditions that a
relation adds, including the conditions of its definition, must hold whatever
conditions the user adds: `orWhere` and `clear('where')` must not bypass them,
whether called before or after the relation adds its conditions.

Relation conditions are marked when a relation is applied and when its join
functions run. A condition that relation code adds outside of these, as `chain`
does, must be marked too.

A nested `belongsTo` `delete` must detach every record that references the
deleted records, including records of other parents, or deleting a shared
record fails on a foreign key. So it replaces the conditions of the query with
the reference to the deleted records and marks that condition, instead of
keeping the relation conditions.

A query that relation code builds to select the records of another query must
copy the alias, schema, and scopes of that query along with its conditions.
Conditions can refer to the alias, which `chain` sets to the relation name, and
`withSchema`, `scope`, and `unscope` change which records the query targets.

Test `orWhere` with a record of another parent that matches it, for reads and
mutations, and check that the test fails without the marking. Test queries that
select the records of another query on a `chain` query, a query with `as`,
`withSchema`, an added scope, and a removed scope, and check that they select
neither more nor fewer records than that query.
