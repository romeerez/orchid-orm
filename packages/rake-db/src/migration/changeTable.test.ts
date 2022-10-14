import { expectSql, getDb, resetDb, setDbDown } from '../test-utils';

const db = getDb();

describe('changeTable', () => {
  beforeEach(resetDb);

  it('should set comment', async () => {
    const fn = () => {
      return db.changeTable('table', { comment: 'comment' }, () => ({}));
    };

    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'comment'`);

    setDbDown();
    await fn();
    expectSql(`COMMENT ON TABLE "table" IS NULL`);
  });

  it('should change comment', async () => {
    const fn = () => {
      return db.changeTable('table', { comment: ['old', 'new'] }, () => ({}));
    };

    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'new'`);

    setDbDown();
    await fn();
    expectSql(`COMMENT ON TABLE "table" IS 'old'`);
  });
});
