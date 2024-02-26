import { AnyRakeDbConfig } from '../config';
import { quoteWithSchema } from '../common';
import path from 'path';
import fs from 'fs/promises';
import { generateTimeStamp } from './generate';
import { Adapter, AdapterOptions } from 'pqb';
import { getMigrationsFromFiles } from '../migration/migrationsSet';

export const fileNamesToChangeMigrationId = {
  serial: '.rename-to-serial.json',
  timestamp: '.rename-to-timestamp.json',
};

export const fileNamesToChangeMigrationIdMap = Object.fromEntries(
  Object.entries(fileNamesToChangeMigrationId).map(([_, name]) => [name, true]),
);

export const changeIds = async (
  options: AdapterOptions[],
  config: AnyRakeDbConfig,
  [arg]: string[],
) => {
  if (arg !== 'serial' && arg !== 'timestamp') {
    throw new Error(
      `Pass "serial" or "timestamp" argument to the "change-ids" command`,
    );
  }

  if (config.migrations) {
    throw new Error(
      `Cannot change migrations ids when migrations set is defined in the config`,
    );
  }

  const data = await getMigrationsFromFiles(config, false, (_, filePath) => {
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
    if (data.renameTo === arg) {
      config.logger?.log(`${fileNamesToChangeMigrationId[arg]} already exists`);
      return;
    }

    await fs.unlink(
      path.join(
        config.migrationsPath,
        fileNamesToChangeMigrationId[data.renameTo],
      ),
    );
  }

  const version = arg === 'timestamp' ? parseInt(generateTimeStamp()) : 1;

  const rename: Record<string, number> = Object.fromEntries(
    data.migrations.map((item, i) => [path.basename(item.path), version + i]),
  );

  await fs.writeFile(
    path.join(config.migrationsPath, fileNamesToChangeMigrationId[arg]),
    JSON.stringify(rename, null, 2),
  );

  const values: RenameMigrationVersionsValue[] = [];

  await Promise.all(
    data.migrations.map(async (item, i) => {
      let newVersion = String(version + i);

      if (arg === 'serial') newVersion = newVersion.padStart(4, '0');

      const name = path.basename(item.path).slice(item.version.length + 1);

      await fs.rename(
        item.path,
        path.join(path.dirname(item.path), `${newVersion}_${name}`),
      );

      values.push([item.version, name, newVersion]);
    }),
  );

  if (!values.length) return;

  await options.map((opts) => {
    const adapter = new Adapter(opts);
    renameMigrationVersionsInDb(config, adapter, values).then(() =>
      adapter.close(),
    );
  });
};

export type RenameMigrationVersionsValue = [
  oldVersion: string,
  name: string,
  newVersion: string,
];

export const renameMigrationVersionsInDb = async (
  config: AnyRakeDbConfig,
  adapter: Adapter,
  values: RenameMigrationVersionsValue[],
) => {
  await adapter.arrays({
    text: `UPDATE ${quoteWithSchema({
      name: config.migrationsTable,
    })} AS t SET version = v.version FROM (VALUES ${values
      .map(
        ([oldVersion, , newVersion], i) =>
          `('${oldVersion}', $${i + 1}, '${newVersion}')`,
      )
      .join(
        ', ',
      )}) v(oldVersion, name, version) WHERE t.version = v.oldVersion`,
    values: values.map(([, name]) => name),
  });
};
