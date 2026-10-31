# Join Guidance

Resolve correlated references in the scope of the referenced query. Preserve
local aliases when resolving an outer query alias, and keep reusable query
data unchanged during SQL generation.

Test alias resolution with both renamed and unchanged outer queries. Include
repeated relations and verify that rendering a renamed query does not affect
the source query.
