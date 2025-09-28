import config from '../../rollup.config.mjs';
import { rollupExportFile } from '../../rollup.utils.mjs';

export default [
  ...config,
  ...rollupExportFile('src/adapters/node-postgres', 'dist/node-postgres'),
  ...rollupExportFile('src/adapters/postgres-js', 'dist/postgres-js'),
  ...rollupExportFile(
    'src/migrations/adapters/node-postgres',
    'dist/migrations/node-postgres',
  ),
  ...rollupExportFile(
    'src/migrations/adapters/postgres-js',
    'dist/migrations/postgres-js',
  ),
];
