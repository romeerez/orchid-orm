import { createModel } from './model';
import { porm } from './orm';
import { adapter, db } from './test-utils/test-db';
import {
  AssertEqual,
  userData,
  useTestDatabase,
} from './test-utils/test-utils';
import { columnTypes, TimestampColumn } from 'pqb';

describe('model', () => {
  useTestDatabase();

  describe('overriding column types', () => {
    it('should return date as string by default', async () => {
      await db.user.insert(userData);

      const Model = createModel();
      class UserModel extends Model {
        table = 'user';
        columns = this.setColumns((t) => ({
          createdAt: t.timestamp() as TimestampColumn,
        }));
      }

      const { user } = porm(
        { adapter },
        {
          user: UserModel,
        },
      );

      const result = await user.get('createdAt');
      expect(typeof result).toBe('string');

      const eq: AssertEqual<typeof result, string> = true;
      expect(eq).toBe(true);
    });

    it('should return date as Date when overridden', async () => {
      await db.user.insert(userData);

      const Model = createModel({
        columnTypes: {
          timestamp() {
            return columnTypes.timestamp().parse((input) => new Date(input));
          },
        },
      });

      class UserModel extends Model {
        table = 'user';
        columns = this.setColumns((t) => ({
          createdAt: t.timestamp(),
        }));
      }

      const { user } = porm(
        { adapter },
        {
          user: UserModel,
        },
      );

      const result = await user.get('createdAt');
      expect(result instanceof Date).toBe(true);

      const eq: AssertEqual<typeof result, Date> = true;
      expect(eq).toBe(true);
    });
  });
});
