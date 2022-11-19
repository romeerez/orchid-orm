# Relations

Different kinds of relations are available: `belongsTo`, `hasOne`, `hasMany`, and `hasAndBelongsToMany`.

Each defined relation adds methods and additional abilities for the model to simplify building queries and creating related data.

Two models can have a relation with each other without circular dependency problems:

```ts
// user.model.ts
import { Model } from 'orchid-orm'
import { ProfileModel } from './profile.model'

export type User = UserModel['columns']['type']
export class UserModel extends Model {
  table = 'user'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
  }))
  
  relations = {
    profile: this.hasOne(() => ProfileModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}

// profile.model.ts
import { Model } from 'orchid-orm'
import { UserModel } from './user.model'

export type Profile = ProfileModel['columns']['type']
export class ProfileModel extends Model {
  table = 'profile'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer(),
  }))

  relations = {
    profile: this.hasOne(() => UserModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'userId',
    }),
  }
}
```

## belongsTo

`belongsTo` is for a model which has a column pointing to another model.

For example, `Book` belongs to `Author`:

```ts
import { Model } from 'orchid-orm'

export type Author = AuthorModel['columns']['type']
export class AuthorModel extends Model {
  table = 'author'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))
}

export type Book = BookModel['columns']['type']
export class BookModel extends Model {
  table = 'book'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    // book has a column pointing to the author table
    authorId: t.integer(),
  }))
  
  relations = {
    author: this.belongsTo(() => AuthorModel, {
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

`hasOne` association indicates that one other model has a reference to this model. That model can be fetched through this association.

This association adds all the same queries and abilities as `belongsTo`, only difference is the reference column is located in another table.

For example, if each supplier in your application has only one account, you'd declare the supplier model like this:

```ts
import { Model } from 'orchid-orm'

export type Supplier = SupplierModel['columns']['type']
export class SupplierModel extends Model {
  table = 'supplier'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    brand: t.text(),
    // here are no reference columns for an Account
  }))

  relations = {
    account: this.hasOne(() => AccountModel, {
      // required is affecting on TS type of returned record
      required: true,
      // primaryKey is a column of Supplier to use
      primaryKey: 'id',
      // foreignKey is a column of Account to connect with
      foreignKey: 'supplierId',
    })
  }
}

export type Account = AccountModel['columns']['type']
export class AccountModel extends Model {
  table = 'account'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    // Account has a column pointing to Supplier:
    supplierId: t.integer(),
  }))
}
```

## hasOne through

A `hasOne through` association sets up a one-to-one connection with another model.
This association indicates that the declaring model can be matched with one instance of another model by proceeding through a third model.

`hasOne through` gives the same querying abilities as a regular `hasOne`, but without nested create functionality.

For example, if each supplier has one account, and each account is associated with one account history, then the supplier model could look like this:

```ts
import { Model } from 'orchid-orm'

export type Supplier = SupplierModel['columns']['type']
export class SupplierModel extends Model {
  table = 'supplier'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    brand: t.text(),
  }))

  relations = {
    account: this.hasOne(() => AccountModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'supplierId',
    }),
    
    accountHistory: this.hasOne(() => AccountModel, {
      required: true,
      // previously defined relation name
      through: 'account',
      // name of relation in Account model
      source: 'accountHistory',
    }),
  }
}

export type Account = AccountModel['columns']['type']
export class AccountModel extends Model {
  table = 'account'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    // Account has a column pointing to Supplier:
    supplierId: t.integer(),
  }))
  
  relations = {
    accountHistory: this.hasOne(() => AccountHistoryModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'accountId',
    }),
  }
}

export type AccountHistory = AccountHistoryModel['columns']['type']
export class AccountHistoryModel extends Model {
  table = 'accountHistory'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    data: t.text(),
    // column pointing to the Account
    accountId: t.integer(),
  }))

  relations = {
    account: this.belongsTo(() => AccountModel, {
      required: true,
      primaryKey: 'id',
      foreignKey: 'accountId',
    }),
  }
}
```

## hasMany

A `hasMany` association is similar to `hasOne` but indicates a one-to-many connection with another model.
You'll often find this association on the "other side" of a `belongsTo` association.
This association indicates that each instance of the model has zero or more instances of another model.

For example, in an application containing authors and books, the author model could be declared like this:

```ts
import { Model } from 'orchid-orm'

