# Contributing

## Clone the project

```sh
git clone https://github.com/romeerez/orchid-orm.git
cd orchid-orm
```

## Updating documentation

If you only wish to enhance the docs, there is no need to set up monorepo, head directly to the [docs README.md](./docs/README.md).

## Development setup

It's being developed with node.js v18, but other versions should work fine as well.

```sh
# enable corepack
corepack enable

# if not using corepack, install pnpm manually
npm i -g pnpm@9

# install deps
pnpm i
```

Minimal Postgres version for all tests to pass is 15, install it on your machine, or run it with docker:

```sh
# start postgres
docker compose -f docker-compose.pg.yml up -d
# stop it later
docker compose -f docker-compose.pg.yml down
```

MySQL is optional, you can develop everything without it, except only for a `myqb` package. MySQL can be started with docker as well:

```sh
# start postgres
docker compose -f docker-compose.mysql.yml up -d
# stop it later
docker compose -f docker-compose.mysql.yml down
```

Copy `.env.example` to `.env` and change the database URLs in it. Leave it unchanged if you're running a database with Docker.

`PG_URL` will have tables for testing.
`PG_GENERATE_URL` is for testing code generator, won't have tables.

Create a database, unless running it with the Docker, with a command:

```sh
pnpm db create
```

Apply db migrations with command:

```sh
pnpm db migrate
```

Run all tests in every package (`myqb` will fail without running MySQL):

```sh
pnpm check
```

Check for types correctness with the command:

```sh
pnpm types
```

To run the `check` or `types` only for a specific package, add a package dir name before the command:

```sh
# run tests only for pqb
pnpm pqb check
# run tests only for orchid-orm
pnpm orm check
# check types only in rake-db
pnpm rake-db types
```

When working on some feature or fixing some bug, add `it.only` to some test and run tests for a specific file in a watch mode with the command:

```sh
# run tests in a watch mode for the select.test.ts file of pqb
pnpm pqb t select.test
# run tests in a watch mode for the belongsTo.test.ts file of pqb
pnpm orm t belongsTo.test
```

## VSCode Dev Container setup

For an isolated dev environment that automatically starts Postgres on launch for you:

1. `F1` in VSCode and start typing `Dev Containers: Clone Repository in Named Container Volume` to run the command.
2. For the repo, paste `git@github.com:romeerez/orchid-orm.git` if you're using ssh.
3. Click `Create a new volume...` and name it `orchid` and the folder name as `orchid`.

This will also start a PGAdmin4 process, access it by visiting http://localhost:5433/.

Note: if you can't see `Dev Containers` in the `F1` menu, follow [this guide](https://code.visualstudio.com/docs/devcontainers/tutorial) to install the needed extension.
In the OSS version of VSCode the extension may be not available.

## Committing changes

Run `pnpm changeset` to choose packages to add a changelog to:

```sh
pnpm changeset
```

It will ask to select packages for `major`, `minor`, and `patch` changes.
Hit enter twice to skip `major` and `minor`, as usually we do small changes, hit `space` to select all modified packages for a patch change,
and enter a changelog message.

This message can be edited later in the `.changeset` file.

Briefly describe what this change is about, add `(#123)` GitHub issue number to it.

Now add stage all changed files with `git add .`, commit with the same message, `(#123)` GitHub issue number is better to be included here as well.
