# 关系

可用的关系有：

- [belongsTo](#belongsTo)：一个属于另一个，属于的一方包含一个引用列。<br />
  **示例**：一个包含 `user_id` 和 `order_id` 的支付记录属于一个用户和一个订单。

- [hasOne](#hasOne)：类似于 "belongs to"，但引用列在另一侧。<br />
  **示例**：一个订单有一个支付记录，`order_id` 列在支付记录一侧。

  - **through**：当许多表通过 `belongsTo` 或 `hasOne` 连接时，
    它们中的第一个可以通过使用 `hasOne: through` 连接到最后一个。<br />
    **示例**：一个用户有一个个人资料，一个订单属于一个用户，一个订单可以通过用户拥有一个个人资料。<br />
    `through` 可以堆叠多个级别，因此一个属于订单的支付记录也可以通过订单拥有一个个人资料。

- [hasMany](#hasMany)：一个有多个其他的，其他的包含一个引用该表的列。<br />
  示例：一个用户有多个订单和支付记录。

  - **through**：当许多表连接时，并且至少有一个连接是 `hasMany` 或 `hasAndBelongsToMany`，<br />
    它们中的第一个可以通过使用 `hasMany: through` 连接到最后一个。<br />
    **示例**：一个订单有多个产品，一个用户有多个订单，一个用户可以通过订单拥有多个已订购的产品。<br />
    一个支付记录属于一个订单，它也可以通过相关订单拥有多个已订购的产品。<br />

- [hasAndBelongsToMany](#hasAndBelongsToMany)：一个多对多关系，
  它通过一个额外的表维护，其中单行指向双方。<br />
  **示例**：电影和演员，产品和类别。

  - vs. `hasMany: through`：我们可以说 `hasAndBelongsToMany` 是 `hasMany: through` 的简单情况，
    其中连接表是自动管理的，你不需要在其中存储任何额外信息。
    你可以在产品和类别之间使用 `hasAndBelongsToMany`，
    但如果以后需要在连接行中存储，比如说，
    关于谁将类别分配给产品的信息，
    那么它应该通过 `hasMany: through` 来处理。

## belongsTo

`belongsTo` 是用于一个表有一个列指向另一个表。

例如，`Book` 属于 `Author`：

```ts
import { Selectable } from 'orchid-orm';
import { BaseTable } from './baseTable';

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
import { BaseTable } from './baseTable';

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
import { BaseTable } from './baseTable';

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
import { BaseTable } from './baseTable';

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
import { BaseTable } from './baseTable';

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
import { BaseTable } from './baseTable';

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
