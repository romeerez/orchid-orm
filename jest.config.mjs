import path from 'path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default {
  rootDir: path.resolve('src'),
  reporters: ['agent'],
  coverageDirectory: path.resolve('coverage'),
  setupFiles: [path.join(rootDir, 'jest-load-env.cjs')],
  globalSetup: path.join(rootDir, 'jest-global-setup.ts'),
  setupFilesAfterEnv: [path.join(rootDir, 'jest-setup.ts')],
  transform: {
    '^.+\\.ts$': '@swc/jest',
  },
};
