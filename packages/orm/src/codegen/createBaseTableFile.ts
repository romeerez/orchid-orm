import { AppCodeUpdaterConfig } from './appCodeUpdater';
import fs from 'fs/promises';
import path from 'path';
import { pathToLog } from 'orchid-core';

type CreateBaseTableFileParams = Pick<
  AppCodeUpdaterConfig,
  'baseTablePath' | 'baseTableName' | 'logger'
>;

export const createBaseTableFile = async ({
  baseTableName,
  baseTablePath,
  logger,
}: CreateBaseTableFileParams) => {
  await fs.mkdir(path.dirname(baseTablePath), { recursive: true });

  await fs
    .writeFile(
      baseTablePath,
      `import { createBaseTable } from 'orchid-orm';

export const ${baseTableName} = createBaseTable();
`,
      {
        flag: 'wx',
      },
    )
    .then(() => {
      logger?.log(`Created ${pathToLog(baseTablePath)}`);
    })
    .catch((err) => {
      if (err.code === 'EEXIST') return;
      throw err;
    });
};
