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

Test `orWhere` with a record of another parent that matches it, for reads and
mutations, and check that the test fails without the marking.
