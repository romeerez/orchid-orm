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
  ...rolldownExportFile('src/adapters/node-postgres', 'dist/node-postgres', {
    forbidImportFrom: src,
  }),
  ...rolldownExportFile('src/adapters/postgres-js', 'dist/postgres-js', {
    forbidImportFrom: src,
  }),
  ...rolldownExportFile('src/adapters/bun', 'dist/bun', {
    forbidImportFrom: src,
  }),
];
