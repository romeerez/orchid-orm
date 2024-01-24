import { ColumnSchemaConfig, MaybeArray, toArray } from 'orchid-core';
import { Adapter, AdapterOptions, createDb, DbResult } from 'pqb';
import { RakeDbConfig } from '../common';
import { join } from 'path';
import { readdir, stat, readFile } from 'fs/promises';

export const runRecurrentMigrations = async <
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<SchemaConfig, CT>,
): Promise<void> => {
  let dbs: DbResult<unknown>[] | undefined;
  let files = 0;

  await readdirRecursive(config.recurrentPath, async (path) => {
    files++;

    // init dbs lazily
    dbs ??= toArray(options).map((opts) =>
      createDb({ adapter: new Adapter(opts) }),
    );

    const sql = await readFile(path, 'utf-8');
    await Promise.all(
      dbs.map(async (db) => {
        await db.adapter.arrays(sql);
      }),
    );
  });

  if (dbs) {
    await Promise.all(dbs.map((db) => db.close()));

    if (files > 0) {
      config.logger?.log(
        `Applied ${files} recurrent migration file${files > 1 ? 's' : ''}`,
      );
    }
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
