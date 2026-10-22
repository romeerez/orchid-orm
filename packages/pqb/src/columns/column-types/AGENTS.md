# Column type contracts

Custom PostgreSQL types and domains have an unknown raw representation, but
non-nullable columns must exclude null from the parser's input type. Keep their
input, unparsed output, and query types unknown; do not use `never` for the raw
representation, because parser callbacks may return their input.

Type regressions should cover parsing before and after `nullable()`, `parseNull`
on nullable and non-nullable columns, and domain inheritance. Check query result
types as well as parser callback inference.
