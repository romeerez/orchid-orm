import { rebase } from './rebase';
import { testConfig } from '../rake-db.test-utils';
import { AnyRakeDbConfig } from '../config';
import fs from 'fs/promises';
import path from 'path';
import { asMock, TestAdapter } from 'test-utils';
import {
  getMigratedVersionsMap,
  RakeDbAppliedVersions,
} from '../migration/manageMigratedVersions';
import { getMigrationVersionOrThrow } from '../migration/migrationsSet';
import { AdapterBase, RecordString } from 'orchid-core';
import { pushChange } from '../migration/change';
import { promptSelect } from '../prompt';

jest.mock('fs/promises');
jest.mock('../migration/manageMigratedVersions');
jest.mock('../prompt');
jest.mock('../common', () => ({
  transaction(adapter: AdapterBase, fn: (adapter: AdapterBase) => unknown) {
    return fn(adapter);
  },
  queryLock: () => {},
}));

const options = [
  { databaseURL: 'postgres://user@localhost/dbname' },
  { databaseURL: 'postgres://user@localhost/dbname-test' },
];

const adapters = options.map((opts) => new TestAdapter(opts));

const dbChanges: { name: string; up: boolean; count: number }[] = [];

let migrationsMap: RakeDbAppliedVersions = { map: {}, sequence: [] };

const defaultConfig = {
  ...testConfig,
  import: (filePath: string) => {
    pushChange({
      fn: async (_, up) => {
        const name = path.basename(filePath);

        const change = dbChanges.find(
          (change) => change.name === name && change.up === up,
        );
        if (change) {
          change.count++;
        } else {
          dbChanges.push({ name, up, count: 1 });
        }
      },
      config,
    });
  },
} as AnyRakeDbConfig;

let config = defaultConfig;

const arrange = (arg: {
  config?: Partial<AnyRakeDbConfig>;
  files?: string[];
  migrated?: string[];
  promptResponses?: ('first' | 'second')[];
}) => {
  dbChanges.length = 0;

  config = arg.config ? { ...defaultConfig, ...arg.config } : defaultConfig;

  asMock(fs.readdir).mockResolvedValueOnce(
    arg.files?.map((name) => ({ path: name, name, isFile: () => true })) ?? [],
  );

  const versions =
    arg.migrated &&
    arg.migrated.map((name) => [
      getMigrationVersionOrThrow(config, name),
      name,
    ]);

  migrationsMap = versions
    ? {
        map: Object.fromEntries(versions),
        sequence: versions.map(([version]) => +version),
      }
    : { map: {}, sequence: [] };

  asMock(getMigratedVersionsMap).mockResolvedValueOnce(migrationsMap);
  asMock(getMigratedVersionsMap).mockResolvedValueOnce({
    map: { ...migrationsMap.map },
    sequence: [...migrationsMap.sequence],
  });

  asMock(getMigratedVersionsMap).mockResolvedValueOnce(migrationsMap);
  asMock(getMigratedVersionsMap).mockResolvedValueOnce({
    map: { ...migrationsMap.map },
    sequence: [...migrationsMap.sequence],
  });

  if (arg.promptResponses) {
    for (const file of arg.promptResponses) {
      asMock(promptSelect).mockResolvedValueOnce(file === 'first' ? 0 : 1);
    }
  }
};

const act = () => rebase(adapters, config);

const assert = {
  moved(map: RecordString) {
    expect(
      asMock(fs.rename).mock.calls.map(([key, value]) => [
        path.basename(key),
        path.basename(value),
      ]),
    ).toEqual(Object.entries(map).reverse());
  },

  migrated(arr: [name: string, dir: 'up' | 'down'][]) {
    expect(dbChanges).toEqual(
      arr.map(([name, dir]) => ({ name, up: dir === 'up', count: 2 })),
    );
  },
};

