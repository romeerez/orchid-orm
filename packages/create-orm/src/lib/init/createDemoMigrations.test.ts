import fs from 'fs/promises';
import { initSteps } from '../init';
import { resolve } from 'path';
import { mockFn, testInitConfig } from '../../testUtils';

const migrationsPath = resolve(testInitConfig.dbDirPath, 'migrations');

const mkdir = mockFn(fs, 'mkdir');
const writeFile = mockFn(fs, 'writeFile');

describe('createDemoMigrations', () => {
  beforeEach(jest.resetAllMocks);

  it('should create migrations directory', async () => {
    await initSteps.createDemoMigrations(testInitConfig);

    expect(mkdir).toBeCalledWith(migrationsPath, { recursive: true });
  });

  it('should create migrations if demoTables specified', async () => {
    await initSteps.createDemoMigrations({
      ...testInitConfig,
      demoTables: true,
    });

    const postCall = writeFile.mock.calls.find(([to]) =>
      (to as string).endsWith('create-post.ts'),
    );
    expect(postCall?.[1]).toBe(`import { change } from '../db-script';

change(async (db) => {
  await db.createTable('post', (t) => ({
    id: t.identity().primaryKey(),
    title: t.text().unique(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
`);

    const commentCall = writeFile.mock.calls.find(([to]) =>
      (to as string).endsWith('create-comment.ts'),
    );
    expect(commentCall?.[1]).toBe(`import { change } from '../db-script';

change(async (db) => {
  await db.createTable('comment', (t) => ({
    id: t.identity().primaryKey(),
    postId: t.integer().foreignKey('post', 'id').index(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
`);
  });
});
