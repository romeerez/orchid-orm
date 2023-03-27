import { DbStructure } from './dbStructure';
import { Adapter } from 'pqb';

const adapter = new Adapter({
  databaseURL: process.env.PG_URL,
});

const db = new DbStructure(adapter);

describe('dbStructure', () => {
  afterAll(() => adapter.close());

  it('should perform working queries', async () => {
    await Promise.all([
      db.getSchemas(),
      db.getViews(),
      db.getColumns(),
      db.getIndexes(),
      db.getConstraints(),
      db.getExtensions(),
      db.getEnums(),
      db.getDomains(),
    ]);
  });
});
