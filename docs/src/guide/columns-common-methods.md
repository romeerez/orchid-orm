# Common column methods

All the following methods are available in any kind of column.

## primaryKey

Mark the column as a primary key.
This column type becomes an argument of the `.find` method.
So if the primary key is of `integer` type (`identity` or `serial`), `.find` will accept the number,
or if the primary key is of `UUID` type, `.find` will expect a string.

Using `primaryKey` on a `uuid` column will automatically add a [gen_random_uuid](https://www.postgresql.org/docs/current/functions-uuid.html) default.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    id: t.uuid().primaryKey(),
  }));
}

// primary key can be used by `find` later:
db.table.find('97ba9e78-7510-415a-9c03-23d440aec443');
```

## default

Set a default value to a column. Columns that have defaults become optional when creating a record.

If you provide a value or a raw SQL, such default should be set on the column in migration to be applied on a database level.

Or you can specify a callback that returns a value. This function will be called for each creating record. Such a default won't be applied to a database.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // values as defaults:
    int: t.integer().default(123),
    text: t.text().default('text'),

    // raw SQL default:
    timestamp: t.timestamp().default(t.raw('now()')),

    // runtime default, each new records gets a new random value:
    random: t.numeric().default(() => Math.random()),
  }));
}
```

## nullable

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

Set a custom function to process value for the column when creating or updating a record.

The type of `input` argument will be used as the type of the column when creating and updating.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // encode boolean, number, or string to text before saving
    column: t
      .text(3, 100)
      .encode((input: boolean | number | string) => String(input)),
  }));
}

// numbers and booleans will be converted to a string:
await db.table.create({ column: 123 });
await db.table.create({ column: true });
await db.table.where({ column: 'true' }).update({ column: false });
```

## parse

Set a custom function to process value when loading it from a database.

The type of input is the type of column before `.parse`, the resulting type will replace the type of column.

```ts
export class Table extends BaseTable {
  readonly table = 'table';
  columns = this.setColumns((t) => ({
    // parse text to integer
    column: t.text(3, 100).parse((input) => parseInt(input)),
  }));
}

// column will be parsed to a number
const value: number = await db.table.get('column');
```

## as

This method changes a column type without modifying its behavior.
This is needed when converting columns to a validation schema, the converter will pick a different type specified by `.as`.

Before calling `.as` need to use `.encode` with the input of the same type as the input of the target column,
and `.parse` which returns the correct type.

```ts
// column has the same type as t.integer()
const column = t
  .text(1, 100)
  .encode((input: number) => input)
  .parse((text) => parseInt(text))
  .as(t.integer());
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

## modifyQuery

Specify a callback that can modify a table class.

When mutating a query in this callback, the changes will be applied to all future queries of this table.

```ts
export class SomeTable extends BaseTable {
  readonly table = 'someTable';
  columns = this.setColumns((t) => ({
    name: t.text(3, 100).modifyQuery((table) => {
      // table argument is the query interface of SomeTable
    }),
  }));
}
```

## methods for migration

Column methods such as `foreignKey`, `index`, `unique`, `comment` and others have effects only when used in migrations, read more about it in [migration column methods](/guide/migration-column-methods) document.

## hidden

::: danger
This feature is in a draft state
:::

Remove the column from the default selection. For example, the password of the user may be marked as hidden, and then this column won't load by default, only when specifically listed in `.select`.
