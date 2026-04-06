import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';

export const rollupExportFile = (from, to, external) => [
  {
    input: `${from}.ts`,
    plugins: [esbuild()],
    external,
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
    external,
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
    external,
    output: {
      file: `${to}.d.ts`,
      format: 'es',
    },
  },
];
