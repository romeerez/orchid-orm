## rake-db structure

Change all to kebab

```md
You said

how would you propose to structure my library in a feature-based fashion:

- currently, at top level of src I have common files with utilities and types, a file that's an exported factory of the lib instance, index file to export functions.

- my library can be used as a cli, so I have src/cli folder with commands, where a command does has own logic and also orchestrates functions of the lib from features. Though I guess each command could be placed to an existing feature folder or a separate feature folder could be created for a command. Also this src/cli has a flie with main logic of a CLI program to route commands, print help.

- I have a separate flat folder with feature-files.

- And I have two separate "sub-domains" folders: each of them is a large feature consisting of many files and doing various things in a scope of that larger feature.

src/
├── core/ # The "Library Factory" & Shared Logic
│ ├── factory.ts # Your exported factory
│ ├── constants.ts
│ └── types.ts # Global types only
├── common/ # Truly agnostic utilities (string utils, etc.)
│ └── utils/
├── features/ # High-level domain features
│ ├── likes/
│ │ ├── likes.spec.md # The "Source of Truth" for AI
│ │ ├── api.ts # Public programmatic interface
│ │ ├── logic.ts # Business rules
│ │ ├── db.ts # Data persistence
│ │ └── cli/ # CLI commands specific to "Likes"
│ │ └── like-post.command.ts
│ └── [sub-domain-a]/ # Your larger sub-domains become top-level features
│ ├── sub-feature-x/
│ └── sub-feature-y/
├── cli/ # CLI Bootstrapper (Orchestration only)
│ ├── main.ts # Routing, help, and global CLI config
│ └── registry.ts # Imports commands from feature folders
└── index.ts # Main entry point (exports from core + features)
```

Codex:

```md
Analyze structure in rake-db/src. Propose a feature-based structure.
The goal is to have a structure where AI can clearly see what features exist, and later to place _feature_.spec.md to feature-folders.

Hints on the library and on the existing structure:

This is a library for db migrations. It has both a CLI program and it exposes a programmatic API.

`adapters` are wrappers on top of node-postgres and porsager/postgres, user can import either of them and configure the CLI or API of this lib using them.

`cli/rake-db.cli` is the main file of a CLI that routes commands, does some plumbing.
`cli` also has `database` file and `migration` file: these are basically adapters for CLI usage around corresponding functionality in the `commands` folder.

`commands` folder contains different functionalities of the library: create or drop db, migrate or rollback, save a new migration, list statuses, etc.

`generate` folder is for generating migrations based on DB introspection. It's quite large and complex, consists of different parts.

`migration` folder is the most complex feature, it's structured somewhat messy,

- `change` is a DSL-like function for user to wrap their migrations to indicate that this change is needed.
- `change-table` focuses on everything that can be altered in a table
- `create-table` focuses on everything that can be created, related to a table, such as indexes, fkeys, and more.
- `create-view` is about creating and dropping db views.
- `manage-migrated-versions` it's about reading, storing, comparing the list of already migrated migrations against available.
- `migration.utils` - utils are mostly for composing data structures in migration logic, may contain SQL generating snippets, and such, it's reused by `create-table` and files like that.
- `migrations-set` is an abstraction around user-provided list of available migrations.
- `role` is for managing db roles via migrations
- `table-methods` is a mixin to override column type abstractions in migrations.

You see, the problem with `migration` folder is that the files here fall into different categories, some of them are higher in a conceptual hierarchy then the others, and it's just brought into a flat folder.

In `src` I have common files: `ast` is used in `generate` and `migrate` folder logic. `common` is apparently common. `config.ts` - many different files rely on it. `errors.ts`, `prompt.ts`, `utils.ts` are reusable as well. `prompt.ts` here is a function to prompt a user with a question - I'm not sure if this falls under utilities category, or feature category, it's not a useful feature that library provides to users, but it's a feature needed by other features.
```

Codex structure:

