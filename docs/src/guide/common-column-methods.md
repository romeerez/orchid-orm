# Common column methods

All the following methods are available in any kind of column.

## primaryKey

[//]: # 'has JSDoc'

Mark the column as a primary key.
This column type becomes an argument of the [find](/guide/query-methods#find-and-findoptional) method.
So if the primary key is of `integer` type (`identity` or `serial`), [find](/guide/query-methods#find-and-findoptional) will accept the number,
or if the primary key is of `UUID` type, [find](/guide/query-methods#find-and-findoptional) will expect a string.

Using `primaryKey` on a `uuid` column will automatically add a [gen_random_uuid](https://www.postgresql.org/docs/current/functions-uuid.html) default.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.uuid().primaryKey(),
    // optionally, specify a database-level constraint name:
    id: t.uuid().primaryKey('primary_key_name'),
  }));
}

// primary key can be used by `find` later:
db.table.find('97ba9e78-7510-415a-9c03-23d440aec443');
```

## default

[//]: # 'has JSDoc'

Set a default value to a column. Columns that have defaults become optional when creating a record.

If you provide a value or a raw SQL, such default should be set on the column in migration to be applied on a database level.

Or you can specify a callback that returns a value.
This function will be called for each creating record. Such a default won't be applied to a database.
If the column has an encoding function (json, timestamp columns have it), it will be used to serialize the returned default value.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // values as defaults:
    int: t.integer().default(123),
    text: t.text().default('text'),

    // raw SQL default:
    timestamp: t.timestamp().default(t.sql`now()`),

    // runtime default, each new records gets a new random value:
    random: t.numeric().default(() => Math.random()),
  }));
}
```

## hasDefault

[//]: # 'has JSDoc'

Use `hasDefault` to let the column be omitted when creating records.

It's better to use [default](#default) instead so the value is explicit and serves as a hint.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    column: t.text().hasDefault(),
  }));
}
```

## nullable

[//]: # 'has JSDoc'

Use `nullable` to mark the column as nullable. By default, all columns are required.

Nullable columns are optional when creating records.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    name: t.integer().nullable(),
  }));
}
```

## identity

Available for `smallint`, `integer`, `bigint`.

It's almost identical to using `serial`, but `serial` is [officially discouraged](https://wiki.postgresql.org/wiki/Don%27t_Do_This#Don.27t_use_serial) by Postgres team,
and `identity` is suggested as a preferred autoincrementing type.

`t.identity()` is a shortcut for `t.integer().identity()`.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    small: t.smallint().identity(),
    int: t.identity(),
    alsoInt: t.integer().identity(),
    big: t.bigint().identity(),
  }));
}
```

Postgres supports identity kind `BY DEFAULT` and `ALWAYS`.
Identity `BY DEFAULT` is allowed to be set manually when creating and updating records, while `ALWAYS` is disallowed.

`Orchid ORM` decided to use `BY DEFAULT` by default in case you ever wish to set the id manually.

Supported options:

```ts
type IdentityOptions = {
  // false by default, set to true for GENERATE ALWAYS
  always?: boolean;

  // identity sequence options, check postgres docs for details:
  incrementBy?: number;
  startWith?: number;
  min?: number;
  max?: number;
  cache?: number;
  cycle?: boolean;
};
```

## readOnly

[//]: # 'has JSDoc'

Forbid the column to be used in [create](/guide/create-update-delete.html#create-insert) and [update](/guide/create-update-delete.html#update) methods.

`readOnly` column is still can be set from a [hook](/guide/hooks.html#set-values-before-create-or-update),
or in [setOnCreate](#setoncreate), [setOnUpdate](#setonupdate), [setOnSave](#setonsave).

`readOnly` column can be used together with a `default`.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    column: t.string().default(() => 'default value'),
    another: t.string().nullable().readOnly(),
  }));

  init(orm: typeof db) {
    this.beforeSave(({ columns, set }) => {
      if (columns.include('column')) {
        set({ another: 'value' });
      }
    });
  }
}

// later in the code
db.table.create({ column: 'value' }); // TS error, runtime error
```

## setOnCreate

