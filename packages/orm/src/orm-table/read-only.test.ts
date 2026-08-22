import { orchidORMWithAdapter } from '../orm-instance/orm-instance';
import {
  defineTable,
  assertType,
  testAdapter,
  testDbOptions,
} from 'test-utils';
import { CannotMutateReadOnlyTableError } from 'pqb/internal';

const Table = defineTable('table', (t) => ({
  id: t.identity().primaryKey(),
  readOnlyId: t.integer().nullable(),
})).relations((main) => ({
  readOnlyBelongsTo: main('readOnlyId').belongsTo(() => ReadOnlyTable('id')),
  readOnlyHasOne: main('id').hasOne(() => ReadOnlyTable('tableId')),
  readOnlyHasMany: main('id').hasMany(() => ReadOnlyTable('tableId')),
  readOnlyHasAndBelongsToMany: main('id')
    .hasAndBelongsToMany(() => ReadOnlyTable('tableId'))
    .through('tableReadOnly', 'readOnlyId', 'id'),
}));

const ReadOnlyTable = defineTable('readOnly', { readOnly: true }, (t) => ({
  id: t.identity().primaryKey(),
  tableId: t.integer().nullable(),
  name: t.text(),
}));

const db = orchidORMWithAdapter(
  { ...testDbOptions, adapter: testAdapter },
  {
    table: Table,
    readOnly: ReadOnlyTable,
  },
);

describe('readOnly', () => {
  const readOnlyError = CannotMutateReadOnlyTableError;

  it('maps table readOnly declarations into query read-only capability', () => {
    assertType<typeof db.table.__readOnly, undefined>();
    assertType<typeof db.readOnly.__readOnly, true>();

    const readQuery = db.readOnly.where({ id: 1 }).select('name');

    assertType<typeof readQuery.__readOnly, true>();
    assertType<Awaited<typeof readQuery>, { name: string }[]>();

    // @ts-expect-error read-only ORM table cannot create
    expect(() => db.readOnly.create({ name: 'name' })).toThrow(readOnlyError);
    // @ts-expect-error read-only ORM table cannot update
    expect(() => db.readOnly.all().update({ name: 'name' })).toThrow(
      readOnlyError,
    );
    // @ts-expect-error read-only ORM table cannot delete
    expect(() => db.readOnly.all().delete()).toThrow(readOnlyError);
  });

  describe('belongsTo', () => {
    describe('nested create', () => {
      it('cannot do nested create', () => {
        expect(() =>
          db.table.create({
            // @ts-expect-error read-only relation cannot create
            readOnlyBelongsTo: { create: { name: 'name' } },
          }),
        ).toThrow(readOnlyError);
      });
    });

    describe('nested update', () => {
      it('cannot do nested update', () => {
        expect(() =>
          db.table.find(1).update({
            // @ts-expect-error read-only relation cannot update
            readOnlyBelongsTo: { update: { name: 'name' } },
          }),
        ).toThrow(readOnlyError);
      });
    });

    describe('nested delete', () => {
      it('cannot do nested delete', () => {
        expect(() =>
          db.table.find(1).update({
            // @ts-expect-error read-only relation cannot delete
            readOnlyBelongsTo: { delete: true },
          }),
        ).toThrow(readOnlyError);
      });
    });
  });

  describe('hasOne', () => {
    describe('nested create', () => {
      it('cannot do nested create', () => {
        expect(() =>
          db.table.create({
            // @ts-expect-error read-only relation cannot create
            readOnlyHasOne: {
              create: { name: 'name' },
            },
          }),
        ).toThrow(readOnlyError);
      });
    });

    describe('nested update', () => {
      it('cannot do nested update', () => {
        expect(() =>
          db.table.find(1).update({
            // @ts-expect-error read-only relation cannot update
            readOnlyHasOne: { update: { name: 'name' } },
          }),
        ).toThrow(readOnlyError);
      });
    });

    describe('nested delete', () => {
      it('cannot do nested delete', () => {
        expect(() =>
          db.table.find(1).update({
            // @ts-expect-error read-only relation cannot delete
            readOnlyHasOne: { delete: true },
          }),
        ).toThrow(readOnlyError);
      });
    });
  });

  describe('hasMany', () => {
    describe('nested create', () => {
      it('cannot do nested create', () => {
        expect(() =>
          db.table.create({
            // @ts-expect-error read-only relation cannot create
            readOnlyHasMany: {
              create: [{ name: 'name' }],
            },
          }),
        ).toThrow(readOnlyError);
      });
    });

    describe('nested update', () => {
      it('cannot do nested update', async () => {
        expect(() =>
          db.table.find(1).update({
            // @ts-expect-error read-only relation cannot update
            readOnlyHasMany: {
              update: { where: { id: 1 }, data: { name: 'name' } },
            },
          }),
        ).toThrow(readOnlyError);
      });
    });

    describe('nested delete', () => {
      it('cannot do nested delete', async () => {
        expect(() =>
          db.table.find(1).update({
            // @ts-expect-error read-only relation cannot delete
            readOnlyHasMany: {
              delete: { id: 1 },
            },
          }),
        ).toThrow(readOnlyError);
      });
    });
  });

  describe('hasAndBelongsToMany', () => {
    describe('nested create', () => {
      it('cannot do nested create', async () => {
        expect(() =>
          db.table.create({
            readOnlyHasAndBelongsToMany: {
              // @ts-expect-error read-only relation cannot create
              create: [{ name: 'name' }],
            },
          }),
        ).toThrow(readOnlyError);
      });
    });

    describe('nested update', () => {
      it('cannot do nested update', async () => {
        expect(() =>
          db.table.find(1).update({
            readOnlyHasAndBelongsToMany: {
              // @ts-expect-error read-only relation cannot update
              update: { where: { id: 1 }, data: { name: 'name' } },
            },
          }),
        ).toThrow(readOnlyError);
      });
    });

    describe('nested delete', () => {
      it('cannot do nested delete', async () => {
        expect(() =>
          db.table.find(1).update({
            readOnlyHasAndBelongsToMany: {
              // @ts-expect-error read-only relation cannot delete
              delete: { id: 1 },
            },
          }),
        ).toThrow(readOnlyError);

        expect(() =>
          // @ts-expect-error read-only relation cannot delete
          db.table
            .find(1)
            .chain('readOnlyHasAndBelongsToMany')
            .where({ id: 1 })
            .all()
            .delete(undefined as never),
        ).toThrow(readOnlyError);
      });
    });
  });
});
