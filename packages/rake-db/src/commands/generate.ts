import {
  getFirstWordAndRest,
  getTextAfterFrom,
  getTextAfterTo,
  RakeDbConfig,
} from '../common';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { pathToLog } from 'orchid-core';

export const writeMigrationFile = async (
  config: RakeDbConfig,
  version: string,
  name: string,
  content: string,
) => {
  await mkdir(config.migrationsPath, { recursive: true });

  const filePath = path.resolve(config.migrationsPath, `${version}_${name}.ts`);
  await writeFile(filePath, content);
  config.logger?.log(`Created ${pathToLog(filePath)}`);
};

export const generate = async (config: RakeDbConfig, [name]: string[]) => {
  if (!name) throw new Error('Migration name is missing');

  const version = makeFileTimeStamp();
  await writeMigrationFile(config, version, name, makeContent(name));
};

export const makeFileTimeStamp = () => {
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
  let content = `import { change } from 'rake-db';\n\nchange(async (db) => {`;

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
