import fs from 'fs/promises';
import { basename } from 'path';
import https from 'https';

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
