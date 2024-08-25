import { testDb } from 'test-utils';

describe('columnType', () => {
  describe('default', () => {
    it('should accept `inputType` that may be overridden by `encode`', () => {
      testDb('user', (t) => ({
        id: t.identity().primaryKey(),
        balance: t
          .decimal()
          .encode((value: string | number) => '100' + String(value))
          // the column `type` is `string`, but default should accept `inputType` = `string | number`
          .default(500),
      }));
    });
  });

  describe('hasDefault', () => {
    it('should allow omitting the column from create', () => {
      const User = testDb('user', (t) => ({
        id: t.identity().primaryKey(),
        name: t.text().hasDefault(),
      }));

      User.create({});
    });
  });
});
