Apply these rules only when writing tests inside `packages/orm/src/migrations/generate/generators/`.

Treat every rule in this file as mandatory for every database-entity generator test change in that directory.

- `never`, `do not`, `must`, and the ordered checks below are hard stops.
- There are no exceptions for private, internal, helper-only, temporary, or one-file-local tests.

## Cover every migration outcome

Database-entity generator tests must verify each supported outcome through the generator's public test helpers.

Every test must assert the report with `assert.report`, and the report expectation must verify that the generated message is correct for the scenario.

For each database entity handled by a generator, cover these cases:

1. Created when the entity is absent from the database and present in code.
   Use all supported properties for that entity, not minimal options.

2. Dropped when the entity is present in the database and absent from code.
   Use all supported properties for that entity.

3. Changed when the entity exists in both the database and code but has differences.
   Use all supported properties for that entity. If direct alteration is supported, assert the alteration migration. If direct alteration is not supported, assert that the entity is recreated.

4. Renamed when the feature supports renaming and only the name changes.
   Assert that the migration emits rename code. This case does not need to use all supported properties. Do not add this case for features that do not support renaming, such as views.

5. Unchanged when the entity exists in both the database and code and is identical.
   Use all supported properties for that entity. Assert an empty `assert.migration()` to confirm no migration is generated.

6. Ignored when the feature is supported by `generatorIgnore`.
   Assert that the entity is properly ignored. This case does not need to use all supported properties.

7. Ignored by every supported `generatorIgnore` matcher form.
   If `generatorIgnore` supports arrays for this feature, test arrays. If it supports regular expressions, test regular expressions. These cases do not need to use all supported properties.
