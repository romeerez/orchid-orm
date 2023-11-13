import fs from 'fs/promises';
import { initSteps } from '../init';
import { resolve } from 'path';
import { EnoentError, mockFn, testInitConfig } from '../../testUtils';

const envPath = resolve(testInitConfig.path, '.env');

const readFile = mockFn(fs, 'readFile');
const writeFile = mockFn(fs, 'writeFile');

global.process = { ...process };
process.env.USER = 'username';
Object.assign(process, { platform: 'any' });

describe('setupEnv', () => {
  beforeEach(jest.resetAllMocks);

  it('should create .env if not exist', async () => {
    readFile.mockRejectedValueOnce(new EnoentError());

    await initSteps.setupEnv(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === envPath);
    expect(call?.[1])
      .toBe(`DATABASE_URL=postgres://postgres:@localhost:5432/dbname?ssl=false
`);
  });

  it('should append DATABASE_URL to existing .env', async () => {
    readFile.mockResolvedValueOnce('KO=KO');

    await initSteps.setupEnv(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === envPath);
    expect(call?.[1]).toBe(`KO=KO
DATABASE_URL=postgres://postgres:@localhost:5432/dbname?ssl=false
`);
  });

  it('should append DATABASE_TEST_URL if testDatabase specified', async () => {
    readFile.mockResolvedValueOnce('KO=KO');

    await initSteps.setupEnv({
      ...testInitConfig,
      testDatabase: true,
    });

    const call = writeFile.mock.calls.find(([to]) => to === envPath);
    expect(call?.[1]).toBe(`KO=KO
DATABASE_URL=postgres://postgres:@localhost:5432/dbname?ssl=false
DATABASE_TEST_URL=postgres://postgres:@localhost:5432/dbname-test?ssl=false
`);
  });

  it('should use the user`s username on mac', async () => {
    readFile.mockRejectedValueOnce(new EnoentError());
    Object.assign(process, { platform: 'darwin' });

    await initSteps.setupEnv(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === envPath);
    expect(call?.[1])
      .toBe(`DATABASE_URL=postgres://username:@localhost:5432/dbname?ssl=false
`);
  });
});
