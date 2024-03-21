import { Adapter } from 'pqb';
import { introspectDbSchema } from './dbStructure';

const adapter = new Adapter({
  databaseURL: process.env.PG_URL,
});

describe('dbStructure', () => {
  afterAll(() => adapter.close());

  it('should perform working queries', async () => {
    await introspectDbSchema(adapter);
  });
});
