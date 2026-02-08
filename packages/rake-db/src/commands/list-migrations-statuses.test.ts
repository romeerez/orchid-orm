import { listMigrationsStatuses } from './list-migrations-statuses';
import { testConfig } from '../rake-db.test-utils';
import path from 'path';
import { getMigratedVersionsMap } from '../migration/manage-migrated-versions';
import { asMock, TestAdapter } from 'test-utils';
import { getMigrations } from '../migration/migrations-set';

jest.mock('../migration/migrations-set');
jest.mock('../migration/manage-migrated-versions');

const options = [{ databaseURL: 'postgres://user@localhost/dbname' }];
const adapters = options.map((opts) => new TestAdapter(opts));

describe('listMigrationsStatuses', () => {
  it('should log a list of migrations', async () => {
    const config = {
      ...testConfig,
      migrationsPath: path.resolve('app', 'migrations'),
      log: { colors: false },
    };

    asMock(getMigrations).mockResolvedValueOnce({
      migrations: [
        {
          version: '0001',
          path: '/migrations/0001_first_migration',
        },
        {
          version: '0002',
          path: '/migrations/0002_second-migration',
        },
        {
          version: '0003',
          path: '/migrations/0003_thirdMigration',
        },
      ],
    });

    asMock(getMigratedVersionsMap).mockResolvedValueOnce({
      map: {
        '0001': 'First migration',
        '0002': 'Second migration',
      },
      sequence: ['0001', '0002'],
    });

    await listMigrationsStatuses(adapters, config);

    expect(config.logger.log).toBeCalledWith(` Database: dbname

 Status | Migration ID | Name
------------------------------------------
   Up   | 0001         | First migration
   Up   | 0002         | Second migration
  Down  | 0003         | Third migration
------------------------------------------`);
  });

  it('should log a list of migrations with path to a migration when called with showUrl', async () => {
    const config = {
      ...testConfig,
      migrationsPath: path.resolve('app', 'migrations'),
      log: { colors: false },
    };

    asMock(getMigrations).mockResolvedValueOnce({
      migrations: [
        {
          version: '0001',
          path: '/migrations/0001_first_migration',
        },
        {
          version: '0002',
          path: '/migrations/0002_second-migration',
        },
        {
          version: '0003',
          path: '/migrations/0003_thirdMigration',
        },
      ],
    });

    asMock(getMigratedVersionsMap).mockResolvedValueOnce({
      map: {
        '0001': 'First migration',
        '0002': 'Second migration',
      },
      sequence: ['0001', '0002'],
    });

    await listMigrationsStatuses(adapters, config, { showUrl: true });

    expect(config.logger.log).toBeCalledWith(` Database: dbname

 Status | Migration ID | Name
------------------------------------------
   Up   | 0001         | First migration
file:///migrations/0001_first_migration

   Up   | 0002         | Second migration
file:///migrations/0002_second-migration

  Down  | 0003         | Third migration
file:///migrations/0003_thirdMigration
------------------------------------------`);
  });
});
