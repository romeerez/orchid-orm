import { AppCodeUpdaterConfig, BaseTableParam } from './appCodeUpdater';
import fs from 'fs/promises';
import path from 'path';
import { pathToLog } from 'orchid-core';

type CreateBaseTableFileParams = Pick<AppCodeUpdaterConfig, 'logger'> & {
  baseTable: BaseTableParam;
};

export const createBaseTableFile = async ({
  baseTable,
  logger,
}: CreateBaseTableFileParams) => {
  await fs.mkdir(path.dirname(baseTable.filePath), { recursive: true });

  await fs
    .writeFile(
      baseTable.filePath,
      `import { createBaseTable } from 'orchid-orm';

export const ${baseTable.exportAs} = createBaseTable();
`,
      {
        flag: 'wx',
      },
    )
    .then(() => {
      logger?.log(`Created ${pathToLog(baseTable.filePath)}`);
    })
    .catch((err) => {
      if (err.code === 'EEXIST') return;
      throw err;
    });
};