export type Author = AuthorModel['columns']['type']
export class AuthorModel extends Model {
  table = 'author'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))
  
  relations = {
    books: this.hasMany(() => BookModel, {
      // primaryKey is a column of Author to use
      primaryKey: 'id',
      // foreignKey is a column of Book to connect with
      foreignKey: 'authorId',
    })
  }
}

export type Book = BookModel['columns']['type']
export class BookModel extends Model {
  table = 'book'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    // book has a column pointing to the author table
    authorId: t.integer(),
  }))
}
```

## hasMany through

A `hasMany though` association is often used to set up a many-to-many connection with another model.
This association indicates that the declaring model can be matched with zero or more instances of another model by proceeding through a third model.

`hasMany through` gives the same querying abilities as a regular `hasMany` but without nested create functionality.

For example, consider a medical practice where patients make appointments to see physicians. The relevant association declarations could look like this:

```ts
import { Model } from 'orchid-orm'

export type Physician = PhysicianModel['columns']['type']
export class PhysicianModel extends Model {
  table = 'physician'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))

  relations = {
    appointments: this.hasMany(() => AppointmentModel, {
      // primaryKey is a column of Physicians to use
      primaryKey: 'id',
      // foreignKey is a column of Appointment to connect with
      foreignKey: 'authorId',
    }),
    
    patients: this.hasMany(() => PatienModel, {
      // previously defined relation name
      through: 'appointments',
      // name of relation in Appointment model
      source: 'patient',
    }),
  }
}

export type Appointment = AppointmentModel['columns']['type']
export class AppointmentModel extends Model {
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
    physician: this.belongsTo(() => PhysicianModel, {
      primaryKey: 'id',
      foreignKey: 'physycianId',
    }),
    
    patient: this.belongsTo(() => PatientModel, {
      primaryKey: 'id',
      foreignKey: 'patientId',
    }),
  }
}

export type Patient = PatientModel['columns']['type']
export class PatientModel extends Model {
  table = 'patient'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))
  
  relations = {
    appointments: this.hasMany(() => AppointmentModel, {
      primaryKey: 'id',
      foreignKey: 'patientId',
    }),
    
    physicians: this.hasMany(() => PhysicianModel, {
      // previously defined relation name
      through: 'appointments',
      // name of relation in Appointment model
      source: 'physician',
    })
  }
}
```

## hasAndBelongsToMany

A `hasAndBelongsToMany` association creates a direct many-to-many connection with another model, with no intervening model.
This association indicates that each instance of the declaring model refers to zero or more instances of another model.

For example, if your application includes posts and tags, with each post having many tags and each tag appearing in many posts, you could declare the models this way:

```ts
import { Model } from 'orchid-orm'

export type Post = PostModel['columns']['type']
export class PostModel extends Model {
  table = 'post'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
  }))

  relations = {
    tags: this.hasAndBelongsToMany(() => TagModel, {
      // primaryKey is a column of this model
      primaryKey: 'id',
      // foreignKey is a column of joinTable to connect with this model
      foreignKey: 'postId',
      // associationPrimaryKey is a primaryKey of a related model
      associationPrimaryKey: 'id',
      // associationForeignKey is a column of joinTable to connect with related model
      associationForeignKey: 'tagId',
      // joinTable is a connection table between this and related models
      joinTable: 'postTag',
    })
  }
}

export type Tag = TagModel['columns']['type']
export class TagModel extends Model {
  table = 'tag'
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }))

  relations = {
    posts: this.hasAndBelongsToMany(() => PostModel, {
      primaryKey: 'id',
      foreignKey: 'tagId',
      associationPrimaryKey: 'id',
      associationForeignKey: 'postId',
      joinTable: 'postTag',
    })
  }
}
```
