import config from '../../rollup.config.mjs';
import esbuild from 'rollup-plugin-esbuild';

export default [
  ...config,
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
