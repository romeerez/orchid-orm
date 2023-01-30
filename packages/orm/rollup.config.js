import config from '../../rollup.config';
import esbuild from 'rollup-plugin-esbuild';

export default [
  ...config,
  {
    input: 'src/bin/bin.ts',
    plugins: [esbuild()],
    output: [
      {
        file: 'dist/bin.js',
        format: 'cjs',
        sourcemap: true,
      },
    ],
  },
];
