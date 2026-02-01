import { db, TestAdapter, TestTransactionAdapter } from 'test-utils';
import { ColumnsShape, Query, testTransaction } from 'pqb';

const tableJsonBuildObject = (table: Query) => {
  const cache: { [key: string]: string } = {};
  return (t: string) =>
    (cache[t] ??= `json_build_object(${table.q
      .selectAllColumns!.map((c) => {
        const [, name] = c.split(' ');
        return `${name.replaceAll('"', "'")}, ${t}.${name}${
          (table.shape as ColumnsShape)[name.slice(1, -1)]?.data.jsonCast
            ? '::text'
            : ''
        }`;
      })
      .join(', ')})`);
};

const tableRowToJSON = (table: Query) => {
  const cache: { [key: string]: string } = {};
  const jsonBuildObject = tableJsonBuildObject(table);
  return (t: string) =>
    (cache[
      t
    ] ??= `CASE WHEN to_jsonb("${t}") IS NULL THEN NULL ELSE ${jsonBuildObject(
      `"${t}"`,
    )} END`);
};

export const userRowToJSON = tableRowToJSON(db.user);

export const userJsonBuildObject = tableJsonBuildObject(db.user);

export const userSelectAliasedAs = (t: string) =>
  Object.keys(db.user.q.selectAllShape)
    .map((c) => `"${t}"."${c}"`)
    .join(', ');

export const userSelectAs = (t: string) =>
  `"${t}".${db.user.q.selectAllColumns!.join(`, "${t}".`)}`;

export const messageSelectAll = db.message.q.selectAllColumns!.join(', ');

export const messageRowToJSON = tableRowToJSON(db.message);

export const messageJSONBuildObject = tableJsonBuildObject(db.message);

export const chatSelectAll = db.chat.q.selectAllColumns!.join(', ');

export const postSelectAll = db.post.q.selectAllColumns!.join(', ');

export const postTagSelectAll = db.postTag.q.selectAllColumns!.join(', ');

export const postTagSelectTableAll = (t: string) =>
  db.postTag.q.selectAllColumns!.map((c) => `"${t}".${c}`).join(', ');

export const categorySelectAll = db.category.q.selectAllColumns!.join(', ');

export const useRelationCallback = <T extends Query>(
  rel: { query: T },
  selectArr: (keyof T['shape'])[],
) => {
  const select = new Set(selectArr);

  const beforeCreate = jest.fn();
  const afterCreate = jest.fn();
  const beforeUpdate = jest.fn();
  const afterUpdate = jest.fn();
  const beforeDelete = jest.fn();
  const afterDelete = jest.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = rel.query.q as any;

  beforeAll(() => {
    q.beforeCreate = [beforeCreate];
    q.afterCreate = [afterCreate];
    q.afterCreateSelect = select;
    q.beforeUpdate = [beforeUpdate];
    q.afterUpdate = [afterUpdate];
    q.afterUpdateSelect = select;
    q.beforeDelete = [beforeDelete];
    q.afterDelete = [afterDelete];
    q.afterDeleteSelect = select;
  });

  afterAll(() => {
    delete q.beforeCreate;
    delete q.afterCreate;
    delete q.afterCreateSelect;
    delete q.beforeUpdate;
    delete q.afterUpdate;
    delete q.afterUpdateSelect;
    delete q.beforeDelete;
    delete q.afterDelete;
    delete q.afterDeleteSelect;
  });

  return {
    beforeCreate,
    afterCreate,
    beforeUpdate,
    afterUpdate,
    beforeDelete,
    afterDelete,
    resetMocks() {
      beforeCreate.mockReset();
      afterCreate.mockReset();
      beforeUpdate.mockReset();
      afterUpdate.mockReset();
      beforeDelete.mockReset();
      afterDelete.mockReset();
    },
  };
};

export const useTestORM = () => {
  beforeAll(async () => {
    await testTransaction.start(db);
  });

  beforeEach(async () => {
    await testTransaction.start(db);
  });

  afterEach(async () => {
    await testTransaction.rollback(db);
  });

  afterAll(async () => {
    await testTransaction.close(db);
  });
};

export const useQueryCounter = () => {
  const resetQueriesCount = () => querySpies?.forEach((spy) => spy.mockClear());

  const getQueriesCount = () => {
    if (!querySpies) {
      throw new Error('Must use useQueryCounter');
    }

    return querySpies.reduce((acc, spy) => acc + spy.mock.calls.length, 0);
  };

  const querySpies = [
    jest.spyOn(TestAdapter.prototype, 'query'),
    jest.spyOn(TestAdapter.prototype, 'arrays'),
    jest.spyOn(TestTransactionAdapter.prototype, 'query'),
    jest.spyOn(TestTransactionAdapter.prototype, 'arrays'),
  ];

  beforeEach(resetQueriesCount);

  return {
    resetQueriesCount,
    getQueriesCount,
  };
};
