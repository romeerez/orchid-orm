# JSON functions

Note that json methods that operates on a single json value, such as [jsonSet](#jsonSet), [jsonInsert](#jsonInsert), and others,
can be chained one after another:

```ts
db.table.update({
  data: (q) =>
    q.get('data').jsonSet('foo', 1).jsonSet('bar', 2).jsonRemove('baz'),
});
```

## json

[//]: # 'has JSDoc'

Wraps the query in a way to select a single JSON string.
So that JSON encoding is done on a database side, and the application doesn't have to turn a response to a JSON.
It may be better for performance in some cases.

```ts
// json is a JSON string that you can directly send as a response.
const json = await db.table.select('id', 'name').json();
```

## jsonPathQueryFirst

[//]: # 'has JSDoc'

Selects a value from JSON data using a JSON path.

Calls the [jsonb_path_query_first](https://www.postgresql.org/docs/current/functions-json.html) Postgres function.

Type can be provided via `{ type: (t) => t.columnType() }` options, by default the type is `unknown`.

Optionally takes `vars` and `silent` parameters, see [Postgres docs](https://www.postgresql.org/docs/current/functions-json.html) for details.

```ts
// query a single value from a JSON data,
// because of the provided type, string JSON value will be parsed to a Date object.
const value = await db.table
  .get('data')
  .jsonPathQueryFirst('$.path.to.date', { type: (t) => t.date().asDate() });

// using it in a select
const records = await db.table.select({
  date: (q) =>
    q.get('data').jsonPathQueryFirst('$[*] ? (@ = key)', {
      type: (t) => t.integer(),
      // defining `vars` and `silent`
      vars: { key: 'key' },
      silent: true,
    }),
});

// using it in `where`
const filtered = await db.table.where((q) =>
  // filtering records by the `name` property from the `data` JSON column
  q.get('data').jsonPathQueryFirst('$.name').equals('name'),
);

// using it in update
await db.table.find(id).update({
  // using data property to set the `name` column
  name: (q) =>
    q.get('data').jsonPathQueryFirst('$.name', { type: (t) => t.string() }),
});
```

## jsonSet

[//]: # 'has JSDoc'

Returns a JSON value/object/array where a given value is set at the given path.
The path is a key or an array of keys to access the value.

Calls the [jsonb_set](https://www.postgresql.org/docs/current/functions-json.html) Postgres function.

It can be used in all contexts on a single JSON value.

```ts
await db.table.find(id).update({
  data: (q) => q.get('data').jsonSet(['path', 'to', 'value'], 'new value'),
});
```

## jsonReplace

The same as [jsonSet](#jsonSet), but sets the last argument of `jsonb_set` to false,
so this function only has effect when the value already existed in the JSON.

```ts
await db.table.find(id).update({
  // data.path.to.value will be updated only if it already was defined
  data: (q) => q.get('data').jsonReplace(['path', 'to', 'value'], 'new value'),
});
```

## jsonInsert

[//]: # 'has JSDoc'

Inserts a value into a given position of JSON array and returns the whole array.
The path is a key or an array of keys to access the value.

If a value exists at the given path, the value is not replaced.

Provide `{ after: true }` option to insert a value after a given position.

Calls the [jsonb_insert](https://www.postgresql.org/docs/current/functions-json.html) Postgres function.

It can be used in all contexts on a single JSON value.

```ts
// update the record with data { tags: ['two'] } to have data { tags: ['one', 'two'] }
await db.table.find(id).update({
  data: (q) => q.get('data').jsonInsert(['tags', 0], 'one'),
});

// add 'three' after 'two'
await db.table.find(id).update({
  data: (q) => q.get('data').jsonInsert(['tags', 1], 'three', { after: true }),
});
```

## jsonRemove

[//]: # 'has JSDoc'

Remove a value from a JSON object or array at a given path.
The path is a key or an array of keys to access the value.

Uses the [#-](https://www.postgresql.org/docs/current/functions-json.html) Postgres operator.

It can be used in all contexts on a single JSON value.

```ts
// the record has data { tags: ['one', 'two'] }
// removing the first tag, the data will be { tags: ['two'] }
const result = await db.table.find(id).update({
  data: (q) => q.get('data').jsonRemove(['tags', 0]),
});
```
