# Join Guidance

Resolve correlated references in the scope of the referenced query. Preserve
local aliases when resolving an outer query alias, and keep reusable query
data unchanged during SQL generation.

Test alias resolution with both renamed and unchanged outer queries. Include
repeated relations and verify that rendering a renamed query does not affect
the source query.

Merge scalar relation selections into a shared lateral join only when the SQL
outside the selection and its parameter values match. Compare parameter values
deeply with their types preserved, including parameters in nested subqueries;
do not use JSON serialization as an equality key.

Keep regression coverage in `deduplicating-joins.test.ts`. Check generated SQL,
bound parameters, and returned values for different relation filters. Include
an A/B/A filter sequence to verify that matching queries still share a join
after a different parameter variant, and distinct instances of equal compound
parameters to verify value comparison.
