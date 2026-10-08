import { colors } from 'pqb/internal';
import { RakeDbError } from './errors';
import { promptConfirm, promptSelect, promptText } from './prompt';

describe('prompt', () => {
  const { stdin, stdout } = process;
  const { isTTY, setRawMode } = stdin;

  afterEach(() => {
    stdin.isTTY = isTTY;
    stdin.setRawMode = setRawMode;
    jest.restoreAllMocks();
  });

  describe.each([undefined, false])('when stdin.isTTY is %s', (value) => {
    beforeEach(() => {
      stdin.isTTY = value as boolean;
    });

    it.each([
      [
        'promptSelect',
        () =>
          promptSelect({
            message: `Create or rename ${colors.blueBold('users')} table?`,
            options: ['create', 'rename'],
          }),
        'Create or rename users table?',
      ],
      [
        'promptConfirm',
        () => promptConfirm({ message: 'Proceed?' }),
        'Proceed?',
      ],
      [
        'promptText',
        () => promptText({ message: 'Enter admin user:' }),
        'Enter admin user:',
      ],
    ])('%s should fail without waiting for input', async (_, fn, message) => {
      const resume = jest.spyOn(stdin, 'resume');

      const promise = fn();

      await expect(promise).rejects.toThrow(RakeDbError);
      await expect(promise).rejects.toThrow(
        `Cannot prompt "${message}": stdin is not a TTY, run the command in an interactive terminal`,
      );
      expect(resume).not.toHaveBeenCalled();
    });
  });

  it('should read the answer from stdin when it is a TTY', async () => {
    stdin.isTTY = true;
    stdin.setRawMode = jest.fn(() => stdin);
    jest.spyOn(stdout, 'write').mockImplementation(() => true);

    const promise = promptSelect({
      message: 'Pick one',
      options: ['first', 'second'],
    });

    stdin.emit('data', 'j');
    stdin.emit('data', '\r');

    await expect(promise).resolves.toBe(1);
  });
});
