import { testDb } from 'test-utils';

describe('columnType', () => {
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