[//]: # 'has JSDoc'

Set a column value when creating a record.
This works for [readOnly](#readonly) columns as well.

If no value or undefined is returned, the hook won't have any effect.

The callback accepts `columns` of type `string[]` that you can use to see what columns are being inserted or updated by the app code.

You can use `AsyncLocalStorage` to store values earlier in the app flow,
and use them in these hooks.
For this, see an example in [set values before create or update](/guide/hooks.html#set-values-before-create-or-update) section,
the same approach is also applicable with `setOnCreate`, `setOnUpdate`, `setOnSave`.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    some: t.number(),
    column: t
      .string()
      .setOnCreate(({ columns }) =>
        columns.include('some') ? 'value' : undefined,
      ),
  }));
}
```

## setOnUpdate

[//]: # 'has JSDoc'

Acts like `setOnCreate` but for updating a record.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    some: t.number(),
    column: t
      .string()
      .setOnUpdate(({ columns }) =>
        columns.include('some') ? 'value' : undefined,
      ),
  }));
}
```

## setOnSave

[//]: # 'has JSDoc'

Acts like `setOnCreate` but for both creating and updating a record.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    some: t.number(),
    column: t
      .string()
      .setOnSave(({ columns }) =>
        columns.include('some') ? 'value' : undefined,
      ),
  }));
}
```

## exclude from default select

[//]: # 'has JSDoc'

Append `select(false)` to a column to exclude it from the default selection.
It won't be selected with `selectAll` or `select('*')` as well.

```ts
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.string().select(false),
  }));
}

// only id and name are selected, without password
const user = await db.user.find(123);

// password is still omitted, even with the wildcard
const same = await db.user.find(123).select('*');

const comment = await db.comment.find(123).select({
  // password is omitted in the sub-selects as well
  author: (q) => q.author,
});

// password is omitted here as well
const created = await db.user.create(userData);
```

Such a column can only be selected explicitly.

```ts
const userWithPassword = await db.user.find(123).select('*', 'password');
```

## name

To specify a real name of column in a database:

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    nameInApp: t.name('name_in_database').integer(),
  }));
}
```

## encode

[//]: # 'has JSDoc'

Set a custom function to process value for the column when creating or updating a record.

The type of `input` argument will be used as the type of the column when creating and updating.

If you have a validation library [installed and configured](/guide/columns-validation-methods),
first argument is a schema to validate the input.

```ts
import { z } from 'zod';

export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // encode boolean, number, or string to text before saving
    column: t
      .string()
      // when having validation library, the first argument is a validation schema
      .encode(
        z.boolean().or(z.number()).or(z.string()),
        (input: boolean | number | string) => String(input),
      )
      // no schema argument otherwise
      .encode((input: boolean | number | string) => String(input)),
  }));
}

// numbers and booleans will be converted to a string:
await db.table.create({ column: 123 });
await db.table.create({ column: true });
await db.table.where({ column: 'true' }).update({ column: false });
```

## parse

[//]: # 'has JSDoc'

Set a custom function to process value after loading it from a database.

The type of input is the type of column before `.parse`, the resulting type will replace the type of column.

If you have a validation library [installed and configured](/guide/columns-validation-methods),
first argument is a schema for validating the output.

For handling `null` values use [parseNull](#parse-null) instead or in addition.

```ts
import { z } from 'zod';
import { number, integer } from 'valibot';

export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    columnZod: t
      .string()
      // when having validation library, the first argument is a schema
      .parse(z.number().int(), (input) => parseInt(input))
      // no schema argument otherwise
      .parse((input) => parseInt(input)),

    columnValibot: t
      .string()
      .parse(number([integer()]), (input) => parseInt(input))
      .parse((input) => parseInt(input)),
  }));
}

// column will be parsed to a number
const value: number = await db.table.get('column');
```

## parseNull

[//]: # 'has JSDoc'

Use `parseNull` to specify runtime defaults at selection time.

The `parseNull` function is only triggered for `nullable` columns.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    column: t
      .integer()
      .parse(String) // parse non-nulls to string
      .parseNull(() => false), // replace nulls with false
      .nullable(),
  }));
}

