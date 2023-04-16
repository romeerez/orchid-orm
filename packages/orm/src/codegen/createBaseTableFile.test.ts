import path from 'path';
import { createBaseTableFile } from './createBaseTableFile';
import fs from 'fs/promises';
import { asMock } from './testUtils';
import { pathToLog } from 'orchid-core';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}));

const log = jest.fn();
const params = {
  baseTable: {
    filePath: path.resolve('baseTable.ts'),
    name: 'CustomName',
  },
  logger: {
    ...console,
    log,
  },
};

describe('createBaseTableFile', () => {
  beforeEach(() => {
    log.mockClear();
  });

  it('should call mkdir with recursive option and create a file', async () => {
    asMock(fs.writeFile).mockResolvedValue(null);

    await createBaseTableFile(params);

    expect(fs.mkdir).toBeCalledWith(path.dirname(params.baseTable.filePath), {
      recursive: true,
    });

    expect(fs.writeFile).toBeCalled();
    expect(log).toBeCalledWith(
      `Created ${pathToLog(params.baseTable.filePath)}`,
    );
  });

  it('should write file with wx flag to not overwrite', async () => {
    asMock(fs.writeFile).mockRejectedValueOnce(
      Object.assign(new Error(), { code: 'EEXIST' }),
    );

    await createBaseTableFile(params);

    expect(fs.writeFile).toBeCalledWith(
      params.baseTable.filePath,
      `import { createBaseTable } from 'orchid-orm';

export const ${params.baseTable.name} = createBaseTable();
`,
      {
        flag: 'wx',
      },
    );

    expect(log).not.toBeCalled();
  });

  it('should throw if error is not EEXIST', async () => {
    asMock(fs.writeFile).mockRejectedValueOnce(
      Object.assign(new Error('custom'), { code: 'other' }),
    );

    await expect(() => createBaseTableFile(params)).rejects.toThrow('custom');

    expect(log).not.toBeCalled();
  });
});
