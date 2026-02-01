import { readdir } from 'fs/promises';
import path from 'path';
import { getMigrations, sortMigrationsAsc } from './migrations-set';
import { testConfig } from '../rake-db.test-utils';
import { asMock } from 'test-utils';

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
}));

const config = testConfig;

const migrationPath = (name: string) =>
  path.resolve(__dirname, '..', '..', 'migrations-path', name);

const arrange = (arg: { files?: string[] }) => {
  if (arg.files) {
    asMock(readdir).mockReturnValueOnce(
      Promise.resolve(
        arg.files.map((file) => ({
          path: file,
          name: file,
          isFile: () => true,
        })),
      ),
    );
  }
};

describe('migrationsSet', () => {
  describe('getMigrations', () => {
    it('should return migrations from a specified directory path', async () => {
      const files = [`0001_a.ts`, `0002_b.ts`, `0003_c.ts`];

      arrange({ files: [`0001_a.ts`, `0002_b.ts`, `0003_c.ts`] });

      const { migrations } = await getMigrations({}, config, true);
      expect(migrations).toEqual(
        files.map((file, i) => ({
          path: path.resolve(config.migrationsPath, file),
          version: `000${i + 1}`,
          load: expect.any(Function),
        })),
      );
    });

    it('should return migrations from an object with migrations', async () => {
      const fn1 = async () => {};
      const fn2 = async () => {};

      const migrations = {
        [`0001_a.ts`]: fn1,
        [`0002_b.ts`]: fn2,
      };

      const result = await getMigrations({}, { ...config, migrations }, true);
      expect(result.migrations).toEqual([
        {
          path: path.resolve(__dirname, '..', `0001_a.ts`),
          version: '0001',
          load: fn1,
        },
        {
          path: path.resolve(__dirname, '..', `0002_b.ts`),
          version: '0002',
          load: fn2,
        },
      ]);
    });

    it('should return migrations in a reverse order from an object with migrations for a rollback', async () => {
      const migrations = {
        [`0001_a.ts`]: async () => {},
        [`0002_b.ts`]: async () => {},
      };

      const result = await getMigrations({}, { ...config, migrations }, false);
      expect(result.migrations.map((item) => item.path)).toEqual([
        path.resolve(__dirname, '..', `0002_b.ts`),
        path.resolve(__dirname, '..', `0001_a.ts`),
      ]);
    });

    it('should return empty array on error', async () => {
      asMock(readdir).mockRejectedValue(new Error());

      const result = await getMigrations({}, config, true);
      expect(result.migrations).toEqual([]);
    });

    it('should skip files (or dirs) without extension', async () => {
      asMock(readdir).mockRejectedValue([
        { path: 'path', isFile: () => false },
      ]);

      const result = await getMigrations({}, config, true);
      expect(result.migrations).toEqual([]);
    });

    it('should throw if file is not a .ts, .js, and .mjs file', async () => {
      arrange({ files: ['123_file.c'] });

      await expect(getMigrations({}, config, true)).rejects.toThrow(
        'Only .ts, .js, and .mjs files are supported',
      );
    });

    it('should throw on improper version', async () => {
      arrange({ files: ['123_file.ts'] });

      await expect(getMigrations({}, config, true)).rejects.toThrow(
        'Migration file name should start with 4 digit serial number, received 123_file.ts',
      );
    });

    it('should throw on improper version for timestamp', async () => {
      arrange({ files: ['123_file.ts'] });

      await expect(
        getMigrations({}, { ...config, migrationId: 'timestamp' }, true),
      ).rejects.toThrow(
        'Migration file name should start with 14 digit timestamp, received 123_file.ts',
      );
    });

    it('should throw when found duplicated version in migrations object', async () => {
      const migrations = {
        [`0001_a.ts`]: async () => {},
        [`0001_b.ts`]: async () => {},
      };

      await expect(
        getMigrations({}, { ...config, migrations }, true),
      ).rejects.toThrow(
        `Migration 0001_b.ts has the same version as 0001_a.ts`,
      );
    });

    it('should throw when found duplicated version in files', async () => {
      arrange({ files: ['0001_a.ts', '0001_b.ts'] });

      await expect(getMigrations({}, config, true)).rejects.toThrow(
        `Migration file://${migrationPath(
          '0001_b.ts',
        )} has the same version as file://${migrationPath('0001_a.ts')}`,
      );
    });
  });

  describe('sortAsc', () => {
    it('should sort ascending', () => {
      expect(
        ['12', '110', '9']
          .map((version) => ({ version }))
          .sort(sortMigrationsAsc),
      ).toEqual(['9', '12', '110'].map((version) => ({ version })));
    });
  });
});
