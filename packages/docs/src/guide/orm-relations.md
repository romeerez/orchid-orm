# Relations

Different kinds of relations are available: `belongsTo`, `hasOne`, `hasMany`, and `hasAndBelongsToMany`.

Each defined relation adds methods and additional abilities for the table to simplify building queries and creating related data.

Two tables can have a relation with each other without circular dependency problems:

```ts
// user.table.ts
import { BaseTable } from './baseTable'
import { ProfileTable } from './profile.table'

export type User = UserTable['columns']['type']
export class UserTable extends BaseTable {
  table = 'user'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
  }))
  
  relations = {
    profile: this.hasOne(() => ProfileTable, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}

// profile.table.ts
import { BaseTable } from './baseTable'
import { UserTable } from './user.table'

export type Profile = ProfileTable['columns']['type']
export class ProfileTable extends BaseTable {
  table = 'profile'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer(),
  }))

  relations = {
    profile: this.hasOne(() => UserTable, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}
```

## belongsTo

`belongsTo` is for a table which has a column pointing to another table.

For example, `Book` belongs to `Author`:

```ts
import { BaseTable } from './baseTable'

export type Author = AuthorTable['columns']['type']
export class AuthorTable extends BaseTable {
  table = 'author'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(3, 100),
  }))
}

export type Book = BookTable['columns']['type']
export class BookTable extends BaseTable {
  table = 'book'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(5, 100),
    // book has a column pointing to the author table
    authorId: t.integer(),
  }))
  
  relations = {
    author: this.belongsTo(() => AuthorTable, {
      // required is affecting on TS type of returned record
      required: true,
      // primaryKey is a column of Author to connect with
      primaryKey: 'id',
      // foreignKey is a column of Book to use
      foreignKey: 'authorId',
    })
  }
}
```

## hasOne

`hasOne` association indicates that one other table has a reference to this table. That table can be fetched through this association.

This association adds all the same queries and abilities as `belongsTo`, only difference is the reference column is located in another table.

For example, if each supplier in your application has only one account, you'd declare the supplier table like this:

```ts
import { BaseTable } from './baseTable'

export type Supplier = SupplierTable['columns']['type']
export class SupplierTable extends BaseTable {
  table = 'supplier'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    brand: t.text(2, 30),
    // here are no reference columns for an Account
  }))

  relations = {
    account: this.hasOne(() => AccountTable, {
      // required is affecting on TS type of returned record
      required: true,
      // primaryKey is a column of Supplier to use
      primaryKey: 'id',
      // foreignKey is a column of Account to connect with
      foreignKey: 'supplierId',
    })
  }
}

export type Account = AccountTable['columns']['type']
export class AccountTable extends BaseTable {
  table = 'account'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(3, 100),
    // Account has a column pointing to Supplier:
    supplierId: t.integer(),
  }))
}
```

## hasOne through

A `hasOne through` association sets up a one-to-one connection with another table.
This association indicates that the declaring table can be matched with one instance of another table by proceeding through a third table.

`hasOne through` gives the same querying abilities as a regular `hasOne`, but without nested create functionality.

For example, if each supplier has one account, and each account is associated with one account history, then the supplier table could look like this:

```ts
import { BaseTable } from './baseTable'

export type Supplier = SupplierTable['columns']['type']
export class SupplierTable extends BaseTable {
  table = 'supplier'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    brand: t.text(2, 30),
  }))

  relations = {
    account: this.hasOne(() => AccountTable, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'supplierId',
    }),
    
    accountHistory: this.hasOne(() => AccountTable, {
      required: true,
      // previously defined relation name
      through: 'account',
      // name of relation in Account table
      source: 'accountHistory',
    }),
  }
}

export type Account = AccountTable['columns']['type']
export class AccountTable extends BaseTable {
  table = 'account'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(3, 100),
    // Account has a column pointing to Supplier:
    supplierId: t.integer(),
  }))
  
  relations = {
    accountHistory: this.hasOne(() => AccountHistoryTable, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'accountId',
    }),
  }
}

export type AccountHistory = AccountHistoryTable['columns']['type']
export class AccountHistoryTable extends BaseTable {
  table = 'accountHistory'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    data: t.text(0, 1000),
    // column pointing to the Account
    accountId: t.integer(),
  }))

  relations = {
    account: this.belongsTo(() => AccountTable, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'accountId',
    }),
  }
}
```

## hasMany

