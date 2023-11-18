import { initSteps } from '../init';
import { mockFn, testInitConfig } from '../../testUtils';
import fs from 'fs/promises';
import { resolve } from 'path';

const writeFile = mockFn(fs, 'writeFile');

describe('setupRunner', () => {
  beforeEach(jest.resetAllMocks);

  it('should create vite.migrations.ts for vite-node', async () => {
    await initSteps.setupRunner({ ...testInitConfig, runner: 'vite-node' });

    expect(writeFile).toBeCalledWith(
      resolve(testInitConfig.path, 'vite.migrations.mts'),
      expect.stringContaining('defineConfig'),
    );
  });

  it('should create vite.migrations.ts for tsx', async () => {
    await initSteps.setupRunner({ ...testInitConfig, runner: 'tsx' });

    expect(writeFile).toBeCalledWith(
      resolve(testInitConfig.path, 'esbuild.migrations.mjs'),
      expect.stringContaining('esbuild'),
    );
  });
});
