import { createBaseTable } from './table';
import { orchidORM } from './orm';
import { ColumnType, Operators } from 'pqb';
import { BaseTable, db, userData, useTestORM } from './test-utils/test-utils';
import path from 'path';
import { asMock } from './codegen/testUtils';
import { getCallerFilePath } from 'orchid-core';
import { assertType, testAdapter } from 'test-utils';

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

describe('table', () => {
  useTestORM();

  it('should have a name', () => {
    expect(BaseTable.name).toBe('BaseTable');
  });

  it('should have a filePath to indicate where is it defined', () => {
    expect(BaseTable.filePath).toBe(
      path.join(__dirname, 'test-utils', 'test-tables.ts'),
    );
  });

  it('should throw if cannot determine file path', () => {
    asMock(getCallerFilePath).mockReturnValueOnce(undefined);

    expect(() => createBaseTable()).toThrow('Failed to determine file path');
  });

  describe('overriding column types', () => {
    it('should have .raw with overridden types', () => {
      class Type extends ColumnType {
        dataType = 'type';
        operators = Operators.any;
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

      const value = user.raw((t) => t.type(), '');

      expect(value.__column).toBe(type);
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
});
