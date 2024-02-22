import { InitConfig } from '../../lib';
import { getLatestPackageVersion, readFileSafe } from '../utils';
import { join } from 'path';
import fs from 'fs/promises';

export async function setupPackageJSON(config: InitConfig): Promise<void> {
  const pairs = await Promise.all([
    getLatestPackageVersion('dotenv', 'dependencies'),
    getLatestPackageVersion('orchid-orm', 'dependencies'),
    config.validation === 'zod'
      ? getLatestPackageVersion('orchid-orm-schema-to-zod', 'dependencies')
      : config.validation === 'valibot'
      ? getLatestPackageVersion('orchid-orm-valibot', 'dependencies')
      : undefined,
    getLatestPackageVersion('rake-db', 'devDependencies'),
    config.addTestFactory &&
      getLatestPackageVersion('orchid-orm-test-factory', 'devDependencies'),
    getLatestPackageVersion('@types/node', 'devDependencies'),
    getLatestPackageVersion('typescript', 'devDependencies'),
    config.runner === 'vite-node' &&
      getLatestPackageVersion('vite', 'devDependencies'),
    config.runner !== 'bun' &&
      getLatestPackageVersion(config.runner, 'devDependencies'),
    config.runner === 'vite-node' &&
      getLatestPackageVersion(
        'rollup-plugin-node-externals',
        'devDependencies',
      ),
    config.runner === 'tsx' &&
      getLatestPackageVersion('esbuild', 'devDependencies'),
    config.runner === 'tsx' &&
      getLatestPackageVersion('rimraf', 'devDependencies'),
  ]);

  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = {};
  for (const item of pairs) {
    if (!item) continue;
    const [key, { version, kind }] = item;
    (kind === 'dependencies' ? deps : devDeps)[key] = version;
  }

  const packageJsonPath = join(config.path, 'package.json');
  const content = await readFileSafe(packageJsonPath);
  let json = content
    ? JSON.parse(content)
    : {
        name: config.projectName,
      };

  if (config.esm) json = { name: json.name, type: 'module', ...json };

  const scripts = (json.scripts ??= {});

  if (config.runner === 'vite-node') {
    scripts.db = 'vite-node src/db/dbScript.ts --';
    scripts['build:migrations'] = 'vite build --config vite.migrations.mts';
    scripts['db:compiled'] = 'node dist/db/dbScript.mjs';
  } else if (config.runner === 'tsx') {
    scripts.db = 'NODE_ENV=development tsx src/db/dbScript.ts';
    scripts['build:migrations'] =
      'rimraf dist/db && node esbuild.migrations.mjs';
    scripts['db:compiled'] = 'NODE_ENV=production node dist/db/dbScript.mjs';
  } else {
    scripts.db = `${config.runner} src/db/dbScript.ts`;

    if (config.runner === 'ts-node') {
      scripts.build = 'tsc';
      scripts['db:compiled'] = 'node dist/dbScript.js';
    }
  }

  if (!json.dependencies) json.dependencies = {};

  for (const key in deps) {
    json.dependencies[key] = deps[key];
  }

  if (!json.devDependencies) json.devDependencies = {};
  for (const key in devDeps) {
    json.devDependencies[key] = devDeps[key];
  }

  await fs.writeFile(packageJsonPath, JSON.stringify(json, null, '  ') + '\n');
}
