import path from 'path';
import { createBaseTableFile } from './createBaseTableFile';
import fs from 'fs/promises';
import { asMock } from './testUtils';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}));

const params = {
  baseTablePath: path.resolve('baseTable.ts'),
  baseTableName: 'CustomName',
};

describe('createBaseTableFile', () => {
  it('should call mkdir with recursive option', async () => {
    asMock(fs.writeFile).mockResolvedValue(null);

    await createBaseTableFile(params);

    expect(fs.mkdir).toBeCalledWith(path.dirname(params.baseTablePath), {
      recursive: true,
    });
  });

  it('should write file with wx flag to not overwrite', async () => {
    asMock(fs.writeFile).mockRejectedValueOnce(
      Object.assign(new Error(), { code: 'EEXIST' }),
    );

    await createBaseTableFile(params);

    expect(asMock(fs.writeFile)).toBeCalledWith(
      params.baseTablePath,
      `import { createBaseTable } from 'orchid-orm';
import { columnTypes } from 'pqb';

export const ${params.baseTableName} = createBaseTable({
  columnTypes: {
    ...columnTypes,
  },
});
`,
      {
        flag: 'wx',
      },
    );
  });

  it('should throw if error is not EEXIST', async () => {
    asMock(fs.writeFile).mockRejectedValueOnce(
      Object.assign(new Error('custom'), { code: 'other' }),
    );

    await expect(() => createBaseTableFile(params)).rejects.toThrow('custom');
  });
});
