import { AnyRakeDbConfig, PickMigrationsTable } from '../config';
import path from 'path';
import fs from 'fs/promises';
import { generateTimeStamp } from './newMigration';
import { getMigrations } from '../migration/migrationsSet';
import { AdapterBase } from 'pqb';

export const fileNamesToChangeMigrationId = {
  serial: '.rename-to-serial.json',
  timestamp: '.rename-to-timestamp.json',
};

export const fileNamesToChangeMigrationIdMap = Object.fromEntries(
  Object.entries(fileNamesToChangeMigrationId).map(([_, name]) => [name, true]),
);

export const changeIds = async (
  adapters: AdapterBase[],
  config: AnyRakeDbConfig,
  [arg, digitsArg]: string[],
) => {
  if (arg !== 'serial' && arg !== 'timestamp') {
    throw new Error(
      `Pass "serial" or "timestamp" argument to the "change-ids" command`,
    );
  }

  let digits = digitsArg && parseInt(digitsArg);
  if (!digits || isNaN(digits)) digits = 4;

  const data = await getMigrations({}, config, true, false, (_, filePath) => {
    const fileName = path.basename(filePath);
    const match = fileName.match(/^(\d+)\D/);
    if (!match) {
      throw new Error(
        `Migration file name should start digits, received ${fileName}`,
      );
    }

    return match[1];
  });

  if (data.renameTo) {
    if (
      (arg === 'serial' &&
        typeof data.renameTo.to === 'object' &&
        digits === data.renameTo.to.serial) ||
      (arg === 'timestamp' && data.renameTo.to === 'timestamp')
    ) {
      config.logger?.log(
        config.migrations
          ? '`renameMigrations` setting is already set'
          : `${fileNamesToChangeMigrationId[arg]} already exists`,
      );
      return;
    }

    if (!config.migrations) {
      await fs.unlink(
        path.join(
          config.migrationsPath,
          fileNamesToChangeMigrationId[
            data.renameTo.to === 'timestamp' ? 'timestamp' : 'serial'
          ],
        ),
      );
    }
  }

  const version = arg === 'timestamp' ? parseInt(generateTimeStamp()) : 1;

  const rename: Record<string, number> = Object.fromEntries(
    data.migrations.map((item, i) => [path.basename(item.path), version + i]),
  );

  if (config.migrations) {
    const to = arg === 'timestamp' ? `'${arg}'` : `{ serial: ${digits} }`;
    config.logger?.log(
      `Save the following settings into your rake-db config under the \`migrations\` setting, it will instruct rake-db to rename migration entries during the next deploy:\n${
        arg !== 'serial' || digits !== 4 ? `\nmigrationId: ${to},` : ''
      }\nrenameMigrations: {\n  to: ${to},\n  map: {\n    ` +
        Object.entries(rename)
          .map(([key, value]) => `"${key}": ${value},`)
          .join('\n    ') +
        '\n  },\n},\n\n',
    );
  } else {
    await fs.writeFile(
      path.join(config.migrationsPath, fileNamesToChangeMigrationId[arg]),
      JSON.stringify(rename, null, 2),
    );
  }

  const values: RenameMigrationVersionsValue[] = data.migrations.map(
    (item, i) => {
      let newVersion = String(version + i);

      if (arg === 'serial') newVersion = newVersion.padStart(digits, '0');

      const name = path.basename(item.path).slice(item.version.length + 1);

      return [item.version, name, newVersion];
    },
  );
  if (!values.length) return;

  if (config.migrations) {
    config.logger?.log(
      `If your migrations are stored in files, navigate to migrations directory and run the following commands to rename them:\n\n${values
        .map(
          ([version, name, newVersion]) =>
            `mv "${version}_${name}" "${newVersion}_${name}"`,
        )
        .join(
          '\n',
        )}\n\nAfter setting \`renameMigrations\` (see above) and renaming the files, run the db up command to rename migration entries in your database`,
    );
    return;
  }

  await Promise.all(
    data.migrations.map(async (item, i) => {
      const [, name, newVersion] = values[i];
      await fs.rename(
        item.path,
        path.join(path.dirname(item.path), `${newVersion}_${name}`),
      );
    }),
  );

  await Promise.all(
    adapters.map((adapter) => {
      renameMigrationVersionsInDb(config, adapter, values).then(() =>
        adapter.close(),
      );
    }),
  );

  config.logger?.log(
    `Migration files were renamed, a config file ${
      fileNamesToChangeMigrationId[arg]
    } for renaming migrations after deploy was created, and migrations in local db were renamed successfully.\n\n${
      arg === 'timestamp' || digits !== 4
        ? `Set \`migrationId\`: ${
            arg === 'timestamp' ? `'timestamp'` : `{ serial: ${digits} }`
          }`
        : `Remove \`migrationId\``
    } setting in the rake-db config`,
  );
};

export type RenameMigrationVersionsValue = [
  oldVersion: string,
  name: string,
  newVersion: string | number,
];

export const renameMigrationVersionsInDb = async (
  config: PickMigrationsTable,
  adapter: AdapterBase,
  values: RenameMigrationVersionsValue[],
) => {
  await adapter.arrays(
    `UPDATE "${
      config.migrationsTable
    }" AS t SET version = v.version FROM (VALUES ${values
      .map(
        ([oldVersion, , newVersion], i) =>
          `('${oldVersion}', $${i + 1}, '${newVersion}')`,
      )
      .join(
        ', ',
      )}) v(oldVersion, name, version) WHERE t.version = v.oldVersion`,
    values.map(([, name]) => name),
  );
};
