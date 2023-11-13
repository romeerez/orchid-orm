import fs from 'fs/promises';
import { initSteps } from '../init';
import { resolve } from 'path';
import { mockFn, testInitConfig } from '../../testUtils';

const seedPath = resolve(testInitConfig.dbDirPath, 'seed.ts');

const writeFile = mockFn(fs, 'writeFile');

describe('createDemoSeed', () => {
  beforeEach(jest.resetAllMocks);

  it('should create seed file', async () => {
    await initSteps.createDemoSeed(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === seedPath);
    expect(call?.[1]).toBe(`import { db } from './db';

export const seed = async () => {
  // create records here

  await db.$close();
};
`);
  });

  it('should create seed file with sample records when demoTables is set to true', async () => {
    await initSteps.createDemoSeed({
      ...testInitConfig,
      hasTsConfig: true,
      demoTables: true,
    });

    const call = writeFile.mock.calls.find(([to]) => to === seedPath);
    expect(call?.[1]).toBe(`import { db } from './db';

export const seed = async () => {
  await db.post.findBy({ title: 'Sample post' }).orCreate({
    title: 'Post',
    text: 'This is a text for a sample post. It contains words, spaces, and punctuation.',
    comments: {
      create: [
        {
          text: 'Nice post!',
        },
        {
          text: \`Too long, didn't read\`,
        },
      ],
    },
  });

  await db.$close();
};
`);
  });
});
