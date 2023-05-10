import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';

export const rollupExportFile = (from, to) => [
  {
    input: `${from}.ts`,
    plugins: [esbuild()],
    output: [
      {
        file: `${to}.js`,
        format: 'cjs',
        sourcemap: true,
      },
    ],
  },
  {
    input: `${from}.ts`,
    plugins: [esbuild()],
    output: [
      {
        file: `${to}.mjs`,
        format: 'es',
        sourcemap: true,
      },
    ],
  },
  {
    input: `${from}.ts`,
    plugins: [dts()],
    output: {
      file: `${to}.d.ts`,
      format: 'es',
    },
  },
];
