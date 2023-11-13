import esbuild from 'rollup-plugin-esbuild';
import { rollupExportFile } from "../../rollup.utils.mjs";
import executable from "rollup-plugin-executable"

export default [
  ...rollupExportFile('src/lib', 'dist/lib'),
  {
    input: 'src/bin.ts',
    plugins: [esbuild(), executable()],
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