```
src/
  index.ts
  adapters/
    node-postgres.ts
    postgres-js.ts

  features/
    database/
      feature.spec.md
      cli.ts
      create-or-drop.ts

    migration-authoring/
      feature.spec.md
      api.ts
      new-migration.ts
      change.ts
      migration-interface.ts
      dsl/
        create-table.ts
        change-table.ts
        create-view.ts
        role.ts
        table-methods.ts
        sql.ts

    migration-execution/
      feature.spec.md
      api.ts
      cli.ts
      migrate-or-rollback.ts
      recurrent.ts
      status.ts
      versions/
        migrated-versions.ts
        migrations-set.ts

    migration-maintenance/
      feature.spec.md
      cli.ts
      rebase.ts
      change-ids.ts

    schema-pull/
      feature.spec.md
      api.ts
      cli.ts
      pull.ts
      introspection/
        db-structure.ts
      transform/
        structure-to-ast.ts
        ast-to-generate-items.ts
        ast-to-migration.ts

  platform/
    config/
      config.ts
    schema-model/
      ast.ts
    cli-ui/
      prompt.ts
    errors/
      errors.ts
    db/
      transactions.ts
    naming/
      naming.ts
```

Problems with the proposed:

- files that have a semantic extension like `.cli.` or `.api`. should be named after a feature, it's for descriptive names in editor tabs, and can be easier to navigate the project. Also for AI I guess it's better if file name already contains "what is it".
- consider `database/`: what is exposed via `api`? Currently `create-or-drop.ts` exports logic for "database", so does `api` work

TODO!!!
I need to decide on making dependencies.

Important thought: concept of **domains** and **sub-domains**.

**asked**:

```md
I realized that `features/` folder is not enough.
We need _Domains_ and _Sub-Domains_, where _Sub-Domains_ can be nested if needed.

Domains should not depend on each other.
Sub domains ideally shouldn't depend but can if really needed.
Higher-level can depend on lower level, not vice-versa (apart from common files ofc). Here I mean that topper-level files can depend on nested files, and they should _try_ to not depend on neighbours.

Domains include:

- All files in "commands": all that use see in the existing commands/ folder are independent commands. It means useful actions provided by the lib for users. They don't depend on each other.
- "generate": this is a domain of code generation, it's complex, but all parts conform to the code gen idea.
- "migration": it's also provides a "command" for a user to execute pending migrations.

Sub-domains:

- "commands" folder files are simple enough to not need any sub domains
- "generate": I think it's fine to be flat as well.
- "migration": here is the complex part, I'm not sure how to structure it best. It contains sub-concepts:
  - `migration.ts` exposes a DSL-like functionality like `createTable` but it doesn't implement it, only collects such functions for the user. And also it constructs what's needed - a common state object - for those functions to work. I think it should be top-level in this domain.
  - `change.ts` is closely related to `migration.ts`, I think it should be on top-level as well.
  - `migrate-or-rollback` command should fall into this domain, it has "command" functions to run migrations, those functions are orchestrating execution. I think it should be top-level in this domain.
  - `manage-migrated-versions` works with the db state of applied migrations.
  - `migrations-set` works with a list of migrations provided by a user - available migrations. This concept is related to the previos, but I'm not sure what the name of their common sub-domain could be. They both feel lower-level than `migration.ts` and `migrate-or-tollback`.
  - all the rest of the files in `migration` are implementing specific actions with db objects: create-table, change-table, table-methods are related to tables, role.ts to db roles, and such. Table-related files should be grouped into `tables`, view related files should be grouped into `views`, role.ts alone should also be in `role/`. You'll have multiple folders this way. Perhaps those folders could be combined in a sub-domain folder `manage-db-entities`. If you can come up with a better name for functionality that creates, alters tables, indexes, foreign keys, please go ahead.

Don't name files like `api.ts` - file name should always tell what is it for semantically, not just role.
```

**answer**:

```md
Your constraint changes the shape in an important way: this should not be “features + shared code”, it should be a **dependency-oriented domain tree**.
With your rules, I’d use this mental model:

• Domain = a user-meaningful capability area with no dependency on sibling domains
• Sub-domain = an internal concept inside a domain
• Top-level files in a domain = orchestration or public surface of that domain
• Nested files/folders = lower-level concepts used by that domain

Cross-domain sharing goes only through a small common/platform area
For rake-db/src, that suggests this direction:
src/
adapters/
node-postgres.ts
postgres-js.ts

common/
ast.ts
config.ts
errors.ts
prompt.ts
common.ts
utils.ts

commands/
create-or-drop.ts
new-migration.ts
list-migrations-statuses.ts
recurrent.ts
rebase.ts
change-ids.ts

generate/
db-structure.ts
structure-to-ast.ts
ast-to-generate-items.ts
ast-to-migration.ts
pull.ts

migration/
change.ts
migration.ts
migrate-or-rollback.ts

    migration-state/
      manage-migrated-versions.ts
      migrations-set.ts

    schema-operations/
      tables/
        create-table.ts
        change-table.ts
        table-methods.ts
        table-utils.ts

      views/
        create-view.ts

      roles/
        role.ts

I would also move:
• commands/migrate-or-rollback.ts -> migration/migrate-or-rollback.ts
• migration/migration.utils.ts -> a semantic name under schema-operations/tables, unless after splitting it clearly contains mixed concerns

Why this works:
•commands stays a domain of independent user actions, exactly as you described
•generate stays flat because it is cohesive and already reads as one concept
•migration becomes one domain with clear layering:
◦top level: public migration model and execution orchestration
◦migration-state: available migrations and applied migrations
◦schema-operations: implementation details for DB object manipulation
◦deeper nesting by entity kind: tables, views, roles
I would avoid manage-db-entities as a name. It is accurate, but vague. schema-operations is shorter and closer to what these files actually do: they define and mutate schema objects during migrations.
For the ambiguous pair:
•manage-migrated-versions
•migrations-set
Their common concept is not “entities”, it is migration state. One is “applied state in DB”, the other is “available state from user input/files”. So migration-state/ is a strong name.
I’d also tighten common/. Right now it is too broad. Long term, I’d aim for:
common/
config.ts
errors.ts
prompt.ts
ast.ts
db.ts
naming.ts
paths.ts
That said, if you’re only restructuring one area now, leaving common.ts and utils.ts temporarily is reasonable.
For feature.spec.md, in your model I would place them on domains and meaningful sub-domains, not every folder:
•commands/commands.spec.md only if you want one spec for the domain as a whole
•generate/generate.spec.md
•migration/migration.spec.md
•migration/migration-state/migration-state.spec.md
•migration/schema-operations/tables/tables.spec.md
•migration/schema-operations/views/views.spec.md
•migration/schema-operations/roles/roles.spec.md
I would not put spec files into folders that are just technical leftovers.
One caution: if commands/rebase.ts or commands/change-ids.ts depend on migration internals, that is acceptable only if commands is treated as a domain of leaf actions that may depend downward on lower-level domains. If you want strict “domains never depend on each other”, then those two actually belong under migration/, because they are migration-maintenance commands, not generic commands.
The cleanest version under your rules is actually this:
src/
common/
adapters/
commands/
create-or-drop.ts
new-migration.ts
generate/
...
migration/
change.ts
migration.ts
migrate-or-rollback.ts
list-migrations-statuses.ts
recurrent.ts
rebase.ts
change-ids.ts
migration-state/
schema-operations/
That version is more consistent because migration-related commands stay inside the migration domain.
If you want, I can next produce a strict proposed tree with every current file mapped to its target path and a brief rationale for each move.
```

Semantics should affect the structure, not "if this depends on that, we place it here". We place it here only if it semantically makes sense to keep here.
`schema-operations` has a downside that I also use `schema` word to refer to db schemas like "public", and there is a capability to manage those schemas.
Show where you'd place the lib public interface factories: rake-db.cli.ts, rake-db.lib.ts.

Let's try a feature-based again.

