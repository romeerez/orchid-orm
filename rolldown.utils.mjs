import { dts } from 'rolldown-plugin-dts';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

const getCommonOptions = (from, to, options = {}) => {
  const packagePath = process.cwd();
  const packageJson = JSON.parse(
    fs.readFileSync(join(packagePath, 'package.json'), 'utf8'),
  );

  const packageRegExp = (name) => [
    new RegExp(`^${name}`),
    new RegExp(`packages/${name}`),
  ];

  const deps = (obj) => {
    return obj ? Object.keys(obj).flatMap((name) => packageRegExp(name)) : [];
  };

  const external = [
    new RegExp(`^${packageJson.name}`),
    ...deps(packageJson.dependencies),
    ...deps(packageJson.peerDependencies),
    /^node:/,
  ];

  const { allowImportFrom, externalForFiles, forbidImportFrom } = options;

  const common = {
    input: `${from}.ts`,
    external(id, fromFile) {
      const allowed = allowImportFrom && id.startsWith(allowImportFrom);

      if (forbidImportFrom && !allowed && id.startsWith(forbidImportFrom)) {
        throw new Error(
          `Failed to build ${from}: cannot import ${id} from ${fromFile}`,
        );
      }

      for (const regex of external) {
        if (regex.test(id)) {
          return true;
        }
      }

      if (externalForFiles) {
        for (const item of externalForFiles) {
          if (fromFile === item.from && id === item.id) {
            return true;
          }
        }
      }
    },
    experimental: {
      attachDebugInfo: 'none',
    },
  };

  const dir = dirname(to);

  return {
    common,
    dir,
  };
};

/**
 * Helper to create rolldown configs for a single export file.
 * Generates CJS (.js), ESM (.mjs), and d.ts outputs.
 */
export const rolldownExportFile = (from, to, options) => {
  const { common, dir } = getCommonOptions(from, to, options);

  return [
    // CJS output (.js)
    {
      ...common,
      output: {
        dir,
        format: 'cjs',
        sourcemap: true,
      },
      plugins: [
        {
          name: 'rewrite-js-imports',
          renderChunk(code, { fileName }) {
            if (fileName.endsWith('.js')) {
              return {
                code: code.replaceAll('./index.ts', './index.js'),
              };
            }
          },
        },
      ],
    },
    // ESM output (.mjs)
    {
      ...common,
      output: {
        dir,
        entryFileNames: `[name].mjs`,
        format: 'esm',
        sourcemap: true,
      },
      plugins: [
        {
          name: 'rewrite-mjs-imports',
          renderChunk(code, { fileName }) {
            if (fileName.endsWith('.mjs')) {
              return {
                code: code.replaceAll('./index.ts', './index.mjs'),
              };
            }
          },
        },
      ],
    },
    // TypeScript declarations (.d.ts)
    {
      ...common,
      plugins: [
        dts({
          emitDtsOnly: true,
          respectExternal: true,
          includeExternal: [],
        }),
        {
          name: 'rewrite-dts-imports',
          renderChunk(code, { fileName }) {
            if (fileName.endsWith('.d.ts')) {
              return {
                code: code.replaceAll('./index.js', './index.d.ts'),
              };
            }
          },
        },
      ],
      output: {
        dir,
      },
    },
  ];
};

/**
 * Simple plugin to add shebang banner to output files.
 * Replaces rollup-plugin-executable for CLI entry points.
 *
 * @returns {import('rolldown').RolldownPlugin}
 */
export const rolldownExportShebang = (from, to, options) => {
  const { common, dir } = getCommonOptions(from, to, options);

  return {
    ...common,
    plugins: [
      {
        name: 'shebang',
        renderChunk(code) {
          if (!code.startsWith('#!')) {
            return {
              code: `#!/usr/bin/env node\n${code}`,
              map: null,
            };
          }
          return null;
        },
      },
    ],
    output: {
      dir,
      format: 'cjs',
      sourcemap: true,
    },
  };
};
