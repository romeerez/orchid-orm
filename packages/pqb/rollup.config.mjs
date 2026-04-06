import config from '../../rollup.config.mjs';
import { rollupExportFile } from '../../rollup.utils.mjs';

const external = ['./index'];

export default [
  ...config,
  ...rollupExportFile('src/index', 'dist/index'),
  ...rollupExportFile('src/public', 'dist/public', external),
  ...rollupExportFile('src/internal', 'dist/internal', external),
  ...rollupExportFile(
    'src/adapters/node-postgres',
    'dist/node-postgres',
    external,
  ),
  ...rollupExportFile('src/adapters/postgres-js', 'dist/postgres-js', external),
];
