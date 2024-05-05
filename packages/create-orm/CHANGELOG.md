# create-orchid-orm

## 0.2.3

### Patch Changes

- dd816f9: Downgrade tsx dep in create-orm script because 4.9.1 is broken

## 0.2.2

### Patch Changes

- 42f5248: Fix generated dbScript for tsx, fix `db pull` for test database

## 0.2.1

### Patch Changes

- 907b2b8: Synchronize libraries by publishing them

## 0.2.0

### Minor Changes

- 929f49b: Generate migrations from table files, see [generate migrations](https://orchid-orm.netlify.app/guide/orm-and-query-builder.html#generate-migrations) docs.

  Rename utility type `Updateable` to `Updatable`.

  Include `rake-db` migration toolkit to the `orchid-orm` package.
  If you're using `orchid-orm`, remove `rake-db` from dependencies and import `rakeDb` from `orchd-orm/migrations` instead.

## 0.1.3

### Patch Changes

- 064f399d: Republish create-orm script to fix demo migrations versions

## 0.1.2

### Patch Changes

- 5853befe: Add valibot dependency when choosing valibot

## 0.1.1

### Patch Changes

- 012752d0: Add valibot integration

## 0.1.0

### Minor Changes

- 4c7015b4: Support multiple column schemas for various cases

## 0.0.4

### Patch Changes

- 46382c24: Re-export everything from pqb in orchid-orm

## 0.0.3

### Patch Changes

- a62fdd85: Add example option to init script; Fix test-factory for zod-mock updates

## 0.0.2

### Patch Changes

- 9f95738d: Add `build` and `db:compiled` scripts to `ts-node` runner when initializing project; support running compiled migrations in commonjs projects for `tsx` and `vite-node`

## 0.0.1

### Patch Changes

- 4781781b: Extract init script into own package and renew it
