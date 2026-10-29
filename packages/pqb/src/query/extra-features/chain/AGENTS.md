# Chain Guidance

Conditions that `chain` builds refer to the alias of the query it chains to.
That alias is not fixed: `as` renames it, and a repeated relation gets a free
alias. So the relation aliases must be applied before the conditions are built,
and the alias the conditions were built with is recorded on the `EXISTS` to be
resolved to the current alias of the query when the SQL is built.

Test chains with a renamed alias and with a repeated relation, for reads and
mutations, and check they fail without the recording.
