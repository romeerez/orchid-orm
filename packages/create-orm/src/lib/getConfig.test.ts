import prompts from 'prompts';
import fs from 'fs/promises';
import { asMock, mockFn } from '../testUtils';
import { UserProvidedConfig } from '../lib';
import { getConfig } from './getConfig';
import { resolve } from 'path';

jest.mock('prompts', () => jest.fn());

const userConfig: UserProvidedConfig = {
  path: 'project',
  testDatabase: false,
  addSchemaToZod: false,
  addTestFactory: false,
  demoTables: false,
  timestamp: 'string',
  runner: 'tsx',
};

const log = jest.fn();

describe('getConfig', () => {
  beforeEach(jest.clearAllMocks);

  it(`
    should log a welcome message,
    return resolved \`path\`,
    return user config with \`hasTsConfig\` if tsconfig exists,
    return a \`dbDirPath\`,
    return project name derived from path
  `, async () => {
    mockFn(fs, 'readFile').mockResolvedValue('content');
    asMock(prompts).mockResolvedValue(userConfig);

    const result = await getConfig({ log });

    expect(log).toBeCalledWith(expect.stringContaining('Welcome'));
    expect(result).toEqual({
      ...userConfig,
      path: resolve(userConfig.path),
      hasTsConfig: true,
      dbDirPath: resolve(userConfig.path, 'src', 'db'),
      projectName: 'project',
      esm: true,
    });
  });

  it('should return `hasTsConfig` false when no tsconfig', async () => {
    mockFn(fs, 'readFile').mockRejectedValueOnce({ code: 'ENOENT' });
    asMock(prompts).mockResolvedValue(userConfig);

    const result = await getConfig({ log });

    expect(result).toEqual({
      ...userConfig,
      path: resolve(userConfig.path),
      hasTsConfig: false,
      dbDirPath: resolve(userConfig.path, 'src', 'db'),
      projectName: 'project',
      esm: true,
    });
  });

  it('should return undefined if cancelled by user', async () => {
    asMock(prompts).mockImplementation(
      (_: unknown, opts: { onCancel(): void }) => {
        opts.onCancel();
      },
    );

    const res = await getConfig({ log });

    expect(prompts).toBeCalledTimes(1);
    expect(res).toBe(undefined);
  });
});
