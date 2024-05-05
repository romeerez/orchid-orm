import {
  getFirstWordAndRest,
  getTextAfterFrom,
  getTextAfterTo,
  RakeDbCtx,
} from '../common';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getImportPath, pathToLog } from 'orchid-core';
import { AnyRakeDbConfig } from '../config';
import { getMigrations } from '../migration/migrationsSet';

export const writeMigrationFile = async (
  config: AnyRakeDbConfig,
  version: string,
  name: string,
  migrationCode: string,
): Promise<void> => {
  await mkdir(config.migrationsPath, { recursive: true });

  const filePath = path.resolve(config.migrationsPath, `${version}_${name}.ts`);
  const importPath = getImportPath(
    filePath,
    path.join(config.basePath, config.dbScript),
  );

  await writeFile(
    filePath,
    `import { change } from '${importPath}';\n${migrationCode}`,
  );

  config.logger?.log(`Created ${pathToLog(filePath)}`);
};

export const newMigration = async (
  config: AnyRakeDbConfig,
  [name]: string[],
): Promise<void> => {
  if (!name) throw new Error('Migration name is missing');

  const version = await makeFileVersion({}, config);
  await writeMigrationFile(config, version, name, makeContent(name));
};

export const makeFileVersion = async (
  ctx: RakeDbCtx,
  config: AnyRakeDbConfig,
) => {
  if (config.migrationId === 'timestamp') {
    return generateTimeStamp();
  } else {
    const {
      migrations: [first],
    } = await getMigrations(ctx, config, false);
    return first
      ? String(parseInt(first.version) + 1).padStart(4, '0')
      : '0001';
  }
};

export const generateTimeStamp = () => {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ]
    .map((value) => (value < 10 ? `0${value}` : value))
    .join('');
};

const makeContent = (name: string): string => {
  let content = `\nchange(async (db) => {`;

  const [first, rest] = getFirstWordAndRest(name);
  if (rest) {
    if (first === 'create' || first === 'drop') {
      content += `\n  await db.${
        first === 'create' ? 'createTable' : 'dropTable'
      }('${rest}', (t) => ({\n    \n  }));`;
    } else if (first === 'change') {
      content += `\n  await db.changeTable('${rest}', (t) => ({\n    \n  }));`;
    } else if (first === 'add' || first === 'remove') {
      const table =
        first === 'add' ? getTextAfterTo(rest) : getTextAfterFrom(rest);
      content += `\n  await db.changeTable(${
        table ? `'${table}'` : 'tableName'
      }, (t) => ({\n    \n  }));`;
    }
  }

  return content + '\n});\n';
};
