---
outline: deep
---

# Computed columns

OrchidORM supports defining columns that are calculated on the fly,
either by injecting SQL into a `SELECT` statement, or by computing values in runtime on JS side.

Note that unlike regular columns, computed columns are not selected by default.

Alternatively, you can add a generated column in the migration (see [generated](/guide/migration-column-methods#generated-column)),
such column will persist in the database.

## SQL computed column

SQL computed column is going to unwrap into the given SQL when selecting it from the table.

In the following example, selecting `fullName` will unwrap into `"firstName" || ' ' || "lastName"` SQL:

```ts
import { BaseTable, sql } from './baseTable';

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    firstName: t.string(),
    lastName: t.string(),
  }));

  computed = this.setComputed((q) => ({
    fullName: sql`${q.column('firstName')} || ' ' || ${q.column(
      'lastName',
    )}`.type((t) => t.string()),
    randomizedName: sql(
      () => sql`${Math.random()} ${q.column('firstName')}`,
    ).type((t) => t.string()),
  }));
}
```

`randomizedName` in the example is defined with `` sql(() => sql`...`) `` syntax that makes it dynamic,
so that a new random value will be selected for every query.

Such can be column can be selected, can be used for filtering and ordering, available in nested sub-queries.

```ts
// select all columns + the computed
db.user.select('*', 'fullName')

// use in nested select
db.chat.find(id).select({
  messages: (q) => q.messages.select({
    // select fullName for a single row
    sender: (q) => q.sender.select('fullName')
    // `pluck` will load a flat array of values
    receipients: (q) =>
      q.receipients
        .pluck('fullName')
        // works for filtering
        .where({ fullName: { startsWith: 'x' } })
        // works for ordering
        .order('fullName'),
  })
})

// can be selected for a joined table
db.post.join('author').select('author.fullName')

// can be returned from `insert`, `create`, `update`, `delete`, `upsert`
db.user.select('fullName').insert(data)
```

### Reuse SQL computed

You can reuse a SQL computed column in a definition of a new SQL computed column
by defining the new one as a function and referencing the other column by `this.columnName`.

```ts
import { BaseTable, sql } from './baseTable';

export class MyTable extends BaseTable {
  // ...snip
  computed = this.setComputed((q) => ({
    hello: sql`'hello'`.type((t) => t.string()),
    // can be "dynamic", the callback is executed for every query.
    world: sql(() => sql`'world'`.type((t) => t.string())),
    // reuse `hello` and `world` to define a new SQL computed column:
    greet() {
      return sql`${this.one} || ' ' || ${this.two} || '!'`.type(() =>
        t.string(),
      );
    },
  }));
}
```

## JS runtime computed

Define a runtime computed column to compute values after loading results.

Unlike SQL computed columns, these columns aren't suitable for filtering or ordering records, they only can be used in selects.

```ts
export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    firstName: t.string(),
    lastName: t.string(),
  }));

  computed = this.setComputed((q) => ({
    fullName: q.computeAtRuntime(
      // define columns that it depends on
      ['firstName', 'lastName'],
      // only columns defined above are available in the callback
      (record) => `${record.firstName} ${record.lastName}`,
    ),
  }));
}
```

The runtime computed column is available in all kinds of selections.

It will automatically select dependencies, if they weren't selected,
and will dispose dependencies after computing a value if they weren't selected.

```ts
const record = await db.user.select('firstName', 'fullName');
record.firstName; // was selected
record.fullName; // was computed
record.lastName; // TS error: it was selected but then disposed

db.char.find(id).select({
  messages: (q) => q.messages.select({
    // select fullName for a single row
    sender: (q) => q.sender.select('fullName')
    // `pluck` will collect a flat array of values
    receipients: (q) => q.receipients.pluck('fullName')
  })
})

// can be selected for a joined table
db.post.join('author').select('author.fullName')

// can be returned from `insert`, `create`, `update`, `delete`, `upsert`
db.user.select('fullName').insert(data)
```

## Async computed columns

Asynchronously fetching data for records one-by-one would take a lot of loading time,
it's much better to load data in batches.

```ts
interface WeatherData {
  country: string;
  city: string;
  weatherInfo: SomeStructure;
}

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    country: t.string(),
    city: t.string(),
  }));

  computed = this.setComputed((q) => ({
    weather: q.computeBatchAtRuntime(
      // define columns that it depends on
      ['country', 'city'],
      // load weather data for all users using a single fetch
      async (users): Promise<(SomeStructure | undefined)[]> => {
        // to not query the same location twice
        const uniqueLocations = new Set(
          users.map((user) => `${user.country} ${user.city}`),
        );

        // fetch data for all locations at once
        const weatherData: WeatherData[] = await fetchWeatherData({
          location: [...uniqueLocations],
        });

        // return array with weather data for every user
        return users.map(
          (user) =>
            weatherData.find(
              (wd) => wd.country === user.country && wd.city === user.city,
            )?.weatherInfo,
        );
      },
    ),
  }));
}
```

`computeBatchAtRuntime` can also take a synchronous function.

From a querying perspective, there is no difference from a [computeAtRuntime](#js-runtime-computed) column,
it works and acts in the same way.

```ts
db.user.select('*', 'weather');

// a city can have millions of people,
// but the weather is loaded just once
db.city.find(id).select({
  users: (q) => q.users.select('name', 'weather'),
});
```

Only a single batch of records is processed even when loading a nested query.

Let's say we have 10 countries, every country has 10 cities, with 100 users in each.

The `weather` computed column will be called just once with 10_000 of records.

```ts
db.country.select({
  cities: (q) =>
    q.cities.select({
      users: (q) => q.users.select('name', 'weather'),
    }),
});
```

A city may have a mayor, but that's not always the case.
Null records are omitted when passing data to a computed column.

```ts
db.country.select({
  cities: (q) =>
    q.cities.select({
      // city hasOne mayor, not required
      mayor: (q) => q.mayor.select('name', 'weather').,
    }),
});
```
