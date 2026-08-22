# PQB Package Guidance

## Query return-mode boundaries

Terminal scalar and pluck methods must discard inherited `batchParsers` before
building their scalar selection. This prevents parsers from a prior nested
relation selection from treating the terminal result as a relation result.

Deduplicated relation-value selections resolve their logical aliases through
`valuesJoinedAs`; their scalar parser is under `joinedParsers[alias].v`.
String-selection parser setup must resolve this centrally so terminal scalar
methods and chained `.select()` calls preserve native result types.

Regression coverage belongs in the corresponding focused query tests and
should exercise a query with a taken relation selected before `pluck`, `get`,
or `getOptional`.

## Column type narrowing

`narrowType` is the supported API for narrowing a column's compatible
input, output, and query TypeScript types together. It does not configure a
PostgreSQL custom type; that separate concern belongs to `t.type(name)`.
