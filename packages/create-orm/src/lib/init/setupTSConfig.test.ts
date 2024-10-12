import fs from 'fs/promises';
import { initSteps } from '../init';
import { mockFn, testInitConfig } from '../../testUtils';

const writeFile = mockFn(fs, 'writeFile');

describe('setupTSConfig', () => {
  beforeEach(jest.resetAllMocks);

  it('should create tsconfig.json if not not exist', async () => {
    await initSteps.setupTSConfig({ ...testInitConfig, hasTsConfig: false });

    expect(writeFile.mock.calls[0][1]).toBe(`{
  "compilerOptions": {
    "target": "es2020",
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

    expect(writeFile.mock.calls[0][1]).toBe(`{
  "compilerOptions": {
    "target": "es2020",
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

  it('should add "outDir": "dist" for ts-node', async () => {
    await initSteps.setupTSConfig({
      ...testInitConfig,
      hasTsConfig: false,
      runner: 'ts-node',
    });

    expect(writeFile.mock.calls[0][1]).toBe(`{
  "compilerOptions": {
    "outDir": "dist",
    "target": "es2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}
`);
  });
});
