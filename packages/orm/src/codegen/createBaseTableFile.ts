import { AppCodeUpdaterConfig } from './appCodeUpdater';
import fs from 'fs/promises';
import path from 'path';

type CreateBaseTableFileParams = Pick<
  AppCodeUpdaterConfig,
  'baseTablePath' | 'baseTableName'
>;

export const createBaseTableFile = async ({
  baseTableName,
  baseTablePath,
}: CreateBaseTableFileParams) => {
  await fs.mkdir(path.dirname(baseTablePath), { recursive: true });

  await fs
    .writeFile(
      baseTablePath,
      `import { createBaseTable } from 'orchid-orm';
import { columnTypes } from 'pqb';

export const ${baseTableName} = createBaseTable({
  columnTypes: {
    ...columnTypes,
  },
});
`,
      {
        flag: 'wx',
      },
    )
    .catch((err) => {
      if (err.code === 'EEXIST') return;
      throw err;
    });
};
