import {
  getFirstWordAndRest,
  getTextAfterFrom,
  getTextAfterTo,
  MigrationConfig,
} from '../common';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export const generate = async (config: MigrationConfig, args: string[]) => {
  const name = args[0];
  if (!name) throw new Error('Migration name is missing');

  await mkdir(config.migrationsPath, { recursive: true });

  const filePath = path.resolve(
    config.migrationsPath,
    `${makeFileTimeStamp()}_${name}.ts`,
  );
  await writeFile(filePath, makeContent(name, args.slice(1)));
  console.log(`Created ${filePath}`);
};

const makeFileTimeStamp = () => {
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

const makeContent = (name: string, args: string[]): string => {
  let content = `import { change } from 'rake-db';\n\nchange(async (db) => {`;

  const [first, rest] = getFirstWordAndRest(name);
  if (rest) {
    if (first === 'create' || first === 'drop') {
      content += `\n  db.${
        first === 'create' ? 'createTable' : 'dropTable'
      }('${rest}', (t) => ({`;
      content += makeColumnsContent(args);
      content += '\n  }));';
    } else if (first === 'change') {
      content += `\n  db.changeTable('${rest}', (t) => ({`;
      content += '\n  }));';
    } else if (first === 'add' || first === 'remove') {
      const table =
        first === 'add' ? getTextAfterTo(rest) : getTextAfterFrom(rest);
      content += `\n  db.changeTable(${
        table ? `'${table}'` : 'tableName'
      }, (t) => ({`;
      content += makeColumnsContent(args, first);
      content += '\n  }));';
    }
  }

  return content + '\n});\n';
};

const makeColumnsContent = (args: string[], method?: string) => {
  let content = '';
  const prepend = method ? `t.${method}(` : '';
  const append = method ? ')' : '';

  for (const arg of args) {
    const [name, def] = arg.split(':');
    if (!def) {
      throw new Error(
        `Column argument should be similar to name:type, name:type.method1.method2, name:type(arg).method(arg). Example: name:varchar(20).nullable. Received: ${arg}`,
      );
    }

    const methods = def
      .split('.')
      .map((method) => (method.endsWith(')') ? `.${method}` : `.${method}()`));
    content += `\n    ${name}: ${prepend}t${methods.join('')}${append},`;
  }
  return content;
};
