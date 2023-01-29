import { createBaseTable } from './table';
import { orchidORM } from './orm';
import { adapter, db } from './test-utils/test-db';
import { assertType, userData, useTestDatabase } from './test-utils/test-utils';
import { ColumnType, Operators } from 'pqb';
import { BaseTable } from './test-utils/test-tables';

describe('table', () => {
  useTestDatabase();

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
        table = 'user';
        columns = this.setColumns((t) => ({
          id: t.type().primaryKey(),
          createdAt: t.type(),
        }));
      }

      const { user } = orchidORM(
        { adapter },
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
        table = 'user';
        columns = this.setColumns((t) => ({
          id: t.serial().primaryKey(),
          createdAt: t.timestamp(),
        }));
      }

      const { user } = orchidORM(
        { adapter },
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
          serial: t.serial,
          timestamp() {
            return t.timestamp().parse((input) => new Date(input));
          },
        }),
      });

      class UserTable extends BaseTable {
        table = 'user';
        columns = this.setColumns((t) => ({
          id: t.serial().primaryKey(),
          createdAt: t.timestamp(),
        }));
      }

      const { user } = orchidORM(
        { adapter },
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
        table = 'user';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          name: t.text(),
        }));
      }

      orchidORM(
        {
          adapter,
        },
        {
          user: UserTable,
        },
      );
    });
  });
});
