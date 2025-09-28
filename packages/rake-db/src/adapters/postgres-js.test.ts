import { makeConnectAndMigrate } from './postgres-js';
import { makeMigrateAdapter } from '../migration/migrate/migrate';
import { asMock } from 'test-utils';
import { AdapterBase } from 'orchid-core';

jest.mock('../migration/migrate/migrate', () => ({
  makeMigrateAdapter: jest.fn(),
}));

describe('postgres-js', () => {
  describe('makeConnectAndMigrate', () => {
    it('should instantiate adapters and call makeMigrateAdapterFn', async () => {
      const config = {};

      const migrateAdapter = jest.fn();
      asMock(makeMigrateAdapter).mockReturnValueOnce(migrateAdapter);

      const connectAndMigrate = makeConnectAndMigrate(config);
      expect(makeMigrateAdapter).toBeCalledWith(config);

      await connectAndMigrate([
        { databaseURL: 'postgres://user:pass@localhost:5432/db1' },
        { databaseURL: 'postgres://user:pass@localhost:5432/db2' },
      ]);

      expect(migrateAdapter).toHaveBeenCalledTimes(2);

      const adapters = migrateAdapter.mock.calls.map(
        (call) => call[0],
      ) as AdapterBase[];
      expect(adapters.map((adapter) => adapter.getDatabase())).toEqual([
        'db1',
        'db2',
      ]);
    });
  });
});
