import config from '../../rollup.config.mjs';
import { rollupExportFile } from '../../rollup.utils.mjs';

export default [
  ...config,
  ...rollupExportFile('src/codegen/index', 'codegen/index'),
];
