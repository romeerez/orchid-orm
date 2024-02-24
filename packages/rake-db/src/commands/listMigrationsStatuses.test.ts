import { listMigrationsStatuses } from './listMigrationsStatuses';
import { testConfig } from '../rake-db.test-utils';
import path from 'path';
import { getMigratedVersionsMap } from '../migration/manageMigratedVersions';
import { asMock } from 'test-utils';
import { getMigrations } from '../common';

jest.mock('../common');
jest.mock('../migration/manageMigratedVersions');

// const options = { databaseURL: 'postgres://user@localhost/dbname' };
const options = [{ databaseURL: 'postgres://romeo:@localhost/orchid-orm' }];

describe('listMigrationsStatuses', () => {
  it('should log a list of migrations', async () => {
    const config = {
      ...testConfig,
      migrationsPath: path.resolve('app', 'migrations'),
      log: { colors: false },
    };

    asMock(getMigrations).mockResolvedValueOnce([
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
    ]);

    asMock(getMigratedVersionsMap).mockResolvedValueOnce({
      '0001': true,
      '0002': true,
      '0003': false,
    });

    await listMigrationsStatuses(options, config, []);

    expect(config.logger.log).toBeCalledWith(` Database: orchid-orm

 Status | Migration ID | Name
------------------------------------------
   Up   | 0001         | First migration
   Up   | 0002         | Second migration
  Down  | 0003         | Third migration
------------------------------------------`);
  });

  it('should log a list of migrations with path to a migration when passing `p` argument', async () => {
    const config = {
      ...testConfig,
      migrationsPath: path.resolve('app', 'migrations'),
      log: { colors: false },
    };

    asMock(getMigrations).mockResolvedValueOnce([
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
    ]);

    asMock(getMigratedVersionsMap).mockResolvedValueOnce({
      '0001': true,
      '0002': true,
      '0003': false,
    });

    await listMigrationsStatuses(options, config, ['p']);

    expect(config.logger.log).toBeCalledWith(` Database: orchid-orm

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
