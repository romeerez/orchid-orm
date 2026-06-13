import { rolldownExportFile } from '../../rolldown.utils.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from './package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const src = join(__dirname, 'src');

/** @type {import('rolldown').RolldownOptions[]} */
export default [
  ...rolldownExportFile('src/index', 'dist/index', {
    forbidImportFrom: packageJson.name,
  }),
  ...rolldownExportFile('src/public', 'dist/public', {
    externalForFiles: [
      {
        from: join(src, 'public.ts'),
        id: join(src, 'index.ts'),
      },
      {
        from: join(src, 'public.d.ts'),
        id: join(src, 'index.d.ts'),
      },
    ],
    forbidImportFrom: packageJson.name,
    overrideDtsImportPaths: new Map([
      [join(src, 'index.d.ts'), './index.d.ts'],
    ]),
  }),
  ...rolldownExportFile('src/internal', 'dist/internal', {
    externalForFiles: [
      {
        from: join(src, 'internal.ts'),
        id: join(src, 'index.ts'),
      },
      {
        from: join(src, 'internal.d.ts'),
        id: join(src, 'index.d.ts'),
      },
    ],
    forbidImportFrom: packageJson.name,
  }),
  ...rolldownExportFile('src/adapters/node-postgres', 'dist/node-postgres', {
    allowImportFrom: join(src, 'adapters'),
    forbidImportFrom: src,
  }),
  ...rolldownExportFile('src/adapters/postgres-js', 'dist/postgres-js', {
    allowImportFrom: join(src, 'adapters'),
    forbidImportFrom: src,
  }),
  ...rolldownExportFile('src/adapters/bun', 'dist/bun', {
    allowImportFrom: join(src, 'adapters'),
    forbidImportFrom: src,
  }),
];
