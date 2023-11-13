import { join } from 'path';
import fs from 'fs/promises';
import { InitConfig } from '../../lib';

export async function createDemoSeed(config: InitConfig): Promise<void> {
  const filePath = join(config.dbDirPath, 'seed.ts');

  let content;
  if (config.demoTables) {
    content = `await db.post.findBy({ title: 'Sample post' }).orCreate({
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
  });`;
  } else {
    content = `// create records here`;
  }

  await fs.writeFile(
    filePath,
    `import { db } from './db';

export const seed = async () => {
  ${content}

  await db.$close();
};
`,
  );
}
