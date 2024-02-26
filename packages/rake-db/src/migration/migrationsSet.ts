import path from 'path';
import { AnyRakeDbConfig, RakeDbMigrationId } from '../config';
import { RecordString } from 'orchid-core';
import { pathToFileURL } from 'node:url';
import { Dirent } from 'node:fs';
import { readdir } from 'fs/promises';
import { RakeDbCtx } from '../common';
import { fileNamesToChangeMigrationIdMap } from '../commands/changeIds';

export interface MigrationItem {
  path: string;
  version: string;

  /**
   * Function that loads the migration content,
   * can store lazy import of a migration file.
   * Promise can return `{ default: x }` where `x` is a return of `change` or an array of such returns.
   */
  load(): Promise<unknown>;
}

export interface MigrationsSet {
  renameTo?: RakeDbMigrationId;
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
): Promise<MigrationsSet> => {
  return (ctx.migrationsPromise ??= config.migrations
    ? getMigrationsFromConfig({ ...config, migrations: config.migrations })
    : getMigrationsFromFiles(config, allowDuplicates)).then((data) =>
    up
      ? data
      : { renameTo: data.renameTo, migrations: [...data.migrations].reverse() },
  );
};

// Converts user-provided migrations object into array of migration items.
function getMigrationsFromConfig(
  config: AnyRakeDbConfig,
  allowDuplicates?: boolean,
): Promise<MigrationsSet> {
  const result: MigrationItem[] = [];
  const versions: RecordString = {};

  const { migrations, basePath } = config;
  for (const key in migrations) {
    const version = getMigrationVersionOrThrow(config, path.basename(key));
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

  return Promise.resolve({
    migrations: result,
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
): Promise<{ renameTo?: RakeDbMigrationId; migrations: MigrationItem[] }> {
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

        data.renameTo =
          file.name === '.rename-to-serial.json' ? 'serial' : 'timestamp';

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
