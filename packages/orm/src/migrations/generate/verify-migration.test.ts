import { promptSelect } from 'rake-db';
import { asMock } from 'test-utils';
import {
  defineTable,
  useGeneratorsTestUtils,
} from './generators/generators.test-utils';
import * as verifyMigrationModule from './verify-migration';

jest.mock('rake-db', () => ({
  ...jest.requireActual('../../../../rake-db/src'),
  migrate: jest.fn(),
  promptSelect: jest.fn(),
}));
jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('./verify-migration', () => ({
  verifyMigration: jest.fn(),
}));

const { verifyMigration } =
  jest.requireActual<typeof verifyMigrationModule>('./verify-migration');

describe('verifyMigration', () => {
  const { arrange, act } = useGeneratorsTestUtils();

  it('should fail instead of asking when a question remains after applying the migration', async () => {
    // verify an empty migration, so the answered question comes up again
    asMock(verifyMigrationModule.verifyMigration).mockImplementationOnce(
      (adapter, config, _code, params, roles, structureParams) =>
        verifyMigration(adapter, config, '', params, roles, structureParams),
    );

    await arrange({
      async prepareDb(db) {
        await db.createTable('table', { noPrimaryKey: true }, (t) => ({
          from: t.text(),
        }));
      },
      tables: [
        defineTable('table', { noPrimaryKey: true }, (t) => ({
          to: t.text(),
        })),
      ],
      selects: [1],
    });

    await expect(act()).rejects.toThrow('Failed to verify generated migration');

    expect(promptSelect).toHaveBeenCalledTimes(1);
  });
});