Goal: when adding support for a new db entity, for example, we want to add management for a db procedure, the changes should be made only withing a new feature folder.
It'd be in a folder "procedures". This folder contains:

- functionality for code generator (currently that's in "generate")
- functionality like `create-table` but for procedures - used when executing migrations.
- ast types

Name all files with suffixes, where the name tells about semantics, I think a feature name is good for that in general, and suffix helps to determine what's it doing technically.

Perhaps:

- `procedure.code-gen.ts`
- `procedure.migration.ts`
- `procedure.ast.ts`

**answer**

```md
src/
adapters/

common/
config.ts
errors.ts
prompt.ts
paths.ts
naming.ts
db.ts

ast/
migration.ast.ts

cli/
rake-db.cli.ts
migrate.cli.ts
database.cli.ts

api/
rake-db.lib.ts
index.ts

features/
databases/
database.command.ts

    migrations/
      migration.feature.ts
      migration.change.ts
      migration.runner.ts
      migration-set.state.ts
      migrated-versions.state.ts
      migration-status.command.ts
      recurrent.command.ts
      rebase.command.ts
      change-ids.command.ts
      new-migration.command.ts

    tables/
      table.feature.ts
      table.ast.ts
      table.migration.ts
      table.code-gen.ts
      table.utils.ts
      table-methods.ts
      create-table.migration.ts
      change-table.migration.ts

    views/
      view.feature.ts
      view.ast.ts
      view.migration.ts
      view.code-gen.ts
      create-view.migration.ts

    roles/
      role.feature.ts
      role.ast.ts
      role.migration.ts
      role.code-gen.ts

    schemas/
      schema.feature.ts
      schema.ast.ts
      schema.migration.ts
      schema.code-gen.ts

    procedures/
      procedure.feature.ts
      procedure.ast.ts
      procedure.migration.ts
      procedure.code-gen.ts
```

Let's avoid features/ as you proposed.

Let rake-db.cli and rake-db.lib and index be in the src/ root.
migrate.cli belongs to migrations/.
database.cli belongs to databases/.

In migrations/:

- the existing `migration.ts` file: not 99% sure but let's rename it to `migrations.api.ts`
- instead of a .change file, let's rename the currenly existing `change.ts` to `change-fn.api.ts`
- remove .runner
- existing `migrate-or-rollback`: let's call it `migrate.command.ts`.
- I don't like .state prefix because that's not really a state
- `migrations-set` let's call it `migration-files` but I'm not sure about the suffix, it's not really state - won't change. These are utilities for getting a list of files, it doesn't change during the execution. Let's suffix it as repo? Open to suggestions.
- `migrated-versions` could be `.repo` as well.
- your proposed commands files are good here.

`feature` files: let's drop them entirely.
I considered having entry files per feature, and it seems to be more churn than benefit.

table-methods - let's rename to columns-overrides, let's suffix it with `mixin`.

remove `create-` prefixes.

**I like this structure**:

```
src/
  index.ts
  rake-db.cli.ts
  rake-db.lib.ts

  adapters/

  common/
    ast.ts
    config.ts
    errors.ts
    prompt.ts
    common.ts
    utils.ts

  databases/
    database.cli.ts
    database.command.ts

  migrations/
    migrations.api.ts
    change-fn.api.ts
    migrate.cli.ts
    migrate.command.ts
    migration-files.repo.ts
    migrated-versions.repo.ts
    migration-status.command.ts
    recurrent.command.ts
    rebase.command.ts
    change-ids.command.ts
    new-migration.command.ts

  tables/
    table.ast.ts
    table.code-gen.ts
    table.migration.ts
    table.utils.ts
    columns-overrides.mixin.ts
    table-create.migration.ts
    table-change.migration.ts

  views/
    view.ast.ts
    view.code-gen.ts
    view.migration.ts

  roles/
    role.ast.ts
    role.code-gen.ts
    role.migration.ts

  schemas/
    schema.ast.ts
    schema.code-gen.ts
    schema.migration.ts
```
