import config from '../../rollup.config.mjs';
import esbuild from 'rollup-plugin-esbuild';
import { rollupExportFile } from '../../rollup.utils.mjs';

export default [
  ...config,
  ...rollupExportFile('src/codegen/index', 'codegen/index'),
  {
    input: 'src/bin/bin.ts',
    plugins: [esbuild()],
    output: [
      {
        banner: '#!/usr/bin/env node',
        file: 'dist/bin.js',
        format: 'cjs',
        sourcemap: true,
      },
    ],
  },
];
