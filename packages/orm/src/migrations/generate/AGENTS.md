# Migration Generation Guidance

## Decisions

Whenever a generator cannot decide on its own (create or rename an item, add or
rename an enum value, recreate a column with an incompatible type), it asks the
migration decider instead of prompting directly, so that every way of
answering, interactive or not, plugs in at one place.

Questions identify items by database names, never by code keys or display
names, so that an answer prepared in advance keeps referring to the same items
whatever the other answers are: the source by its name in the database before
any changes, the target by the name the code gives it in the database.
Generators change `dbStructure` items in place (a schema rename rewrites
`schemaName` of the tables, enums, and most other items in it), so take sources
from `dbSource`, never from an item's current fields.

Before writing a migration, the generator verifies it: applies it in a
transaction that is rolled back afterwards, and generates again against the
resulting database, expecting no changes. With the migration applied there is
nothing left to decide, so any question means the migration is incomplete.
Verification aborts on the first question instead of asking it, and must never
reuse the answers given for the migration, as that would hide the
incompleteness.

## Answers without a terminal

Without a terminal or with `--non-interactive`, the generator does not ask.
It answers the questions that have no given answer provisionally, as if the
item is created or the column recreated, to collect as many questions as one
run can; answering them can bring up further questions in the next run. When a
question is left unanswered or an answer does not fit its question, the run
must not verify, write, or apply the migration.

A rename that matched no question is an error once no questions are left, so
that an intended rename is never silently ignored. Before that, it may still
match a question that comes up after other answers. A create or recreate answer
that matched no question changes nothing and is not an error: for example,
there is no question about creating an item when another answer renames the
last candidate.

The command lists the flags to answer each question, and these flags must read
back as the same answers, including names that need quoting.

## Tests

Generator tests answer questions by mocking `promptSelect` with option indexes
(`selects` in `arrange`), covering the interactive decider together with the
generator. The test utils make stdin look like a terminal for that; to test
answering without a terminal, pass `--non-interactive` to `act` or set
`process.stdin.isTTY` to `false`. To test what a question contains, spy on the
interactive decider and capture the question when it is asked, because
generators change the candidate lists after the answer.
