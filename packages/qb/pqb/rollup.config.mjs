import config from '../../../rollup.config.mjs';
import { rollupExportFile } from '../../../rollup.utils.mjs';

export default [
  ...config,
  ...rollupExportFile('src/adapters/node-postgres', 'dist/node-postgres'),
  ...rollupExportFile('src/adapters/postgres-js', 'dist/postgres-js'),
];