const record = await db.table.take()
record.column // can be a string or boolean, not null
```

If you have a validation library [installed and configured](/guide/columns-validation-methods),
first argument is a schema for validating the output.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    column: t
      .integer()
      .parse(z.string(), String) // parse non-nulls to string
      .parseNull(z.literal(false), () => false), // replace nulls with false
    .nullable(),
  }));
}

const record = await db.table.take()
record.column // can be a string or boolean, not null

Table.outputSchema().parse({
  column: false, // the schema expects strings or `false` literals, not nulls
})
```

## as

[//]: # 'has JSDoc'

This method changes a column type to treat one column as another column, this affects on available column operations in `where`.

Before calling `.as` need to use `.encode` with the input of the same type as the input of the target column,
and `.parse` which returns the correct type.

```ts
// column has the same type as t.integer()
const column = t
  .string()
  .encode((input: number) => input)
  .parse((text) => parseInt(text))
  // schema argument is required if you included a validation library
  .encode(z.number(), (input: number) => input)
  .parse(z.number(), (text) => parseInt(text))
  .as(t.integer());
```

## narrowType

[//]: # 'has JSDoc'

Narrows TypeScript types for a column.
For example, to narrow a `string` type to a union of string literals.

When _not_ integrating with [validation libraries](/guide/columns-validation-methods), `narrowType` has the following syntax:

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    size: t.string().narrowType((t) =>
      t<{
        // what types are accepted when creating/updating
        input: 'small' | 'medium' | 'large';
        // how types are retured from a database
        output: 'small' | 'medium' | 'large';
        // what types the column accepts in `where` and similar
        query: 'small' | 'medium' | 'large';
      }>(),
    ),
  }));
}

// size will be typed as 'small' | 'medium' | 'large'
const size = await db.table.get('size');
```

- `input` is for `create`, `update` methods.
- `output` is for the data that is loaded from a database and parsed if the column has `parse`.
- `query` is used in `where` and other query methods, it should be compatible with the actual database column type.

When integrating with a [validation library](/guide/columns-validation-methods), also provide validation schemas:

```ts
const sizeSchema = z.union([
  z.literal('small'),
  z.literal('medium'),
  z.literal('large'),
]);

export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    size: t.text().narrowType({
      input: sizeSchema,
      output: sizeSchema,
      query: sizeSchema,
    }),
  }));
}

// size will be typed as 'small' | 'medium' | 'large'
const size = await db.table.get('size');
```

## timestamps

Adds `createdAt` and `updatedAt` columns of type `timestamp` (with time zone) with default SQL `now()`.

Timestamp with timezone is preferred over the one without time zone because it's suggested so [by Postgres docs](https://wiki.postgresql.org/wiki/Don%27t_Do_This#Don.27t_use_timestamp_.28without_time_zone.29).

The `timestamps` function is using `timestamp` internally. If `timestamp` is overridden to be parsed into `Date`, so will do `timestamps`.

`updatedAt` adds a hook to refresh its date on every `update` query, unless you set `updatedAt` explicitly when updating a record.

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    ...t.timestamps(),
  }));
}
```

Customizing columns names is possible in a such way:

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    // `created` will be also used to refer to this column in SQL
    created: t.timestamps().createdAt,
    updated: t.timestamps().updatedAt,
  }));
}
```

## timestampsNoTZ

The same as `timestamps`, but without a time zone.

## modifyQuery

Specify a callback that can modify a table class.

When mutating a query in this callback, the changes will be applied to all future queries of this table.

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    name: t.string().modifyQuery((table, column) => {
      // table argument is the query interface of SomeTable
      // column object contains data with column name and other properties
    }),
  }));
}
```

## methods for migration

Column methods such as [foreignKey](/guide/migration-column-methods#foreignkey), [index](/guide/migration-column-methods#index), [exclude](/guide/migration-column-methods#exclude), [unique](/guide/migration-column-methods#unique), [comment](/guide/migration-column-methods#comment) and others have effects only when used in migrations, read more about it in [migration column methods](/guide/migration-column-methods) document.

Though `unique` is used for deriving types for [findBy](/guide/query-methods#findBy) and [onConflict](/guide/create-update-delete#onconflict).
