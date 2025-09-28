import { AnyRakeDbConfig } from '../config';
import path from 'path';
import fs from 'fs/promises';
import { getMigrations, MigrationItem } from '../migration/migrationsSet';
import { getMigratedVersionsMap } from '../migration/manageMigratedVersions';
import { RakeDbCtx } from '../common';
import { AdapterBase, RecordOptionalString } from 'orchid-core';
import { fullRedo } from './migrateOrRollback';
import { promptSelect } from '../prompt';
import { colors } from '../../../core/src/colors';

interface RebaseFile extends MigrationItem {
  name: string;
  serial: number;
}

export const rebase = async (
  adapters: AdapterBase[],
  config: AnyRakeDbConfig,
) => {
  if (config.migrations) {
    throw new Error('Cannot rebase migrations defined in the config');
  }

  if (config.migrationId === 'timestamp') {
    throw new Error(
      `Cannot rebase when the 'migrationId' is set to 'timestamp' in the config`,
    );
  }

  const ctx: RakeDbCtx = {};

  const [set, ...versionMaps] = await Promise.all([
    await getMigrations(ctx, config, true, true),
    ...adapters.map((adapter) => getMigratedVersionsMap(ctx, adapter, config)),
  ]);

  await Promise.all(adapters.map((adapter) => adapter.close()));

  const files: RebaseFile[] = set.migrations.map((file) => ({
    ...file,
    name: path.basename(file.path),
    serial: +file.version,
  }));
  if (!files.length) return;

  const start = files.findIndex(
    (file, i) => i !== 0 && file.serial === files[i - 1].serial,
  );
  if (start === -1) return;

  const combinedVersionsMap: RecordOptionalString = {};
  for (const versions of versionMaps) {
    Object.assign(combinedVersionsMap, versions.map);
  }

  type Rename = [path: string, version: number];
  const renames: Rename[] = [];
  const renamesMap: Record<string, Rename> = {};

  let minVersionToMigrate =
    files.find((file) => !combinedVersionsMap[file.version])?.serial ??
    Infinity;

  const migratedFiles: RebaseFile[] = [];
  let maxNewVersion = 0;

  let move = 0;
  for (let i = start; i < files.length; i++) {
    const prev = files[i - 1];
    const file = files[i];

    let moveFile: RebaseFile | undefined;

    const migratedName = combinedVersionsMap[file.version];

    if (prev.serial === file.serial) {
      if (migratedName) {
        if (prev.name === migratedName) {
          moveFile = prev;
        } else if (file.name === migratedName) {
          moveFile = file;
        }
      }

      if (moveFile) {
        if (moveFile.serial < minVersionToMigrate) {
          minVersionToMigrate = moveFile.serial;
        }

        migratedFiles.push(moveFile);
      } else if (!moveFile) {
        move++;

        const result = await promptSelect({
          message: 'Which should go first?',
          options: [prev.name, file.name],
          active: (s) => `${colors.yellow('❯')} ${colors.yellow(s)}`,
        });

        moveFile = result ? file : prev;
      }
    }

    let newVersion = file.serial;

    if (move) {
      newVersion += move;

      if (moveFile === prev && !renamesMap[prev.path]) newVersion--;

      if (file.serial !== newVersion) {
        if (newVersion < minVersionToMigrate) minVersionToMigrate = newVersion;

        const values = [file.path, newVersion] as Rename;
        renames.push(values);
        renamesMap[file.path] = values;
      }

      if (moveFile === prev) {
        if (prev.serial < minVersionToMigrate)
          minVersionToMigrate = prev.serial;

        newVersion = prev.serial + move;

        let item = [prev.path, newVersion] as Rename;

        if (renamesMap[prev.path]) {
          renamesMap[prev.path] = item;

          for (let i = renames.length - 1; i >= 0; i--) {
            const rename = renames[i];
            rename[1]--;

            renames[i] = item;

            if (rename[0] === prev.path) break;

            renamesMap[item[0]] = item;
            item = rename;
          }
        } else {
          renames.push(item);
          renamesMap[prev.path] = item;
        }
      }
    }

    if (file.name !== migratedName && newVersion > maxNewVersion) {
      maxNewVersion = newVersion;
    }
  }

  if (!renames.length && !migratedFiles.length) return;

  maxNewVersion++;

  renames.push(
    ...migratedFiles.map((file, i) => {
      const rename = [file.path, maxNewVersion + i] as Rename;
      renamesMap[file.path] = rename;
      return rename;
    }),
  );

  if (!renames.length) return;

  const migrationsDown = files.filter(
    (file) =>
      combinedVersionsMap[file.version] === file.name &&
      file.serial >= minVersionToMigrate,
  );

  const migrationsUp = files
    .reduce<MigrationItem[]>((files, file) => {
      const rename = renamesMap[file.path];
      if (rename) {
        const version = String(rename[1]).padStart(4, '0');
        files.push({
          ...file,
          path: path.join(
            path.dirname(rename[0]),
            version + path.basename(rename[0]).slice(version.length),
          ),
          version,
        });
      } else if (
        !combinedVersionsMap[file.version] ||
        file.serial >= minVersionToMigrate
      ) {
        files.push(file);
      }
      return files;
    }, [])
    .sort((a, b) => +b.version - +a.version);

  set.migrations = migrationsDown;

  await fullRedo(
    ctx,
    adapters,
    {
      ...config,
      async afterRollback() {
        set.migrations = migrationsUp;
      },
      async afterMigrate() {
        set.migrations = migrationsDown;
      },
    },
    ['all'],
  );

  for (let i = renames.length - 1; i >= 0; i--) {
    const [from, version] = renames[i];
    const prefix = String(version).padStart(4, '0');
    await fs.rename(
      from,
      path.join(
        path.dirname(from),
        prefix + path.basename(from).slice(prefix.length),
      ),
    );
  }
};
