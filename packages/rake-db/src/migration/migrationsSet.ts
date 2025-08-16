import path from 'path';
import {
  AnyRakeDbConfig,
  RakeDbRenameMigrations,
  RakeDbRenameMigrationsMap,
} from '../config';
import { RecordString } from 'orchid-core';
import { pathToFileURL } from 'node:url';
import { Dirent } from 'node:fs';
import { readdir } from 'fs/promises';
import { RakeDbCtx } from '../common';
import { fileNamesToChangeMigrationIdMap } from '../commands/changeIds';
import fs from 'fs/promises';

export interface MigrationItemHasLoad {
  path?: string;

  /**
   * Function that loads the migration content,
   * can store lazy import of a migration file.
   * Promise can return `{ default: x }` where `x` is a return of `change` or an array of such returns.
   */
  load(): Promise<unknown>;
}

export interface MigrationItem extends MigrationItemHasLoad {
  path: string;
  version: string;
}

export interface MigrationsSet {
  renameTo?: RakeDbRenameMigrations;
  migrations: MigrationItem[];
}

// If the config has a `migrations` object, it will be returned as array of migration items.
// If `up` is false, will reverse the resulting array.
// Otherwise, it will scan directory which is set in `migrationPath` and convert files into migration items.
// `up` value determines sorting of files: `true` for ascending, `false` for descending.
export const getMigrations = async (
  ctx: RakeDbCtx,
  config: AnyRakeDbConfig,
  up: boolean,
  allowDuplicates?: boolean,
  getVersion = getMigrationVersionOrThrow,
): Promise<MigrationsSet> => {
  return (ctx.migrationsPromise ??= config.migrations
    ? getMigrationsFromConfig(
        { ...config, migrations: config.migrations },
        allowDuplicates,
        getVersion,
      )
    : getMigrationsFromFiles(config, allowDuplicates, getVersion)).then(
    (data) =>
      up
        ? data
        : {
            renameTo: data.renameTo,
            migrations: [...data.migrations].reverse(),
          },
  );
};

// Converts user-provided migrations object into array of migration items.
function getMigrationsFromConfig(
  config: AnyRakeDbConfig,
  allowDuplicates?: boolean,
  getVersion = getMigrationVersionOrThrow,
): Promise<MigrationsSet> {
  const result: MigrationItem[] = [];
  const versions: RecordString = {};

  const { migrations, basePath } = config;
  for (const key in migrations) {
    const version = getVersion(config, path.basename(key));
    if (versions[version] && !allowDuplicates) {
      throw new Error(
        `Migration ${key} has the same version as ${versions[version]}`,
      );
    }

    versions[version] = key;

    result.push({
      path: path.resolve(basePath, key),
      version,
      load: migrations[key],
    });
  }

  const { renameMigrations } = config;
  return Promise.resolve({
    migrations: result,
    renameTo: renameMigrations
      ? { to: renameMigrations.to, map: () => renameMigrations.map }
      : undefined,
  });
}

// For sorting migration files in ascending sort.
export const sortMigrationsAsc = (
  a: { version: string },
  b: { version: string },
) => +a.version - +b.version;

// Scans files under `migrationsPath` to convert files into migration items.
export async function getMigrationsFromFiles(
  config: AnyRakeDbConfig,
  allowDuplicates?: boolean,
  getVersion = getMigrationVersionOrThrow,
): Promise<MigrationsSet> {
  const { migrationsPath, import: imp } = config;

  const entries = await readdir(migrationsPath, { withFileTypes: true }).catch(
    () => [] as Dirent[],
  );

  const versions: RecordString = {};

  const result = entries.reduce<MigrationsSet>(
    (data, file) => {
      if (!file.isFile()) return data;

      if (fileNamesToChangeMigrationIdMap[file.name]) {
        if (data.renameTo) {
          throw new Error(
            `Both files for renaming to serial and timestamp found, only one must remain`,
          );
        }

        const isSerialFile = file.name === '.rename-to-serial.json';
        const isSerialConfig = config.migrationId !== 'timestamp';
        if (
          (isSerialFile && !isSerialConfig) ||
          (!isSerialFile && isSerialConfig)
        ) {
          throw new Error(
            `File ${
              file.name
            } to rename migrations does not match \`migrationId\` ${JSON.stringify(
              config.migrationId,
            )} set in config`,
          );
        }

        data.renameTo = {
          to: config.migrationId,
          map: () => renameMigrationsMap(config, file.name),
        };

        return data;
      } else {
        checkExt(file.name);
      }

      const version = getVersion(config, file.name);
      const filePath = path.resolve(migrationsPath, file.name);

      if (versions[version] && !allowDuplicates) {
        throw new Error(
          `Migration ${pathToFileURL(
            filePath,
          )} has the same version as ${pathToFileURL(
            versions[version],
          )}\nRun \`**db command** rebase\` to reorganize files with duplicated versions.`,
        );
      }

      versions[version] = filePath;

      data.migrations.push({
        path: filePath,
        version,
        async load() {
          try {
            await imp(this.path);
          } catch (err) {
            // throw if unknown error
            if (
              (err as { code: string }).code !==
              'ERR_UNSUPPORTED_ESM_URL_SCHEME'
            )
              throw err;

            // this error happens on windows in ESM mode, try import transformed url
            await imp(pathToFileURL(this.path).pathname);
          }
        },
      });

      return data;
    },
    { migrations: [] },
  );

  result.migrations.sort(sortMigrationsAsc);

  return result;
}

const renameMigrationsMap = async (
  config: AnyRakeDbConfig,
  fileName: string,
): Promise<RakeDbRenameMigrationsMap> => {
  const filePath = path.join(config.migrationsPath, fileName);

  const json = await fs.readFile(filePath, 'utf-8');

  let data: RakeDbRenameMigrationsMap;
  try {
    data = JSON.parse(json);
    if (typeof data !== 'object')
      throw new Error('Config for renaming is not an object');
  } catch (err) {
    throw new Error(`Failed to read ${pathToFileURL(filePath)}`, {
      cause: err,
    });
  }

  return data;
};

// Restrict supported file extensions to `.ts`, `.js`, and `.mjs`.
function checkExt(filePath: string): void {
  const ext = path.extname(filePath);
  if (ext !== '.ts' && ext !== '.js' && ext !== '.mjs') {
    throw new Error(
      `Only .ts, .js, and .mjs files are supported for migration, received: ${filePath}`,
    );
  }
}

// Extract a 14-chars long timestamp from a beginning of a file name.
export function getMigrationVersionOrThrow(
  config: AnyRakeDbConfig,
  filePath: string,
): string {
  const name = path.basename(filePath);
  const value = getMigrationVersion(config, name);
  if (value) return value;

  if (config.migrationId === 'timestamp') {
    throw new Error(
      `Migration file name should start with 14 digit timestamp, received ${name}`,
    );
  } else {
    throw new Error(
      `Migration file name should start with 4 digit serial number, received ${name}.
You can automatically change migration ids to serial by running \`*db-command* change-ids serial\`.
To keep using timestamp ids, set \`migrationId\` option of rake-db to 'timestamp'.`,
    );
  }
}

export function getMigrationVersion(config: AnyRakeDbConfig, name: string) {
  return (
    config.migrationId === 'timestamp'
      ? name.match(/^(\d{14})(_|\b)/)
      : name.match(/^(\d{4})(_|\b)/)
  )?.[1];
}

export function getDigitsPrefix(name: string) {
  const value = name.match(/^(\d+)\D/)?.[1];
  if (!value) {
    throw new Error(
      `Migration file should be prefixed with a serial number, received ${name}`,
    );
  }

  return value;
}