describe('rebase', () => {
  beforeEach(jest.resetAllMocks);

  it('should throw when migrations are set directly in the config', async () => {
    arrange({
      config: {
        migrations: {},
      },
    });

    await expect(act()).rejects.toThrow(
      'Cannot rebase migrations defined in the config',
    );
  });

  it('should throw for timestamp migration id', async () => {
    arrange({
      config: {
        migrationId: 'timestamp',
      },
    });

    await expect(act()).rejects.toThrow(
      `Cannot rebase when the 'migrationId' is set to 'timestamp' in the config`,
    );
  });

  it('should shift conflicting file', async () => {
    arrange({
      files: ['0001_a.ts', '0001_b.ts', '0002_c.ts'],
      migrated: ['0001_a.ts'],
    });

    await act();

    assert.moved({
      '0001_a.ts': '0003_a.ts',
    });

    assert.migrated([
      ['0001_a.ts', 'down'],
      ['0001_b.ts', 'up'],
      ['0002_c.ts', 'up'],
      ['0003_a.ts', 'up'],
    ]);
  });

  it('should shift multiple conflicting files and all further files', async () => {
    arrange({
      files: ['0001_a.ts', '0001_b.ts', '0002_c.ts', '0002_d.ts'],
      migrated: ['0001_a.ts', '0002_c.ts'],
    });

    await act();

    assert.moved({
      '0001_a.ts': '0003_a.ts',
      '0002_c.ts': '0004_c.ts',
    });

    assert.migrated([
      ['0002_c.ts', 'down'],
      ['0001_a.ts', 'down'],
      ['0001_b.ts', 'up'],
      ['0002_d.ts', 'up'],
      ['0003_a.ts', 'up'],
      ['0004_c.ts', 'up'],
    ]);
  });

  it('should not shift migrated files if they are not conflicted', async () => {
    arrange({
      files: ['0001_a.ts', '0002_b.ts', '0003_c.ts', '0004_d.ts'],
      migrated: ['0001_a.ts', '0002_b.ts'],
    });

    await act();

    assert.moved({});

    assert.migrated([]);
  });

  it('should not shift not conflicted files and shift conflicted', async () => {
    arrange({
      files: ['0001_a.ts', '0002_b.ts', '0003_c.ts', '0003_d.ts', '0004_e.ts'],
      migrated: ['0001_a.ts', '0002_b.ts', '0003_c.ts'],
    });

    await act();

    assert.moved({
      '0003_c.ts': '0005_c.ts',
    });

    assert.migrated([
      ['0003_c.ts', 'down'],
      ['0003_d.ts', 'up'],
      ['0004_e.ts', 'up'],
      ['0005_c.ts', 'up'],
    ]);
  });

  it('should move first file by the prompt', async () => {
    arrange({
      files: ['0001_a.ts', '0001_b.ts', '0002_c.ts'],
      migrated: [],
      promptResponses: ['first'],
    });

    await act();

    assert.moved({
      '0001_a.ts': '0002_a.ts',
      '0002_c.ts': '0003_c.ts',
    });

    assert.migrated([
      ['0001_b.ts', 'up'],
      ['0002_a.ts', 'up'],
      ['0003_c.ts', 'up'],
    ]);
  });

  it('should move second file by the prompt', async () => {
    arrange({
      files: ['0001_a.ts', '0001_b.ts', '0002_c.ts'],
      migrated: [],
      promptResponses: ['second'],
    });

    await act();

    assert.moved({
      '0001_b.ts': '0002_b.ts',
      '0002_c.ts': '0003_c.ts',
    });

    assert.migrated([
      ['0001_a.ts', 'up'],
      ['0002_b.ts', 'up'],
      ['0003_c.ts', 'up'],
    ]);
  });

  it('should move multiple files', async () => {
    arrange({
      files: [
        '0001_a.ts',
        '0002_b.ts',
        '0002_c.ts',
        '0003_d.ts',
        '0003_e.ts',
        '0003_f.ts',
        '0004_g.ts',
      ],
      migrated: ['0002_b.ts', '0003_d.ts'],
      promptResponses: ['first'],
    });

    await act();

    assert.moved({
      '0003_e.ts': '0004_e.ts',
      '0004_g.ts': '0005_g.ts',
      '0002_b.ts': '0006_b.ts',
      '0003_d.ts': '0007_d.ts',
    });

    assert.migrated([
      ['0003_d.ts', 'down'],
      ['0002_b.ts', 'down'],
      ['0001_a.ts', 'up'],
      ['0002_c.ts', 'up'],
      ['0003_f.ts', 'up'],
      ['0004_e.ts', 'up'],
      ['0005_g.ts', 'up'],
      ['0006_b.ts', 'up'],
      ['0007_d.ts', 'up'],
    ]);
  });
});
