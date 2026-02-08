import { InitConfig } from '../../lib';
import fs from 'fs/promises';
import { join } from 'path';

export async function setupRunner(config: InitConfig): Promise<void> {
  if (config.runner === 'vite-node') {
    await fs.writeFile(
      join(config.path, 'vite.migrations.mts'),
      `import { resolve } from "path";
import { defineConfig, PluginOption } from "vite";
import { nodeExternals } from "rollup-plugin-node-externals";

export default defineConfig({
  plugins: [
    {
      ...nodeExternals(),
      name: "node-externals",
      enforce: "pre",
      apply: "build",
    } as PluginOption
  ],
  build: {
    outDir: resolve(__dirname, "dist", "db"),
    lib: {
      entry: resolve(__dirname, "src/db/db-script.ts"),
      formats: ["es"],
      fileName: "db-script",
    },
    rollupOptions: {
      external: ["orchid-orm"],
      output: {
        entryFileNames: "[name].mjs",
        chunkFileNames: "[name].[hash].mjs",
      },
    },
  },
})
`,
    );
  } else if (config.runner === 'tsx') {
    await fs.writeFile(
      join(config.path, 'esbuild.migrations.mjs'),
      `import { build } from "esbuild";

await Promise.all([
  build({
    entryPoints: ["src/db/db-script.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outdir: "dist/db",
    outExtension: { '.js': '.mjs' },
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
    outExtension: { '.js': '.mjs' },
    external: ['../db-script'],
    plugins: [{
      name: 'add-js-suffix',
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if (args.importer) {
            return { path: args.path + '.mjs', external: true }
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
