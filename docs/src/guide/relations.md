---
description: Defining table relations including belongsTo, hasOne, hasMany, hasAndBelongsToMany with and without through.
---

# Relations

Available relations are:

- [belongsTo](#belongsto): a record belongs to another record, and the declaring table includes a referencing column.<br />
  **Example**: a payment containing `user_id` and `order_id` belongs to a user and an order.

- [hasOne](#hasone): similar to `belongsTo`, but the referencing column is on the other side.<br />
  **Example**: an order has one payment, and the `order_id` column is on the payment side.
  - **through**: when many tables are connected using `belongsTo` or `hasOne`, the first of them can connect to the last by using a target query such as `PictureTable.through(...)`.<br />
    **Example**: a user has one profile, an order belongs to a user, an order can have one profile through a user.

- [hasMany](#hasmany): one record has many other records, and the other records include a column referencing the one.<br />
  **Example**: a user has many orders and payments.
  - **through**: when many tables are connected, and at least one of the connections is `hasMany` or `hasAndBelongsToMany`, the first of them can connect to the last by using a target query such as `ProductTable.through(...)`.<br />
    **Example**: a user has many orders, an order has many products, and a user can have many ordered products through orders.

- [hasAndBelongsToMany](#hasandbelongstomany): a many-to-many relation maintained by an additional join table where each row points to both sides.<br />
  **Examples**: movies and actors, products and categories.
  - vs. `hasMany(...).through(...)`: `hasAndBelongsToMany` is the simple join-table case where the join table does not need its own table definition.

## belongsTo

`belongsTo` is for a table which has a column pointing to another table.

For example, `Book` belongs to `Author`:

```ts
import { Selectable } from 'orchid-orm';
import { defineTable } from './table-factory';

export const AuthorTable = defineTable('author', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
}));

export type Author = Selectable<typeof AuthorTable>;

export const BookTable = defineTable('book', (t) => ({
  id: t.identity().primaryKey(),
  title: t.string(),
  // book has a column pointing to the author table
  authorId: t.integer(),
})).relations((book) => ({
  // authorId is not nullable, so author is required by default
  // unless AuthorTable has softDelete enabled.
  author: book('authorId').belongsTo(() => AuthorTable('id')),
}));

export type Book = Selectable<typeof BookTable>;
```

For `belongsTo`, `required` is inferred from the connecting columns by default.
When all columns are non-nullable, selected relation results and `queryRelated`
return the related record type. When any column is nullable, the relation is
optional by default. If the related table has [softDelete](/guide/soft-delete)
enabled, the relation is optional by default even when all columns are
non-nullable.

```ts
export const BookTable = defineTable('book', (t) => ({
  id: t.identity().primaryKey(),
  authorId: t.integer(),
  editorId: t.integer().nullable(),
})).relations((book) => ({
  // Required by default because authorId is not nullable
  // and AuthorTable does not have softDelete enabled.
  author: book('authorId').belongsTo(() => AuthorTable('id')),

  // Optional by default because editorId is nullable.
  editor: book('editorId').belongsTo(() => EditorTable('id')),
}));
```

Composite `belongsTo` relations are required by default only when all
connecting columns are non-nullable and the related table does not have
[softDelete](/guide/soft-delete) enabled:

```ts
export const OrderTable = defineTable('order', (t) => ({
  id: t.identity().primaryKey(),
  tenantId: t.integer(),
  accountId: t.integer(),
  reviewerTenantId: t.integer(),
  reviewerId: t.integer().nullable(),
})).relations((order) => ({
  // Required: tenantId and accountId are both non-nullable,
  // and AccountTable does not have softDelete enabled.
  account: order('tenantId', 'accountId').belongsTo(() =>
    AccountTable('tenantId', 'id'),
  ),

  // Optional: reviewerId is nullable.
  reviewer: order('reviewerTenantId', 'reviewerId').belongsTo(() =>
    ReviewerTable('tenantId', 'id'),
  ),
}));
```

Set `.required()` explicitly when the application needs a different contract
from the column nullability:

```ts
relations((book) => ({
  author: book('authorId')
    .belongsTo(() => AuthorTable('id'))
    .required(false),

  editor: book('editorId')
    .belongsTo(() => EditorTable('id'))
    .required(),
}));
```

## hasOne

`hasOne` association indicates that one other table has a reference to this
table. That table can be fetched through this association.

This association adds all the same queries and abilities as `belongsTo`; the
only difference is that the reference column is located in another table.

For example, if each supplier in your application has only one account, declare
the supplier table like this:

```ts
import { Selectable } from 'orchid-orm';
import { defineTable } from './table-factory';

export const SupplierTable = defineTable('supplier', (t) => ({
  id: t.identity().primaryKey(),
  brand: t.string(),
  // here are no reference columns for an Account
})).relations((supplier) => ({
  account: supplier('id')
    .hasOne(() => AccountTable('supplierId'))
    // required affects the TS type of returned records
    .required(),
}));

export type Supplier = Selectable<typeof SupplierTable>;

export const AccountTable = defineTable('account', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  // Account has a column pointing to Supplier:
  supplierId: t.integer(),
}));

export type Account = Selectable<typeof AccountTable>;
```

## hasOne through

A `hasOne through` association sets up a one-to-one connection with another
table. This association indicates that the declaring table can be matched with
one instance of another table by proceeding through a third table.

`hasOne through` gives the same querying abilities as a regular `hasOne`, but
without nested create functionality.

For example, if each supplier has one account, and each account is associated
with one account history, then the supplier table could look like this:

```ts
import { Selectable } from 'orchid-orm';
import { defineTable } from './table-factory';

export const SupplierTable = defineTable('supplier', (t) => ({
  id: t.identity().primaryKey(),
  brand: t.string(),
})).relations((supplier) => ({
  account: supplier('id')
    .hasOne(() => AccountTable('supplierId'))
    .required(),

  accountHistory: supplier
    .hasOne(() => AccountHistoryTable.through('account', 'accountHistory'))
    .required(),
}));

export type Supplier = Selectable<typeof SupplierTable>;

export const AccountTable = defineTable('account', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  // Account has a column pointing to Supplier:
  supplierId: t.integer(),
})).relations((account) => ({
  accountHistory: account('id')
    .hasOne(() => AccountHistoryTable('accountId'))
    .required(),
}));

export type Account = Selectable<typeof AccountTable>;

export const AccountHistoryTable = defineTable('accountHistory', (t) => ({
  id: t.identity().primaryKey(),
  data: t.text(),
  // column pointing to the Account
  accountId: t.integer(),
})).relations((accountHistory) => ({
  account: accountHistory('accountId')
    .belongsTo(() => AccountTable('id'))
    .required(),
}));

export type AccountHistory = Selectable<typeof AccountHistoryTable>;
```

## hasMany

A `hasMany` association is similar to `hasOne` but indicates a one-to-many
connection with another table. You'll often find this association on the other
side of a `belongsTo` association.

For example, in an application containing authors and books, the author table
could be declared like this:

```ts
import { Selectable } from 'orchid-orm';
import { defineTable } from './table-factory';

export const AuthorTable = defineTable('author', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
})).relations((author) => ({
  books: author('id').hasMany(() => BookTable('authorId')),
}));

export type Author = Selectable<typeof AuthorTable>;

export const BookTable = defineTable('book', (t) => ({
  id: t.identity().primaryKey(),
  title: t.string(),
  // book has a column pointing to the author table
  authorId: t.integer(),
}));

export type Book = Selectable<typeof BookTable>;
```

## hasMany through

A `hasMany through` association is often used to set up a many-to-many
connection with another table. This association indicates that the declaring
table can be matched with zero or more instances of another table by proceeding
through a third table.

`hasMany through` gives the same querying abilities as a regular `hasMany` but
without nested create functionality.

For example, consider a medical practice where patients make appointments to
see physicians. The relevant association declarations could look like this:

```ts
import { Selectable } from 'orchid-orm';
import { defineTable } from './table-factory';

export const PhysicianTable = defineTable('physician', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
})).relations((physician) => ({
  appointments: physician('id').hasMany(() => AppointmentTable('physicianId')),

  patients: physician.hasMany(() =>
    PatientTable.through('appointments', 'patient'),
  ),
}));

export type Physician = Selectable<typeof PhysicianTable>;

export const AppointmentTable = defineTable('appointment', (t) => ({
  id: t.identity().primaryKey(),
  appointmentDate: t.datetime(),
  // column references physician:
  physicianId: t.integer(),
  // column references patient:
  patientId: t.integer(),
})).relations((appointment) => ({
  physician: appointment('physicianId').belongsTo(() => PhysicianTable('id')),

  patient: appointment('patientId').belongsTo(() => PatientTable('id')),
}));

export type Appointment = Selectable<typeof AppointmentTable>;

export const PatientTable = defineTable('patient', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
})).relations((patient) => ({
  appointments: patient('id').hasMany(() => AppointmentTable('patientId')),

  physicians: patient.hasMany(() =>
    PhysicianTable.through('appointments', 'physician'),
  ),
}));

export type Patient = Selectable<typeof PatientTable>;
```

## hasAndBelongsToMany

A `hasAndBelongsToMany` association creates a direct many-to-many connection
with another table. The table in between must exist in the database, but you can
skip defining a table definition in the code.

This association indicates that each instance of the declaring table refers to
zero or more instances of another table, and vice versa.

If `snakeCase: true` config is set, you can write join table columns in
`camelCase`; they will be translated to `snake_case`.

For example, if your application includes posts and tags, with each post having
many tags and each tag appearing in many posts, declare the tables this way:

```ts
import { Selectable } from 'orchid-orm';
import { defineTable } from './table-factory';

export const PostTable = defineTable('post', (t) => ({
  id: t.identity().primaryKey(),
  title: t.string(),
})).relations((post) => ({
  tags: post('id')
    .hasAndBelongsToMany(() => TagTable('id'))
    .through(
      'postTag',
      'postId',
      'tagId',
      // optional: schema of the middle table, can be a function
      { schema: 'schema' },
    ),
}));

export type Post = Selectable<typeof PostTable>;

export const TagTable = defineTable('tag', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
})).relations((tag) => ({
  posts: tag('id')
    .hasAndBelongsToMany(() => PostTable('id'))
    .through('postTag', 'tagId', 'postId'),
}));

export type Tag = Selectable<typeof TagTable>;
```

## on - relation with a condition

All relation kinds support applying conditions to the relation target with
query methods such as `where`.

Adding a condition affects two things:

- all\* the queries of the relation are using the condition to filter records.
- when creating a related record, it automatically includes the values of the condition.

* - except `disconnect` in belongs, the record that belongs to another record will be disconnected even if the related record doesn't match the condition.

```ts
export const UserTable = defineTable('user', (t) => ({
  id: t.identity().primaryKey(),
  // ...snip
})).relations((user) => ({
  posts: user('id').hasMany(() => PostTable('userId')),

  draftPosts: user('id').hasMany(() =>
    PostTable('userId').where({ status: 'draft' }),
  ),
}));

// later in the code:

// select draft posts:
await db.user.select({
  draftPosts: (q) => q.draftPosts,
  equivalent: (q) => q.posts.where({ status: 'draft' }),
});

// the created post is populated with condition values automatically:
await db.user.find(id).update({
  draftPosts: {
    create: [{ title: '...', body: '...' }],
  },
});

// equivalent without the relation condition:
await db.user.find(id).update({
  posts: {
    create: [{ title: '...', body: '...', status: 'draft' }],
  },
});
```
