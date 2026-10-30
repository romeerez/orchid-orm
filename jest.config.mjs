import path from 'path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const requireFromPqb = createRequire(
  path.join(rootDir, 'packages/pqb/package.json'),
);

const postgresModulePath =
  process.env.ADAPTER === 'postgres-js-v3'
    ? requireFromPqb.resolve('postgres3')
    : process.versions.bun
      ? path.join(rootDir, 'jest-postgres-bun.cjs')
      : undefined;

export default {
  rootDir: path.resolve('src'),
  reporters: ['agent'],
  coverageDirectory: path.resolve('coverage'),
  setupFiles: [path.join(rootDir, 'jest-load-env.cjs')],
  globalSetup: path.join(rootDir, 'jest-global-setup.ts'),
  setupFilesAfterEnv: [path.join(rootDir, 'jest-setup.ts')],
  transform: {
    '^.+\\.ts$': '@swc/jest',
    // transform the ES modules of postgres.js v4 for Jest's CommonJS runtime
    '/node_modules/postgres/src/.+\\.js$': '@swc/jest',
  },
  // skip node_modules except postgres.js,
  // which pnpm puts into `.pnpm/postgres@<version>/node_modules/postgres`
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.pnpm/postgres@[^/]+/node_modules/)?postgres/src/)',
  ],
  ...(postgresModulePath && {
    moduleNameMapper: { '^postgres$': postgresModulePath },
  }),
};
