# Relations

Different kinds of relations are available: `belongsTo`, `hasOne`, `hasMany`, and `hasAndBelongsToMany`.

Each defined relation adds methods and additional abilities for the table to simplify building queries and creating related data.

Two tables can have a relation with each other without circular dependency problems:

```ts
// user.table.ts
import { BaseTable } from './baseTable';
import { ProfileTable } from './profile.table';

export class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
  }));

  relations = {
    profile: this.hasOne(() => ProfileTable, {
      required: true,
      columns: ['id'],
      references: ['userId'],
    }),
  };
}
```

```ts
// profile.table.ts
import { BaseTable } from './baseTable';
import { UserTable } from './user.table';

export class ProfileTable extends BaseTable {
  readonly table = 'profile';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer(),
  }));

  relations = {
    profile: this.belongsTo(() => UserTable, {
      required: true,
      columns: ['userId'],
      references: ['id'],
    }),
  };
}
```

## belongsTo

`belongsTo` is for a table which has a column pointing to another table.

For example, `Book` belongs to `Author`:

```ts
import { Selectable } from 'orchid-orm';
import { BaseTable } from './baseTable';

export type Author = Selectable<AuthorTable>;
export class AuthorTable extends BaseTable {
  readonly table = 'author';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(3, 100),
  }));
}

export type Book = Selectable<BookTable>;
export class BookTable extends BaseTable {
  readonly table = 'book';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    title: t.text(5, 100),
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
    brand: t.text(2, 30),
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
    name: t.text(3, 100),
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
    brand: t.text(2, 30),
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
    name: t.text(3, 100),
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
    data: t.text(0, 1000),
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
    name: t.text(3, 100),
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
    title: t.text(3, 100),
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
    name: t.text(3, 100),
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
    name: t.text(3, 100),
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

A `hasAndBelongsToMany` association creates a direct many-to-many connection with another table, with no intervening table.
This association indicates that each instance of the declaring table refers to zero or more instances of another table.

For example, if your application includes posts and tags, with each post having many tags and each tag appearing in many posts, you could declare the tables this way:

```ts
import { Selectable } from 'orchid-orm';
import { BaseTable } from './baseTable';

export type Post = Selectable<PostTable>;
export class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    title: t.text(5, 100),
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
    name: t.text(3, 100),
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
