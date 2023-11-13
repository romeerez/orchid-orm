import fs from 'fs/promises';
import { resolve } from 'path';
import { initSteps } from '../init';
import { mockFn, testInitConfig } from '../../testUtils';

const dbPath = resolve(testInitConfig.dbDirPath, 'db.ts');

const writeFile = mockFn(fs, 'writeFile');

describe('setupMainDb', () => {
  beforeEach(jest.resetAllMocks);

  it('should create db.ts', async () => {
    await initSteps.setupMainDb(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === dbPath);
    expect(call?.[1]).toBe(`import { orchidORM } from 'orchid-orm';
import { config } from './config';

export const db = orchidORM(config.database, {
});
`);
  });

  it('should create db.ts with demo tables', async () => {
    await initSteps.setupMainDb({
      ...testInitConfig,
      demoTables: true,
    });

    const call = writeFile.mock.calls.find(([to]) => to === dbPath);
    expect(call?.[1]).toBe(`import { orchidORM } from 'orchid-orm';
import { config } from './config';
import { PostTable } from './tables/post.table';
import { CommentTable } from './tables/comment.table';

export const db = orchidORM(config.database, {
  post: PostTable,
  comment: CommentTable,
});
`);
  });
});
