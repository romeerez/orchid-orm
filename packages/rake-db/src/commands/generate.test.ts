import { generate } from './generate';
import { migrationConfigDefaults, RakeDbConfig } from '../common';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}));

const logMock = jest.fn();
console.log = logMock;

const migrationsPath = migrationConfigDefaults.migrationsPath;

const config: RakeDbConfig = {
  ...migrationConfigDefaults,
  basePath: __dirname,
};

const testGenerate = async (args: string[], content: string) => {
  const name = args[0];
  await generate(config, args);

  expect(mkdir).toHaveBeenCalledWith(migrationsPath, { recursive: true });

  const filePath = path.resolve(migrationsPath, `20000101000000_${name}.ts`);
  expect(writeFile).toHaveBeenCalledWith(filePath, content);

  expect(logMock.mock.calls).toEqual([[`Created ${filePath}`]]);
};

describe('generate', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2000, 0, 1, 0, 0, 0));
    jest.clearAllMocks();
  });

  it('should throw if migration name is not provided', async () => {
    expect(generate(config, [])).rejects.toThrow('Migration name is missing');
  });

  it('should create a file for create table migration', async () => {
    await testGenerate(
      ['createTable', 'id:integer.primaryKey', 'name:varchar(20).nullable'],
      `import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.integer().primaryKey(),
    name: t.varchar(20).nullable(),
  }));
});
`,
    );
  });

  it('should create a file for change migration', async () => {
    await testGenerate(
      ['changeTable'],
      `import { change } from 'rake-db';

change(async (db) => {
  await db.changeTable('table', (t) => ({
  }));
});
`,
    );
  });

  it('should create a file for add columns migration', async () => {
    await testGenerate(
      ['addColumns'],
      `import { change } from 'rake-db';

change(async (db) => {
  await db.changeTable(tableName, (t) => ({
  }));
});
`,
    );
  });

  it('should create a file for add columns migration with table', async () => {
    await testGenerate(
      [
        'addColumnsToTable',
        'id:integer.primaryKey',
        'name:varchar(20).nullable',
      ],
      `import { change } from 'rake-db';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    id: t.add(t.integer().primaryKey()),
    name: t.add(t.varchar(20).nullable()),
  }));
});
`,
    );
  });

  it('should create a file for remove columns migration with table', async () => {
    await testGenerate(
      [
        'removeColumnsFromTable',
        'id:integer.primaryKey',
        'name:varchar(20).nullable',
      ],
      `import { change } from 'rake-db';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    id: t.remove(t.integer().primaryKey()),
    name: t.remove(t.varchar(20).nullable()),
  }));
});
`,
    );
  });

  it('should create a file for drop table migration', async () => {
    await testGenerate(
      ['dropTable', 'id:integer.primaryKey', 'name:varchar(20).nullable'],
      `import { change } from 'rake-db';

change(async (db) => {
  await db.dropTable('table', (t) => ({
    id: t.integer().primaryKey(),
    name: t.varchar(20).nullable(),
  }));
});
`,
    );
  });
});
