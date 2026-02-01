import { RakeDbCtx } from '../common';
import path from 'path';
import { getMigratedVersionsMap } from '../migration/manage-migrated-versions';
import { pathToFileURL } from 'node:url';
import { AnyRakeDbConfig } from '../config';
import { getMigrations } from '../migration/migrations-set';
import { AdapterBase, colors } from 'pqb';

export const listMigrationsStatuses = async (
  adapters: AdapterBase[],
  config: AnyRakeDbConfig,
  args: string[],
) => {
  const ctx: RakeDbCtx = {};

  const [{ migrations }, ...migrated] = await Promise.all([
    getMigrations(ctx, config, true),
    ...adapters.map((adapter) => getMigratedVersionsMap(ctx, adapter, config)),
  ]);

  const map: {
    [K: string]: {
      databases: string[];
      migrations: {
        up: boolean;
        version: string;
        name: string;
        url: URL;
      }[];
    };
  } = {};

  let maxVersionLength = 12;
  let maxNameLength = 4;

  for (let i = 0; i < adapters.length; i++) {
    const list = migrated[i];
    const key = Object.entries(list.map)
      .map(([version, up]) => `${version}${up ? 't' : 'f'}`)
      .join('');

    const database = adapters[i].getDatabase();

    if (map[key]) {
      map[key].databases.push(database);
      continue;
    }

    map[key] = {
      databases: [database],
      migrations: migrations.map((item) => {
        if (item.version.length > maxVersionLength) {
          maxVersionLength = item.version.length;
        }

        const name = path
          .parse(item.path)
          .name.slice(item.version.length + 1)
          .replace(
            /([a-z])([A-Z])/g,
            (_, a, b) => `${a} ${b.toLocaleLowerCase()}`,
          )
          .replace(/[-_](.)/g, (_, char) => ` ${char.toLocaleLowerCase()}`)
          .replace(/^\w/, (match) => match.toLocaleUpperCase());

        if (name.length > maxNameLength) {
          maxNameLength = name.length;
        }

        return {
          up: !!list.map[item.version],
          version: item.version,
          name,
          url: pathToFileURL(item.path),
        };
      }),
    };
  }

  const showUrl = args.includes('p') || args.includes('path');

  const asIs = (s: string) => s;

  const c =
    typeof config.log === 'object' && config.log.colors === false
      ? {
          yellow: asIs,
          green: asIs,
          red: asIs,
          blue: asIs,
        }
      : colors;

  const log = Object.values(map)
    .map(({ databases, migrations }) => {
      let log = ` ${c.yellow('Database:')} ${databases.join(', ')}`;

      if (migrations.length === 0) {
        return log + `\n\nNo migrations available`;
      }

      const lineSeparator = c.yellow(
        makeChars(14 + maxVersionLength + maxNameLength, '-'),
      );
      const columnSeparator = c.yellow('|');

      log +=
        '\n\n ' +
        c.yellow(
          `Status | Migration ID${makeChars(
            maxVersionLength - 12,
            ' ',
          )} | Name\n${lineSeparator}`,
        );

      for (const migration of migrations) {
        log += `\n  ${
          migration.up ? ` ${c.green('Up')} ` : c.red('Down')
        }  ${columnSeparator} ${c.blue(migration.version)}${makeChars(
          maxVersionLength - migration.version.length,
          ' ',
        )} ${columnSeparator} ${migration.name}`;

        if (showUrl) {
          log += `\n${migration.url}\n`;
        }
      }

      return (log += showUrl ? lineSeparator : `\n${lineSeparator}`);
    })
    .join('\n\n');

  (config.logger ?? console).log(log);

  await Promise.all(adapters.map((adapter) => adapter.close()));
};

const makeChars = (count: number, char: string) => {
  let chars = '';

  for (let i = 0; i < count; i++) {
    chars += char;
  }

  return chars;
};
