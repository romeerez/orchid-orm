import { InitConfig } from '../../lib';
import fs from 'fs/promises';
import { join } from 'path';

export async function setupRunner(config: InitConfig): Promise<void> {
  if (config.runner === 'vite-node') {
    await fs.writeFile(
      join(config.path, 'vite.migrations.ts'),
      `import { resolve } from 'path'
import { defineConfig, PluginOption } from 'vite'
import { nodeExternals } from 'rollup-plugin-node-externals';

export default defineConfig({
  plugins: [
    {
      ...nodeExternals(),
      name: 'node-externals',
      enforce: 'pre',
      apply: 'build',
    } as PluginOption
  ],
  build: {
    outDir: resolve(__dirname, 'dist', 'db'),
    lib: {
      entry: resolve(__dirname, 'src/db/dbScript.ts'),
      formats: ['es'],
      fileName: 'dbScript',
    },
    rollupOptions: {
      external: ["pqb", "rake-db"],
    },
  },
})
`,
    );
  } else if (config.runner === 'tsx') {
    await fs.writeFile(
      join(config.path, 'esbuild.migrations.js'),
      `import { build } from "esbuild";

await Promise.all([
  build({
    entryPoints: ["src/db/dbScript.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outdir: "dist/db",
    banner: {
      js: \`
        import __path from 'node:path';
        import { fileURLToPath as __fileURLToPath } from 'node:url';
        import { createRequire as __createRequire } from 'module';
        const require = __createRequire(import.meta.url);
        const __filename = __fileURLToPath(import.meta.url);
        const __dirname = __path.dirname(__filename);
      \`,
    },
  }),
  build({
    entryPoints: ["src/db/migrations/*.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outdir: "dist/db/migrations",
    external: ['../dbScript'],
    plugins: [{
      name: 'add-js-suffix',
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if (args.importer) {
            return { path: args.path + '.js', external: true }
          }
        })
      },
    }],
  }),
]);
`,
    );
  }
}
