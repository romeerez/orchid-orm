# Adapters Guidance

## Transaction session context tests

After a transaction sets a custom setting, the connection that ran it reports
that setting as `''` rather than `NULL`. Assertions that a setting did not leak
out of a transaction must treat `''` and `NULL` as unset, because the pool may
run the follow-up query on that connection or on a fresh one.
