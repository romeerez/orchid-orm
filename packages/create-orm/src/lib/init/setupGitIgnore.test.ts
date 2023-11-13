import fs from 'fs/promises';
import { EnoentError, mockFn, testInitConfig } from '../../testUtils';
import { initSteps } from '../init';
import { resolve } from 'path';

const gitignorePath = resolve(testInitConfig.path, '.gitignore');

const readFile = mockFn(fs, 'readFile');
const writeFile = mockFn(fs, 'writeFile');

describe('setupGitIgnore', () => {
  beforeEach(jest.resetAllMocks);

  it('should create .gitignore if not exists', async () => {
    readFile.mockRejectedValueOnce(new EnoentError());

    await initSteps.setupGitIgnore(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === gitignorePath);
    expect(call?.[1]).toBe(`node_modules
.env.?*
!.env.example
`);
  });

  it('should append missing entries if .gitignore exists', async () => {
    readFile.mockResolvedValueOnce('node_modules/\nko');

    await initSteps.setupGitIgnore(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === gitignorePath);
    expect(call?.[1]).toBe(`node_modules/
ko
.env.?*
!.env.example
`);
  });
});
