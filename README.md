[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/banner2-direct.svg)](https://stand-with-ukraine.pp.ua)

# Orchid ORM

![tests](https://github.com/romeerez/orchid-orm/actions/workflows/test-and-release.yml/badge.svg)
![coverage](https://raw.githubusercontent.com/romeerez/orchid-orm/badges/coverage-badge.svg)
[![Discord](https://img.shields.io/discord/1072299783340953671)](https://discord.gg/95pa6FpBB9)

- 🚀️ productive way to work with models and relations
- 🧐️ full control over the database with powerful query builder
- 😎️ model schema can be converted to Zod for validations
- 🛳️ migration tools
- 💯 100% TypeScript, define a schema and everything else will be inferred

[Read the docs](https://orchid-orm.netlify.app/guide/).

If something is broken after an update, see [BREAKING CHANGES](./BREAKING_CHANGES.md) (if it's not in there, new issues are very welcome!).

## Packages

| Package                                                | Status (click for changelogs)                                                                                                                       | Installation                     | Documentation                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------- | ---------------------------------------------------------------------------------------- |
| [orchid-orm](packages/orm)                             | [![orchid-orm version](https://img.shields.io/npm/v/orchid-orm.svg?label=%20)](packages/orm/CHANGELOG.md)                                           | npm i orchid-orm                 | [ORM and query builder](https://orchid-orm.netlify.app/guide/orm-and-query-builder.html) |
| [pqb](packages/qb/pqb)                                 | [![pqb version](https://img.shields.io/npm/v/pqb.svg?label=%20)](packages/qb/pqb/CHANGELOG.md)                                                      | npm i pqb                        | [ORM and query builder](https://orchid-orm.netlify.app/guide/orm-and-query-builder.html) |
| [orchid-orm-schema-to-zod](packages/schemaConfigs/zod) | [![orchid-orm-schema-to-zod version](https://img.shields.io/npm/v/orchid-orm-schema-to-zod.svg?label=%20)](packages/schemaConfigs/zod/CHANGELOG.md) | npm i orchid-orm-schema-to-zod   | [Validation](https://orchid-orm.netlify.app/guide/columns-validation-methods.html)       |
| [orchid-orm-valibot](packages/schemaConfigs/valibot)   | [![orchid-orm-valibot version](https://img.shields.io/npm/v/orchid-orm-valibot.svg?label=%20)](packages/schemaConfigs/zod/CHANGELOG.md)             | npm i orchid-orm-valibot         | [Validation](https://orchid-orm.netlify.app/guide/columns-validation-methods.html)       |
| [rake-db](packages/rake-db)                            | [![rake-db version](https://img.shields.io/npm/v/rake-db.svg?label=%20)](packages/rake-db/CHANGELOG.md)                                             | npm i -D rake-db                 | [Migrations](https://orchid-orm.netlify.app/guide/migration-setup-and-overview.html)     |
| [orchid-orm-test-factory](packages/test-factory)       | [![orchid-orm-test-factory version](https://img.shields.io/npm/v/orchid-orm-test-factory.svg?label=%20)](packages/test-factory/CHANGELOG.md)        | npm i -D orchid-orm-test-factory | [Factories](https://orchid-orm.netlify.app/guide/orm-test-factories.html)                |

## Contribution

See [Contributing Guide](CONTRIBUTING.md).

## License

[MIT](LICENSE).