A `hasMany` association is similar to `hasOne` but indicates a one-to-many connection with another table.
You'll often find this association on the "other side" of a `belongsTo` association.
This association indicates that each instance of the table has zero or more instances of another table.

For example, in an application containing authors and books, the author table could be declared like this:

```ts
import { BaseTable } from './baseTable'

export type Author = AuthorTable['columns']['type']
export class AuthorTable extends BaseTable {
  table = 'author'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(3, 100),
  }))
  
  relations = {
    books: this.hasMany(() => BookTable, {
      // primaryKey is a column of Author to use
      primaryKey: 'id',
      // foreignKey is a column of Book to connect with
      foreignKey: 'authorId',
    })
  }
}

export type Book = BookTable['columns']['type']
export class BookTable extends BaseTable {
  table = 'book'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(3, 100),
    // book has a column pointing to the author table
    authorId: t.integer(),
  }))
}
```

## hasMany through

A `hasMany though` association is often used to set up a many-to-many connection with another table.
This association indicates that the declaring table can be matched with zero or more instances of another table by proceeding through a third table.

`hasMany through` gives the same querying abilities as a regular `hasMany` but without nested create functionality.

For example, consider a medical practice where patients make appointments to see physicians. The relevant association declarations could look like this:

```ts
import { BaseTable } from './baseTable'

export type Physician = PhysicianTable['columns']['type']
export class PhysicianTable extends BaseTable {
  table = 'physician'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(3, 100),
  }))

  relations = {
    appointments: this.hasMany(() => AppointmentTable, {
      // primaryKey is a column of Physicians to use
      primaryKey: 'id',
      // foreignKey is a column of Appointment to connect with
      foreignKey: 'authorId',
    }),
    
    patients: this.hasMany(() => PatienTable, {
      // previously defined relation name
      through: 'appointments',
      // name of relation in Appointment table
      source: 'patient',
    }),
  }
}

export type Appointment = AppointmentTable['columns']['type']
export class AppointmentTable extends BaseTable {
  table = 'appointment'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    appointmentDate: t.datetime(),
    // column references physician:
    physicianId: t.integer(),
    // column references patient:
    patientId: t.integer(),
  }))
  
  relations = {
    physician: this.belongsTo(() => PhysicianTable, {
      primaryKey: 'id',
      foreignKey: 'physycianId',
    }),
    
    patient: this.belongsTo(() => PatientTable, {
      primaryKey: 'id',
      foreignKey: 'patientId',
    }),
  }
}

export type Patient = PatientTable['columns']['type']
export class PatientTable extends BaseTable {
  table = 'patient'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(3, 100),
  }))
  
  relations = {
    appointments: this.hasMany(() => AppointmentTable, {
      primaryKey: 'id',
      foreignKey: 'patientId',
    }),
    
    physicians: this.hasMany(() => PhysicianTable, {
      // previously defined relation name
      through: 'appointments',
      // name of relation in Appointment table
      source: 'physician',
    })
  }
}
```

## hasAndBelongsToMany

A `hasAndBelongsToMany` association creates a direct many-to-many connection with another table, with no intervening table.
This association indicates that each instance of the declaring table refers to zero or more instances of another table.

For example, if your application includes posts and tags, with each post having many tags and each tag appearing in many posts, you could declare the tables this way:

```ts
import { BaseTable } from './baseTable'

export type Post = PostTable['columns']['type']
export class PostTable extends BaseTable {
  table = 'post'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(5, 100),
  }))

  relations = {
    tags: this.hasAndBelongsToMany(() => TagTable, {
      // primaryKey is a column of this table
      primaryKey: 'id',
      // foreignKey is a column of joinTable to connect with this table
      foreignKey: 'postId',
      // associationPrimaryKey is a primaryKey of a related table
      associationPrimaryKey: 'id',
      // associationForeignKey is a column of joinTable to connect with related table
      associationForeignKey: 'tagId',
      // joinTable is a connection table between this and related tables
      joinTable: 'postTag',
    })
  }
}

export type Tag = TagTable['columns']['type']
export class TagTable extends BaseTable {
  table = 'tag'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(3, 100),
  }))

  relations = {
    posts: this.hasAndBelongsToMany(() => PostTable, {
      primaryKey: 'id',
      foreignKey: 'tagId',
      associationPrimaryKey: 'id',
      associationForeignKey: 'postId',
      joinTable: 'postTag',
    })
  }
}
```
