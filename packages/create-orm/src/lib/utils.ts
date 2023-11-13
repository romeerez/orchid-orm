import fs from 'fs/promises';
import { basename, join } from 'path';
import https from 'https';
import { InitConfig } from '../lib';

export async function readFileSafe(path: string) {
  try {
    return await fs.readFile(path, 'utf-8');
  } catch (err) {
    if ((err as unknown as { code: string }).code === 'ENOENT') {
      return undefined;
    }
    throw err;
  }
}

export function makeFileTimeStamp(now: Date): string {
  return [
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ]
    .map((value) => (value < 10 ? `0${value}` : value))
    .join('');
}

export async function createSeed(
  config: InitConfig,
  dirPath: string,
): Promise<void> {
  const filePath = join(dirPath, 'seed.ts');

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

export type DependencyKind = 'dependencies' | 'devDependencies';
export function getLatestPackageVersion(
  name: string,
  kind: DependencyKind,
): Promise<[string, { version: string; kind: DependencyKind }]> {
  return new Promise((resolve, reject) => {
    https
      .get(`https://registry.npmjs.org/${name}/latest`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve([name, { version: `^${JSON.parse(data).version}`, kind }]),
        );
      })
      .on('error', reject);
  });
}

export function getPackageManagerName(): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  const { npm_execpath } = process.env;
  if (npm_execpath) {
    const name = basename(npm_execpath);
    if (/npm/.test(name)) {
      return 'npm';
    }
    if (/yarn/.test(name)) {
      return 'yarn';
    }
    if (/bun/.test(name)) {
      return 'bun';
    }
  }

  return 'pnpm';
}
