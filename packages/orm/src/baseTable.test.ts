import {
  createBaseTable,
  Insertable,
  Queryable,
  Selectable,
  Updatable,
} from './baseTable';
import { orchidORM } from './orm';
import { ColumnType, makeColumnTypes, Operators, TextColumn } from 'pqb';
import {
  BaseTable,
  db,
  profileData,
  sql,
  userData,
  useTestORM,
} from './test-utils/orm.test-utils';
import path from 'path';
import { getCallerFilePath } from 'orchid-core';
import {
  asMock,
  assertType,
  expectSql,
  testAdapter,
  testColumnTypes,
} from 'test-utils';
import { DefaultSchemaConfig, defaultSchemaConfig } from 'pqb';
import { z } from 'zod';
import { zodSchemaConfig } from 'schema-to-zod';

jest.mock('orchid-core', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  const actual = jest.requireActual('../../core/src');
  return {
    ...actual,
    getCallerFilePath: jest.fn(() =>
      path.join(__dirname, 'test-utils', 'test-tables.ts'),
    ),
  };
});

describe('baseTable', () => {
  useTestORM();

  it('should have `exportAs`', () => {
    expect(BaseTable.exportAs).toBe('BaseTable');
  });

  it('should have `sql` with bound column types', () => {
    const { sql } = BaseTable;

    const s = sql``;

    expect(s.columnTypes).toBe(BaseTable.columnTypes);
  });

  it('should allow to customize a name', () => {
    const base = createBaseTable({
      exportAs: 'custom',
      schemaConfig: zodSchemaConfig,
    });
    expect(base.exportAs).toBe('custom');
  });

  it('should have a getFilePath method to return a path where the baseTable is defined', () => {
    expect(BaseTable.getFilePath()).toBe(
      path.join(__dirname, 'test-utils', 'test-tables.ts'),
    );
  });

  it('should throw if cannot determine file path and calling `getFilePath', () => {
    asMock(getCallerFilePath).mockReturnValueOnce(undefined);

    expect(() => createBaseTable().getFilePath()).toThrow(
      'Failed to determine file path',
    );
  });

  it('should set the default language to the table query', () => {
    const Base = createBaseTable({ language: 'Ukrainian' });
    class Table extends Base {
      table = 'table';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
      }));
    }
    const orm = orchidORM({ adapter: testAdapter }, { table: Table });

    expect(orm.table.q.language).toBe('Ukrainian');
  });

  it('should have `columnTypes`', () => {
    expect(BaseTable.columnTypes).toBe(testColumnTypes);
  });

  describe('setColumns', () => {
    it('should store columns in the prototype of the table', () => {
      const shape = {
        id: makeColumnTypes(defaultSchemaConfig).identity().primaryKey(),
      };

      class SomeTable extends BaseTable {
        readonly table = 'some';
        columns = this.setColumns(() => shape);
      }

      expect(SomeTable.instance().columns.shape).toEqual(shape);
    });
  });

  describe('overriding column types', () => {
    it('should have .sql with overridden types', () => {
      class Type extends ColumnType {
        dataType = 'type';
        operators = Operators.any;
        constructor() {
          super(defaultSchemaConfig, defaultSchemaConfig.unknown);
        }
        toCode() {
          return '';
        }
      }
      const type = new Type();
      const BaseTable = createBaseTable({ columnTypes: { type: () => type } });
      class UserTable extends BaseTable {
        readonly table = 'user';
        columns = this.setColumns((t) => ({
          id: t.type().primaryKey(),
          createdAt: t.type(),
        }));
      }

      const { user } = orchidORM(
        { adapter: testAdapter },
        {
          user: UserTable,
        },
      );

      const value = user.sql``.type((t) => t.type());

      expect(value.result.value).toBe(type);
    });

    it('should return date as string by default', async () => {
      await db.user.create(userData);

      const BaseTable = createBaseTable();
      class UserTable extends BaseTable {
        readonly table = 'user';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          createdAt: t.timestamp(),
        }));
      }

      const { user } = orchidORM(
        { adapter: testAdapter },
        {
          user: UserTable,
        },
      );

      const result = await user.get('createdAt');
      expect(typeof result).toBe('string');

      assertType<typeof result, string>();
    });

    it('should return date as Date when overridden', async () => {
      await db.user.create(userData);

      const BaseTable = createBaseTable({
        columnTypes: (t) => ({
          identity: t.identity,
          timestamp() {
            return t.timestamp().parse((input) => new Date(input));
          },
        }),
      });

      class UserTable extends BaseTable {
        readonly table = 'user';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          createdAt: t.timestamp(),
        }));
      }

      const { user } = orchidORM(
        { adapter: testAdapter },
        {
          user: UserTable,
        },
      );

      const result = await user.get('createdAt');
      expect(result instanceof Date).toBe(true);

      assertType<typeof result, Date>();
    });
  });

  describe('noPrimaryKey', () => {
    it('should allow to the table to not have a primary key', () => {
      class UserTable extends BaseTable {
        readonly table = 'user';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          name: t.text(),
        }));
      }

      orchidORM(
        {
          adapter: testAdapter,
        },
        {
          user: UserTable,
        },
      );
    });
  });

  describe('snake case', () => {
    it('should set snakeCase to BaseTable`s prototype', () => {
      const BaseTable = createBaseTable({
        snakeCase: true,
      });

      expect(BaseTable.prototype.snakeCase).toBe(true);
    });

    it('should translate columns to snake case, use snake case timestamps, with respect to existing names', () => {
      const BaseTable = createBaseTable({
        snakeCase: true,
      });

      class UserTable extends BaseTable {
        readonly table = 'user';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          camelCase: t.name('camelCase').integer(),
          snakeCase: t.integer(),
          ...t.timestamps(),
        }));
      }

      const db = orchidORM(
        {
          adapter: testAdapter,
        },
        {
          user: UserTable,
        },
      );

      expect(db.user.shape.camelCase.data.name).toBe('camelCase');
      expect(db.user.shape.snakeCase.data.name).toBe('snake_case');
      expect(db.user.shape.createdAt.data.name).toBe('created_at');
      expect(db.user.shape.updatedAt.data.name).toBe('updated_at');
    });

    it('should add timestamps with snake case names when snakeCase option is set to true on the table class', () => {
      const BaseTable = createBaseTable();

      class UserTable extends BaseTable {
        readonly table = 'user';
        snakeCase = true;
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          camelCase: t.name('camelCase').integer(),
          snakeCase: t.integer(),
          ...t.timestamps(),
        }));
      }

      const db = orchidORM(
        {
          adapter: testAdapter,
        },
        {
          user: UserTable,
        },
      );

      expect(db.user.shape.camelCase.data.name).toBe('camelCase');
      expect(db.user.shape.snakeCase.data.name).toBe('snake_case');
      expect(db.user.shape.createdAt.data.name).toBe('created_at');
      expect(db.user.shape.updatedAt.data.name).toBe('updated_at');
    });
  });

  describe('nowSQL', () => {
    it('should produce custom SQL for timestamps when updating', () => {
      const nowSQL = `now() AT TIME ZONE 'UTC'`;
      const BaseTable = createBaseTable({
        nowSQL,
      });

      class UserTable extends BaseTable {
        readonly table = 'user';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          ...t.timestamps(),
        }));
      }

      const { user } = orchidORM(
        { adapter: testAdapter },
        {
          user: UserTable,
        },
      );

      expect(user.internal.nowSQL).toBe(nowSQL);

      expectSql(
        user.find(1).update({}).toSQL(),
        `
          UPDATE "user" SET "updatedAt" = (now() AT TIME ZONE 'UTC') WHERE "user"."id" = $1
        `,
        [1],
      );
    });
  });

  describe('hooks', () => {
    it('should set hooks in the init', async () => {
      const fns = {
        beforeQuery: () => {},
        afterQuery: () => {},
        beforeCreate: () => {},
        afterCreate: () => {},
        afterCreateCommit: () => {},
        beforeUpdate: () => {},
        afterUpdate: () => {},
        afterUpdateCommit: () => {},
        beforeDelete: () => {},
        afterDelete: () => {},
        afterDeleteCommit: () => {},
        beforeSave: () => {},
        afterSave: () => {},
        afterSaveCommit: () => {},
      };

      let initArg: unknown | undefined;

      class Table extends BaseTable {
        readonly table = 'table';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          one: t.text(),
          two: t.text(),
          three: t.text(),
          four: t.text(),
          five: t.text(),
          six: t.text(),
          seven: t.text(),
          eight: t.text(),
        }));

        init(orm: typeof db) {
          this.beforeQuery(fns.beforeQuery);
          this.beforeCreate(fns.beforeCreate);
          this.beforeUpdate(fns.beforeUpdate);
          this.beforeDelete(fns.beforeDelete);
          this.beforeSave(fns.beforeSave);
          this.afterQuery(fns.afterQuery);
          this.afterCreate(['one'], fns.afterCreate);
          this.afterCreateCommit(['two'], fns.afterCreateCommit);
          this.afterUpdate(['three'], fns.afterUpdate);
          this.afterUpdateCommit(['four'], fns.afterUpdateCommit);
          this.afterDelete(['five'], fns.afterDelete);
          this.afterDeleteCommit(['six'], fns.afterDeleteCommit);
          this.afterSave(['seven'], fns.afterSave);
          this.afterSaveCommit(['eight'], fns.afterSaveCommit);

          initArg = orm;
        }
      }

      const db = orchidORM(
        { adapter: testAdapter },
        {
          table: Table,
        },
      );

      expect(initArg).toBe(db);

      expect(db.table.baseQuery.q).toMatchObject({
        before: [fns.beforeQuery],
        after: [fns.afterQuery],
        beforeCreate: [fns.beforeCreate, fns.beforeSave],
        afterCreate: [fns.afterCreate, fns.afterSave],
        afterCreateCommit: [fns.afterCreateCommit, fns.afterSaveCommit],
        afterCreateSelect: new Set(['one', 'two', 'seven', 'eight']),
        beforeUpdate: [fns.beforeUpdate, fns.beforeSave],
        afterUpdate: [fns.afterUpdate, fns.afterSave],
        afterUpdateCommit: [fns.afterUpdateCommit, fns.afterSaveCommit],
        afterUpdateSelect: new Set(['three', 'four', 'seven', 'eight']),
        beforeDelete: [fns.beforeDelete],
        afterDelete: [fns.afterDelete],
        afterDeleteCommit: [fns.afterDeleteCommit],
        afterDeleteSelect: new Set(['five', 'six']),
      });
    });
  });

  describe('schemaProvider', () => {
    const BaseTable = createBaseTable({
      schemaConfig: zodSchemaConfig,
    });

    class SomeTable extends BaseTable {
      readonly table = 'some';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }));

      relations = {
        some: this.belongsTo(() => OtherTable, {
          columns: ['id'],
          references: ['someId'],
        }),
      };
    }

    class OtherTable extends BaseTable {
      readonly table = 'some';
      columns = this.setColumns((t) => ({
        someId: t.integer().primaryKey(),
      }));
    }

    // need to instantiate tables so that the relations add special virtual columns
    orchidORM(
      { db: db.$queryBuilder },
      {
        some: SomeTable,
        other: OtherTable,
      },
    );

    it('should expose inputSchema, outputSchema, querySchema, updateSchema, pkeySchema', () => {
      const inputSchema = SomeTable.inputSchema();
      const outputSchema = SomeTable.outputSchema();
      const querySchema = SomeTable.querySchema();
      const createSchema = SomeTable.createSchema();
      const updateSchema = SomeTable.updateSchema();
      const pkeySchema = SomeTable.pkeySchema();

      const expected = z.object({ id: z.number(), name: z.string() });
      assertType<typeof inputSchema, typeof expected>();
      assertType<typeof outputSchema, typeof expected>();

      const expectedQuery = z
        .object({ id: z.number(), name: z.string() })
        .partial();
      assertType<typeof querySchema, typeof expectedQuery>();

      const expectedCreate = expected.omit({ id: true });
      assertType<typeof createSchema, typeof expectedCreate>();

      const expectedUpdate = expectedCreate.partial();
      assertType<typeof updateSchema, typeof expectedUpdate>();

      const expectedPKeys = expected.pick({ id: true });
      assertType<typeof pkeySchema, typeof expectedPKeys>();

      const data = { id: 1, name: 'name' };
      for (const schema of [
        inputSchema,
        outputSchema,
        querySchema,
        createSchema,
        updateSchema,
        pkeySchema,
      ]) {
        expect(() => schema.parse(data)).not.toThrow();
      }
    });

    it('should be memoized', () => {
      const inputSchema = SomeTable.inputSchema();
      const outputSchema = SomeTable.outputSchema();
      const querySchema = SomeTable.querySchema();
      const inputSchema2 = SomeTable.inputSchema();
      const outputSchema2 = SomeTable.outputSchema();
      const querySchema2 = SomeTable.querySchema();

      expect(inputSchema2).toBe(inputSchema);
      expect(outputSchema2).toBe(outputSchema);
      expect(querySchema2).toBe(querySchema);
    });
  });

  describe('Queryable', () => {
    it('should have a partial shape of column `queryType`', () => {
      class SomeTable extends BaseTable {
        columns = this.setColumns((t) => ({
          foo: t.text() as unknown as Omit<
            TextColumn<DefaultSchemaConfig>,
            'queryType'
          > & {
            queryType: number;
          },
        }));
      }

      assertType<Queryable<SomeTable>, { foo?: number }>();
    });
  });

  describe('Selectable', () => {
    it('should have a columns shape type returned from database and parsed', () => {
      class SomeTable extends BaseTable {
        columns = this.setColumns((t) => ({
          foo: t.text().parse(() => true),
        }));
      }

      assertType<Selectable<SomeTable>, { foo: boolean }>();
    });
  });

  describe('Insertable', () => {
    it('should have a columns shape where columns with defaults are optional', () => {
      class SomeTable extends BaseTable {
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          optional: t.text().default('text'),
          required: t.boolean(),
        }));
      }

      assertType<
        Insertable<SomeTable>,
        { id?: number; optional?: string; required: boolean }
      >();
    });
  });

  describe('Updatable', () => {
    it('should be a partial Insertable', () => {
      class SomeTable extends BaseTable {
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          optional: t.text().default('text'),
          required: t.boolean(),
        }));
      }

      assertType<
        Updatable<SomeTable>,
        { id?: number; optional?: string; required?: boolean }
      >();
    });
  });

  describe('computed', () => {
    class UserTable extends BaseTable {
      readonly table = 'user';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        Name: t.name('name').text(),
        Password: t.name('password').text(),
        UserKey: t.name('userKey').text().nullable(),
      }));

      computed = this.setComputed((q) => ({
        sqlComputed: sql`${q.column('Name')} || ' ' || ${q.column(
          'UserKey',
        )}`.type((t) => t.text()),
        runtimeComputed: q.computeAtRuntime(
          ['Id', 'Name'],
          (record) => `${record.Id} ${record.Name}`,
        ),
        batchComputed: q.computeBatchAtRuntime(['Id', 'Name'], (records) =>
          Promise.all(records.map((record) => `${record.Id} ${record.Name}`)),
        ),
      }));

      relations = {
        profile: this.hasOne(() => ProfileTable, {
          required: true,
          columns: ['Id', 'UserKey'],
          references: ['UserId', 'ProfileKey'],
        }),
      };
    }

    class ProfileTable extends BaseTable {
      readonly table = 'profile';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        ProfileKey: t.name('profileKey').text(),
        UserId: t.name('userId').integer().nullable(),
      }));

      relations = {
        user: this.belongsTo(() => UserTable, {
          columns: ['UserId', 'ProfileKey'],
          references: ['Id', 'UserKey'],
        }),
      };
    }

    const local = orchidORM(
      { db: db.$queryBuilder },
      {
        user: UserTable,
        profile: ProfileTable,
      },
    );

    let userId = 0;
    beforeAll(async () => {
      userId = await local.user.get('Id').insert(userData);
      await local.profile.insert({ ...profileData, UserId: userId });
    });

    describe('select', () => {
      it('should select record with computed', async () => {
        const q = local.profile.select({
          user: (q) =>
            q.user.select('sqlComputed', 'runtimeComputed', 'batchComputed'),
        });

        const res = await q;

        assertType<
          typeof res,
          {
            user:
              | {
                  sqlComputed: string;
                  runtimeComputed: string;
                  batchComputed: string;
                }
              | undefined;
          }[]
        >();

        expect(res).toEqual([
          {
            user: {
              sqlComputed: `${userData.Name} ${userData.UserKey}`,
              runtimeComputed: `${userId} ${userData.Name}`,
              batchComputed: `${userId} ${userData.Name}`,
            },
          },
        ]);
      });
    });
  });

  describe('scopes', () => {
    class UserTable extends BaseTable {
      readonly table = 'user';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        active: t.boolean(),
      }));

      scopes = this.setScopes({
        default: (q) => q.where({ active: true }),
        positiveId: (q) => q.where({ id: { gt: 0 } }),
      });
    }

    const local = orchidORM({ db: db.$queryBuilder }, { user: UserTable });

    it('should have a default scope and be able to use defined scope', async () => {
      const q = local.user.scope('positiveId');

      expectSql(
        q.toSQL(),
        `
          SELECT * FROM "user"
          WHERE ("user"."active" = $1)
            AND ("user"."id" > $2)
        `,
        [true, 0],
      );
    });
  });

  describe('softDelete', () => {
    class UserTable extends BaseTable {
      readonly table = 'user';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        deletedAt: t.timestamp().nullable(),
      }));

      readonly softDelete = true;
    }

    const local = orchidORM({ db: db.$queryBuilder }, { user: UserTable });

    it('should filter records by `deletedAt`, add `includeDeleted` and `hardDelete` methods', () => {
      expectSql(
        local.user.toSQL(),
        `
          SELECT * FROM "user" WHERE ("user"."deletedAt" IS NULL)
        `,
      );

      expectSql(
        local.user.includeDeleted().toSQL(),
        `
          SELECT * FROM "user"
        `,
      );

      expectSql(
        local.user.all().hardDelete().toSQL(),
        `
          DELETE FROM "user"
        `,
      );
    });
  });
});
