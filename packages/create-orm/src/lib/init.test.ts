import fs from 'fs/promises';
import { init } from '../lib';
import { initSteps } from './init';
import { mockFn, testInitConfig } from '../testUtils';

const mkdir = mockFn(fs, 'mkdir');

describe('init', () => {
  beforeEach(jest.resetAllMocks);

  it('should create `dbDirPath` recursively and call all init steps', async () => {
    for (const key in initSteps) {
      mockFn(initSteps, key as keyof typeof initSteps);
    }

    await init(testInitConfig);

    expect(mkdir).toBeCalledWith(testInitConfig.dbDirPath, { recursive: true });

    for (const key in initSteps) {
      expect(initSteps[key as keyof typeof initSteps]).toBeCalledWith(
        testInitConfig,
      );
    }
  });
});
