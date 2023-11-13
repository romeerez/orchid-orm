import { greetAfterInstall } from './greetAfterInstall';
import { testInitConfig } from '../testUtils';

const logger = { log: jest.fn() };

describe('greetAfterInstall', () => {
  beforeEach(jest.resetAllMocks);

  it('should log `cd project` when user specified a path', async () => {
    await greetAfterInstall(testInitConfig, logger);

    const message = logger.log.mock.calls[0][0];
    expect(message).toContain('cd to the project');
    expect(message).toContain('> cd project');
  });

  it('should log `cd project` when user specified a path', async () => {
    await greetAfterInstall({ ...testInitConfig, path: process.cwd() }, logger);

    const message = logger.log.mock.calls[0][0];
    expect(message).not.toContain('cd to the project');
    expect(message).not.toContain('> cd project');
  });

  it('should detect npm', async () => {
    process.env.npm_execpath = '/somewhere/npm-cli.js';

    await greetAfterInstall(testInitConfig, logger);

    const message = logger.log.mock.calls[0][0];
    expect(message).toContain('> npm i');
    expect(message).toContain('> npm run db create');
    expect(message).toContain('> npm run db migrate');
  });

  it('should detect yarn', async () => {
    process.env.npm_execpath = '/somewhere/yarn.js';

    await greetAfterInstall(testInitConfig, logger);

    const message = logger.log.mock.calls[0][0];
    expect(message).toContain('> yarn i');
    expect(message).toContain('> yarn db create');
    expect(message).toContain('> yarn db migrate');
  });

  it('should detect bun', async () => {
    process.env.npm_execpath = '/somewhere/bun.js';

    await greetAfterInstall(testInitConfig, logger);

    const message = logger.log.mock.calls[0][0];
    expect(message).toContain('> bun i');
    expect(message).toContain('> bun db create');
    expect(message).toContain('> bun db migrate');
  });

  it('should default to pnpm', async () => {
    process.env.npm_execpath = undefined;

    await greetAfterInstall(testInitConfig, logger);

    const message = logger.log.mock.calls[0][0];
    expect(message).toContain('> pnpm i');
    expect(message).toContain('> pnpm db create');
    expect(message).toContain('> pnpm db migrate');
  });
});
