# Column references

When rendering column references, quote each identifier component with
`quoteIdentifier`, including unknown columns, mapped database names,
qualifiers, and output aliases. Treat `quotedAs` as already quoted SQL; do not
quote it again. Preserve column mapping, computed expressions, and wildcard
semantics when changing column rendering.

Exercise shared column rendering through public query methods with `toSQL()`
and `expectSql`, without `useTestDatabase()`. Cover embedded double quotes in
known and unknown columns and in both parts of qualified references, together
with selection aliases and mapped names.
