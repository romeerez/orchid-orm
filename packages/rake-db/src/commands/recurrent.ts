import { AdapterBase, createDbWithAdapter, DbResult, QueryLogger } from 'pqb';
import { join } from 'path';
import { readdir, stat, readFile } from 'fs/promises';

export const runRecurrentMigrations = async (
  adapters: AdapterBase[],
  config: {
    recurrentPath: string;
    logger?: QueryLogger;
  },
): Promise<void> => {
  let dbs: DbResult<unknown>[] | undefined;
  let files = 0;

  await readdirRecursive(config.recurrentPath, async (path) => {
    files++;

    // init dbs lazily
    dbs ??= adapters.map((adapter) => createDbWithAdapter({ adapter }));

    const sql = await readFile(path, 'utf-8');
    await Promise.all(
      dbs.map(async (db) => {
        await db.adapter.arrays(sql);
      }),
    );
  });

  if (files > 0) {
    config.logger?.log(
      `Applied ${files} recurrent migration file${files > 1 ? 's' : ''}`,
    );
  }
};

const readdirRecursive = async (
  dirPath: string,
  cb: (path: string) => Promise<void>,
) => {
  const list = await readdir(dirPath).catch((err) => {
    if (err.code !== 'ENOENT') throw err;
    return;
  });

  if (!list) return;

  await Promise.all(
    list.map(async (item) => {
      const path = join(dirPath, item);
      const info = await stat(path);
      if (info.isDirectory()) {
        await readdirRecursive(path, cb);
      } else if (info.isFile() && path.endsWith('.sql')) {
        await cb(path);
      }
    }),
  );
};
