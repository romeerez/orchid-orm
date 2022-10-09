import { generate } from './generate';
import { migrationConfigDefaults } from './common';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}));

const migrationsPath = migrationConfigDefaults.migrationsPath;

const testGenerate = async (args: string[], content: string) => {
  const name = args[0];
  await generate(migrationConfigDefaults, args);

  expect(mkdir).toHaveBeenCalledWith(migrationsPath, { recursive: true });
  expect(writeFile).toHaveBeenCalledWith(
    path.resolve(migrationsPath, `20000101000000_${name}.ts`),
    content,
  );
};

describe('generate', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2000, 0, 1, 0, 0, 0));
    jest.clearAllMocks();
  });

  it('should throw if migration name is not provided', async () => {
    expect(generate(migrationConfigDefaults, [])).rejects.toThrow(
      'Migration name is missing',
    );
  });

  it('should create a file for create table migration', async () => {
    await testGenerate(
      ['createTable', 'id:integer.primaryKey', 'name:varchar(20).nullable'],
      `import { change } from 'rake-db'

change(async (db) => {
  db.createTable('table', (t) => ({
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
      `import { change } from 'rake-db'

change(async (db) => {
  db.changeTable('table', (t) => ({
  }));
});
`,
    );
  });

  it('should create a file for add columns migration', async () => {
    await testGenerate(
      ['addColumns'],
      `import { change } from 'rake-db'

change(async (db) => {
  db.changeTable(tableName, (t) => ({
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
      `import { change } from 'rake-db'

change(async (db) => {
  db.changeTable('table', (t) => ({
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
      `import { change } from 'rake-db'

change(async (db) => {
  db.changeTable('table', (t) => ({
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
      `import { change } from 'rake-db'

change(async (db) => {
  db.dropTable('table', (t) => ({
    id: t.integer().primaryKey(),
    name: t.varchar(20).nullable(),
  }));
});
`,
    );
  });
});
