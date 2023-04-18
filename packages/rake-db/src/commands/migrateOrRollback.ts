import {
  Adapter,
  AdapterOptions,
  createDb,
  DbResult,
  DefaultColumnTypes,
} from 'pqb';
import {
  ColumnTypesBase,
  emptyArray,
  MaybeArray,
  pathToLog,
  toArray,
} from 'orchid-core';
import { getMigrationFiles, MigrationFile, RakeDbConfig } from '../common';
import {
  ChangeCallback,
  clearChanges,
  getCurrentChanges,
} from '../migration/change';
import { createMigrationInterface } from '../migration/migration';
import * as url from 'url';
import {
  getMigratedVersionsMap,
  removeMigratedVersion,
  saveMigratedVersion,
} from '../migration/manageMigratedVersions';

const getDb = (adapter: Adapter) => createDb({ adapter });

export const migrateOrRollback = async <CT extends ColumnTypesBase>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<CT>,
  args: string[],
  up: boolean,
): Promise<void> => {
  config = { ...config };
  const files = await getMigrationFiles(config, up);

  let count = up ? Infinity : 1;
  let argI = 0;
  const num = args[0] === 'all' ? Infinity : parseInt(args[0]);
  if (!isNaN(num)) {
    argI++;
    count = num;
  }

  const arg = args[argI];
  if (arg === '--code') {
    config.useCodeUpdater = args[argI + 1] !== 'false';
  }

  if (!config.useCodeUpdater) delete config.appCodeUpdater;

  const appCodeUpdaterCache = {};

  for (const opts of toArray(options)) {
    const adapter = new Adapter(opts);
    let db: DbResult<DefaultColumnTypes> | undefined;

    if (up) {
      await config.beforeMigrate?.((db ??= getDb(adapter)));
    } else {
      await config.beforeRollback?.((db ??= getDb(adapter)));
    }

    const migratedVersions = await getMigratedVersionsMap(adapter, config);
    try {
      for (const file of files) {
        if (
          (up && migratedVersions[file.version]) ||
          (!up && !migratedVersions[file.version])
        ) {
          continue;
        }

        if (count-- <= 0) break;

        await processMigration(
          adapter,
          up,
          file,
          config,
          opts,
          appCodeUpdaterCache,
        );

        config.logger?.log(
          `${up ? 'Migrated' : 'Rolled back'} ${pathToLog(file.path)}`,
        );
      }

      if (up) {
        await config.afterMigrate?.((db ??= getDb(adapter)));
      } else {
        await config.afterRollback?.((db ??= getDb(adapter)));
      }
    } finally {
      await config.appCodeUpdater?.afterAll({
        options: opts,
        basePath: config.basePath,
        cache: appCodeUpdaterCache,
        logger: config.logger,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        baseTable: config.baseTable!,
      });

      await adapter.close();
    }
    // use appCodeUpdater only for the first provided options
    delete config.appCodeUpdater;
  }
};

export const changeCache: Record<string, ChangeCallback[] | undefined> = {};

const begin = {
  text: 'BEGIN',
  values: emptyArray,
};

const processMigration = async <CT extends ColumnTypesBase>(
  db: Adapter,
  up: boolean,
  file: MigrationFile,
  config: RakeDbConfig<CT>,
  options: AdapterOptions,
  appCodeUpdaterCache: object,
) => {
  const asts = await db.transaction(begin, async (tx) => {
    clearChanges();

    let changes = changeCache[file.path];
    if (!changes) {
      try {
        await config.import(file.path);
      } catch (err) {
        // throw if unknown error
        if ((err as { code: string }).code !== 'ERR_UNSUPPORTED_ESM_URL_SCHEME')
          throw err;

        // this error happens on windows in ESM mode, try import transformed url
        await config.import(url.pathToFileURL(file.path).pathname);
      }
      changes = getCurrentChanges();
      changeCache[file.path] = changes;
    }

    const db = createMigrationInterface(tx, up, config);

    for (const fn of up ? changes : changes.reverse()) {
      await fn(db, up);
    }

    await (up ? saveMigratedVersion : removeMigratedVersion)(
      db.adapter,
      file.version,
      config,
    );

    return db.migratedAsts;
  });

  for (const ast of asts) {
    await config.appCodeUpdater?.process({
      ast,
      options,
      basePath: config.basePath,
      cache: appCodeUpdaterCache,
      logger: config.logger,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      baseTable: config.baseTable!,
    });
  }
};

export const migrate = <CT extends ColumnTypesBase>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<CT>,
  args: string[] = [],
): Promise<void> => migrateOrRollback(options, config, args, true);

export const rollback = <CT extends ColumnTypesBase>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<CT>,
  args: string[] = [],
): Promise<void> => migrateOrRollback(options, config, args, false);

export const redo = async <CT extends ColumnTypesBase>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<CT>,
  args: string[] = [],
): Promise<void> => {
  await migrateOrRollback(options, config, args, false);
  await migrateOrRollback(options, config, args, true);
};
