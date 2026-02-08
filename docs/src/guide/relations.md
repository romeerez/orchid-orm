# Relations

Available relations are:

- [belongsTo](#belongsTo): a one belongs to another, the belonging one includes a referencing column.<br />
  **Example**: a payment containing `user_id` and `order_id` belongs to a user and an order.

- [hasOne](#hasOne): is similar to "belongs to," but the referencing column is on the other side.<br />
  **Example**: an order has one payment, the `order_id` column is on the payment side.

  - **through**: when many tables are connected using `belongsTo` or `hasOne`,
    the first of them can connect to the last by using `hasOne: though`.<br />
    **Example**: a user has one profile, an order belongs to a user, an order can have one profile through a user.<br />
    `through` can stack many levels, so a payment that belongs to an order can also have a profile through the order.

- [hasMany](#hasMany): a one has many others, the others include a column referencing the one.<br />
  Example: a user has many orders and payments.

  - **through**: when many tables are connected, and at least one of the connection is `hasMany` or `hasAndBelongsToMany`,<br />
    the first of them can connect to the last by using `hasMany: though`.<br />
    **Example**: an order has many products, a user has many orders, a user can have multiple ordered products though orders.<br />
    A payment belongs to an order, it also can have many ordered products though the related order.<br />

- [hasAndBelongsToMany](#hasAndBelongsToMany): a many-to-many relation,
  it is maintained by having an additional table where a single row is pointing to both parties.<br />
  **Examples**: movies and actors, products and categories.

  - vs. `hasMany: though`: we can say `hasAndBelongsToMany` is a simple case of `hasMany: though`,
    where the join table is managed automatically, you don't have to store any additional info in it.
    You can use `hasAndBelongsToMany` between products and categories,
    but later if there is a need to store, let's say,
    info about who assigned the category to the product in the joining row,
    then it should be handled with `hasMany: through`.

## belongsTo

`belongsTo` is for a table which has a column pointing to another table.

For example, `Book` belongs to `Author`:

```ts
import { Selectable } from 'orchid-orm';
import { BaseTable } from './base-table';

export type Author = Selectable<AuthorTable>;
export class AuthorTable extends BaseTable {
  readonly table = 'author';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
  }));
}

export type Book = Selectable<BookTable>;
export class BookTable extends BaseTable {
  readonly table = 'book';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    title: t.string(),
    // book has a column pointing to the author table
    authorId: t.integer(),
  }));

  relations = {
    author: this.belongsTo(() => AuthorTable, {
      // required is affecting on TS type of returned record
      required: true,
      // columns of this table for the connection
      columns: ['authorId'],
      // columns of the related table to connect with
      references: ['id'],
    }),
  };
}
```

## hasOne

`hasOne` association indicates that one other table has a reference to this table. That table can be fetched through this association.

This association adds all the same queries and abilities as `belongsTo`, only difference is the reference column is located in another table.

For example, if each supplier in your application has only one account, you'd declare the supplier table like this:

```ts
import { Selectable } from 'orchid-orm';
import { BaseTable } from './base-table';

export type Supplier = Selectable<SupplierTable>;
export class SupplierTable extends BaseTable {
  readonly table = 'supplier';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    brand: t.string(),
    // here are no reference columns for an Account
  }));

  relations = {
    account: this.hasOne(() => AccountTable, {
      // required is affecting on TS type of returned record
      required: true,
      // the same as in belongsTo:
      // columns of this table for the connection
      columns: ['id'],
      // columns of the related table to connect with
      references: ['supplierId'],
    }),
  };
}

export type Account = Selectable<AccountTable>;
export class AccountTable extends BaseTable {
  readonly table = 'account';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    // Account has a column pointing to Supplier:
    supplierId: t.integer(),
  }));
}
```

## hasOne through

A `hasOne through` association sets up a one-to-one connection with another table.
This association indicates that the declaring table can be matched with one instance of another table by proceeding through a third table.

`hasOne through` gives the same querying abilities as a regular `hasOne`, but without nested create functionality.

For example, if each supplier has one account, and each account is associated with one account history, then the supplier table could look like this:

```ts
import { Selectable } from 'orchid-orm';
import { BaseTable } from './base-table';

export type Supplier = Selectable<SupplierTable>;
export class SupplierTable extends BaseTable {
  readonly table = 'supplier';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    brand: t.string(),
  }));

  relations = {
    account: this.hasOne(() => AccountTable, {
      required: true,
      columns: ['id'],
      references: ['supplierId'],
    }),

    accountHistory: this.hasOne(() => AccountTable, {
      required: true,
      // a previously defined relation name
      through: 'account',
      // name of a relation in the Account table
      source: 'accountHistory',
    }),
  };
}

export type Account = Selectable<AccountTable>;
export class AccountTable extends BaseTable {
  readonly table = 'account';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    // Account has a column pointing to Supplier:
    supplierId: t.integer(),
  }));

  relations = {
    accountHistory: this.hasOne(() => AccountHistoryTable, {
      required: true,
      columns: ['id'],
      references: ['accountId'],
    }),
  };
}

export type AccountHistory = Selectable<AccountHistoryTable>;
export class AccountHistoryTable extends BaseTable {
  readonly table = 'accountHistory';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    data: t.text(),
    // column pointing to the Account
    accountId: t.integer(),
  }));

  relations = {
    account: this.belongsTo(() => AccountTable, {
      required: true,
      columns: ['accountId'],
      references: ['id'],
    }),
  };
}
```

## hasMany

A `hasMany` association is similar to `hasOne` but indicates a one-to-many connection with another table.
You'll often find this association on the "other side" of a `belongsTo` association.
This association indicates that each instance of the table has zero or more instances of another table.

For example, in an application containing authors and books, the author table could be declared like this:

```ts
import { Selectable } from 'orchid-orm';
import { BaseTable } from './base-table';

export type Author = Selectable<AuthorTable>;
export class AuthorTable extends BaseTable {
  readonly table = 'author';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
  }));

  relations = {
    books: this.hasMany(() => BookTable, {
      // columns of this table to use for connection
      columns: ['id'],
      // columns of the related table to connect with
      references: ['authorId'],
    }),
  };
}

export type Book = Selectable<BookTable>;
export class BookTable extends BaseTable {
  readonly table = 'book';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    title: t.string(),
    // book has a column pointing to the author table
    authorId: t.integer(),
  }));
}
```

## hasMany through

A `hasMany though` association is often used to set up a many-to-many connection with another table.
This association indicates that the declaring table can be matched with zero or more instances of another table by proceeding through a third table.

`hasMany through` gives the same querying abilities as a regular `hasMany` but without nested create functionality.

For example, consider a medical practice where patients make appointments to see physicians. The relevant association declarations could look like this:

```ts
import { Selectable } from 'orchid-orm';
import { BaseTable } from './base-table';

export type Physician = Selectable<PhysicianTable>;
export class PhysicianTable extends BaseTable {
  readonly table = 'physician';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
  }));

  relations = {
    appointments: this.hasMany(() => AppointmentTable, {
      // columns of this table to use for connection
      columns: ['id'],
      // columns of the related table to connect with
      references: ['authorId'],
    }),

    patients: this.hasMany(() => PatienTable, {
      // previously defined relation name
      through: 'appointments',
      // name of relation in Appointment table
      source: 'patient',
    }),
  };
}

export type Appointment = Selectable<AppointmentTable>;
export class AppointmentTable extends BaseTable {
  readonly table = 'appointment';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    appointmentDate: t.datetime(),
    // column references physician:
    physicianId: t.integer(),
    // column references patient:
    patientId: t.integer(),
  }));

  relations = {
    physician: this.belongsTo(() => PhysicianTable, {
      columns: ['physycianId'],
      references: ['id'],
    }),

    patient: this.belongsTo(() => PatientTable, {
      columns: ['patientId'],
      references: ['id'],
    }),
  };
}

export type Patient = Selectable<PatientTable>;
export class PatientTable extends BaseTable {
  readonly table = 'patient';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
  }));

  relations = {
    appointments: this.hasMany(() => AppointmentTable, {
      columns: ['id'],
      references: ['patientId'],
    }),

    physicians: this.hasMany(() => PhysicianTable, {
      // previously defined relation name
      through: 'appointments',
      // name of relation in Appointment table
      source: 'physician',
    }),
  };
}
```

## hasAndBelongsToMany

A `hasAndBelongsToMany` association creates a direct many-to-many connection with another table.
The table in between must exist in the database, but you can skip defining a table class in the code.

This association indicates that each instance of the declaring table refers to zero or more instances of another table, and vice-versa.

If `snakeCase: true` config is set, you can write join table column in `camelCase`, they will be translated to `snake_case`.

For example, if your application includes posts and tags, with each post having many tags and each tag appearing in many posts, you could declare the tables this way:

```ts
import { Selectable } from 'orchid-orm';
import { BaseTable } from './base-table';

export type Post = Selectable<PostTable>;
export class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    title: t.string(),
  }));

  relations = {
    tags: this.hasAndBelongsToMany(() => TagTable, {
      // columns of this table to connect with the middle table
      columns: ['id'],
      // columns of the middle table to connect the columns to
      references: ['postId'],
      through: {
        // optional: schema of the middle table, can be a function
        schema: 'schema',
        // name of the middle table
        table: 'postTag',
        // columns of the middle table to connect to the related table
        columns: ['tagId'],
        // columns of the related table to connect the middle table to
        references: ['id'],
      },
    }),
  };
}

export type Tag = Selectable<TagTable>;
export class TagTable extends BaseTable {
  readonly table = 'tag';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
  }));

  relations = {
    posts: this.hasAndBelongsToMany(() => PostTable, {
      columns: ['id'],
      references: ['tagId'],
      through: {
        table: 'postTag',
        columns: ['postId'],
        references: ['id'],
      },
    }),
  };
}
```

## on - relation with a condition

All relation kinds support the `on` option to specify conditions.

Adding `on` affects two things:

- all\* the queries of the relation are using the condition to filter records.
- when creating a related record, it automatically includes the values of `on`.

* - except `disconnect` in belongs, the record that belongs to another record will be disconnected even if the related record doesn't match the `on` conditions.

```ts
export class UserTable extends BaseTable {
  readonly table = 'user';
  // ...snip

  relations = {
    posts: this.hasMany(() => PostTable, {
      columns: ['id'],
      references: ['user_id'],
    }),

    draftPosts: this.hasMany(() => PostTable, {
      columns: ['id'],
      references: ['user_id'],
      on: {
        status: 'draft',
      },
    }),
  };
}

// later in the code:

// select draft posts:
await db.user.select({
  draftPosts: (q) => q.draftPosts,
  equivalent: (q) => q.posts.where({ status: 'draft' }),
});

// the created post is populated with `on` values automatically:
await db.user.find(id).update({
  draftPosts: {
    create: [{ title: '...', body: '...' }],
  },
});

// equivalent without `on`:
await db.user.find(id).update({
  posts: {
    create: [{ title: '...', body: '...', status: 'draft' }],
  },
});
```
