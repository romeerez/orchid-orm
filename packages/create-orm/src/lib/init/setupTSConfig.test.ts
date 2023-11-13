import fs from 'fs/promises';
import { initSteps } from '../init';
import { resolve } from 'path';
import { mockFn, testInitConfig } from '../../testUtils';

const tsConfigPath = resolve(testInitConfig.path, 'tsconfig.json');

const writeFile = mockFn(fs, 'writeFile');

describe('setupTSConfig', () => {
  beforeEach(jest.resetAllMocks);

  it('should create tsconfig.json if not not exist', async () => {
    await initSteps.setupTSConfig({ ...testInitConfig, hasTsConfig: false });

    const call = writeFile.mock.calls.find(([to]) => to === tsConfigPath);
    expect(call?.[1]).toBe(`{
  "compilerOptions": {
    "target": "es2017",
    "module": "esnext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}
`);
  });

  it('should not change tsconfig.json if it exists', async () => {
    await initSteps.setupTSConfig({ ...testInitConfig, hasTsConfig: true });

    expect(writeFile).not.toBeCalled();
  });

  it('should add vite types for vite-node', async () => {
    await initSteps.setupTSConfig({
      ...testInitConfig,
      hasTsConfig: false,
      runner: 'vite-node',
    });

    const call = writeFile.mock.calls.find(([to]) => to === tsConfigPath);
    expect(call?.[1]).toBe(`{
  "compilerOptions": {
    "target": "es2017",
    "module": "esnext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  }
}
`);
  });
});
