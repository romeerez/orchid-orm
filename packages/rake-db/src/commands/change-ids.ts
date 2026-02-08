import { RakeDbConfig } from '../config';
import path from 'path';
import fs from 'fs/promises';
import { generateTimeStamp } from './new-migration';
import { getMigrations } from '../migration/migrations-set';
import { AdapterBase } from 'pqb';

import { migrationsSchemaTableSql } from '../migration/migration.utils';

export const fileNamesToChangeMigrationId = {
  serial: '.rename-to-serial.json',
  timestamp: '.rename-to-timestamp.json',
};

export const fileNamesToChangeMigrationIdMap = Object.fromEntries(
  Object.entries(fileNamesToChangeMigrationId).map(([, name]) => [name, true]),
);

export const changeIds = async (
  adapters: AdapterBase[],
  config: RakeDbConfig,
  { format, digits = 4 }: { format: 'serial' | 'timestamp'; digits?: number },
) => {
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
      (format === 'serial' &&
        typeof data.renameTo.to === 'object' &&
        digits === data.renameTo.to.serial) ||
      (format === 'timestamp' && data.renameTo.to === 'timestamp')
    ) {
      config.logger?.log(
        config.migrations
          ? '`renameMigrations` setting is already set'
          : `${fileNamesToChangeMigrationId[format]} already exists`,
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

  const version = format === 'timestamp' ? parseInt(generateTimeStamp()) : 1;

  const rename: Record<string, number> = Object.fromEntries(
    data.migrations.map((item, i) => [path.basename(item.path), version + i]),
  );

  if (config.migrations) {
    const to = format === 'timestamp' ? `'${format}'` : `{ serial: ${digits} }`;
    config.logger?.log(
      `Save the following settings into your rake-db config under the \`migrations\` setting, it will instruct rake-db to rename migration entries during the next deploy:\n${
        format !== 'serial' || digits !== 4 ? `\nmigrationId: ${to},` : ''
      }\nrenameMigrations: {\n  to: ${to},\n  map: {\n    ` +
        Object.entries(rename)
          .map(([key, value]) => `"${key}": ${value},`)
          .join('\n    ') +
        '\n  },\n},\n\n',
    );
  } else {
    await fs.writeFile(
      path.join(config.migrationsPath, fileNamesToChangeMigrationId[format]),
      JSON.stringify(rename, null, 2),
    );
  }

  const values: RenameMigrationVersionsValue[] = data.migrations.map(
    (item, i) => {
      let newVersion = String(version + i);

      if (format === 'serial') newVersion = newVersion.padStart(digits, '0');

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
      fileNamesToChangeMigrationId[format]
    } for renaming migrations after deploy was created, and migrations in local db were renamed successfully.\n\n${
      format === 'timestamp' || digits !== 4
        ? `Set \`migrationId\`: ${
            format === 'timestamp' ? `'timestamp'` : `{ serial: ${digits} }`
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
  config: Pick<RakeDbConfig, 'migrationsTable'>,
  adapter: AdapterBase,
  values: RenameMigrationVersionsValue[],
) => {
  await adapter.arrays(
    `UPDATE ${migrationsSchemaTableSql(
      config,
    )} AS t SET version = v.version FROM (VALUES ${values
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
