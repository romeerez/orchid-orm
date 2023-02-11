import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import prompts from 'prompts';

export type InitConfig = {
  testDatabase?: boolean;
  addSchemaToZod?: boolean;
  addTestFactory?: boolean;
  demoTables?: boolean;
  timestamp?: 'date' | 'number';
};

type DependencyKind = 'dependencies' | 'devDependencies';

const dirPath = path.resolve(process.cwd(), 'src', 'db');

export const askOrchidORMConfig = async () => {
  const response = await prompts([
    {
      type: 'select',
      name: 'timestamp',
      message: 'Preferred type of returned timestamps:',
      choices: [
        {
          title: 'string (as returned from db)',
        },
        {
          title: 'number (epoch)',
          value: 'number',
        },
        {
          title: 'Date object',
          value: 'date',
        },
      ],
    },
    {
      type: 'confirm',
      name: 'testDatabase',
      message: 'Should I add a separate database for tests?',
    },
    {
      type: 'confirm',
      name: 'addSchemaToZod',
      message: 'Are you going to use Zod for validation?',
    },
    {
      type: 'confirm',
      name: 'addTestFactory',
      message: 'Do you want object factories for writing tests?',
    },
    {
      type: 'confirm',
      name: 'demoTables',
      message: 'Should I add demo tables?',
    },
  ]);

  return response as InitConfig;
};

export const initOrchidORM = async (config: InitConfig) => {
  await fs.mkdir(dirPath, { recursive: true });

  await setupPackageJson(config);
  await setupTSConfig();
  await setupEnv(config);
  await setupGitIgnore();
  await setupBaseTable(config);
  await setupTables(config);
  await setupConfig(config);
  await setupMainDb(config);
  await setupMigrationScript(config);
  await createMigrations(config);
  await createSeed(config);

  greet();
};

const setupPackageJson = async (config: InitConfig) => {
  const pairs = await Promise.all([
    getLatestPackageVersion('dotenv', 'dependencies'),
    getLatestPackageVersion('orchid-orm', 'dependencies'),
    getLatestPackageVersion('pqb', 'dependencies'),
    getLatestPackageVersion('pg', 'dependencies'),
    config.addSchemaToZod &&
      getLatestPackageVersion('orchid-orm-schema-to-zod', 'dependencies'),
    getLatestPackageVersion('rake-db', 'devDependencies'),
    config.addTestFactory &&
      getLatestPackageVersion('orchid-orm-test-factory', 'devDependencies'),
    getLatestPackageVersion('@swc/core', 'devDependencies'),
    getLatestPackageVersion('@types/node', 'devDependencies'),
    getLatestPackageVersion('ts-node', 'devDependencies'),
    getLatestPackageVersion('typescript', 'devDependencies'),
  ]);

  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = {};
  for (const item of pairs) {
    if (!item) continue;
    const [key, { version, kind }] = item;
    (kind === 'dependencies' ? deps : devDeps)[key] = version;
  }

  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const content = await readFileSafe(packageJsonPath);
  const json = content ? JSON.parse(content) : {};

  if (!json.scripts) json.scripts = {};
  json.scripts.db = 'ts-node src/db/dbScripts.ts';

  if (!json.dependencies) json.dependencies = {};

  for (const key in deps) {
    json.dependencies[key] = deps[key];
  }

  if (!json.devDependencies) json.devDependencies = {};
  for (const key in devDeps) {
    json.devDependencies[key] = devDeps[key];
  }

  await fs.writeFile(packageJsonPath, JSON.stringify(json, null, '  ') + '\n');
};

const getLatestPackageVersion = (
  name: string,
  kind: DependencyKind,
): Promise<[string, { version: string; kind: DependencyKind }]> => {
  return new Promise((resolve, reject) => {
    https
      .get(`https://registry.npmjs.org/${name}/latest`, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve([name, { version: `^${JSON.parse(data).version}`, kind }]),
        );
      })
      .on('error', reject);
  });
};

const readFileSafe = async (path: string) => {
  try {
    return await fs.readFile(path, 'utf-8');
  } catch (err) {
    if ((err as unknown as { code: string }).code === 'ENOENT') {
      return undefined;
    }
    throw err;
  }
};

const setupTSConfig = async () => {
  const tsConfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  const content = await readFileSafe(tsConfigPath);
  const json = content ? JSON.parse(content) : {};
  if (!json['ts-node']) {
    json['ts-node'] = {};
  }
  if (!json['ts-node'].swc) {
    json['ts-node'].swc = true;
  }
  if (!json.compilerOptions?.strict) {
    if (!json.compilerOptions) json.compilerOptions = {};
    json.compilerOptions.strict = true;
    await fs.writeFile(tsConfigPath, `${JSON.stringify(json, null, '  ')}\n`);
  }
};

const setupEnv = async (config: InitConfig) => {
  const envPath = path.resolve(process.cwd(), '.env');
  let content = ((await readFileSafe(envPath)) || '').trim();
  let changed = false;

  if (!content.match(/^DATABASE_URL=/m)) {
    content += `\nDATABASE_URL=postgres://user:password@localhost:5432/dbname?ssl=false`;
    changed = true;
  }

  if (config.testDatabase && !content.match(/^DATABASE_TEST_URL=/m)) {
    content += `\nDATABASE_TEST_URL=postgres://user:password@localhost:5432/dbname-test?ssl=false`;
    changed = true;
  }

  if (changed) {
    await fs.writeFile(envPath, `${content.trim()}\n`);
  }
};

const setupGitIgnore = async () => {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  let content = ((await readFileSafe(gitignorePath)) || '').trim();
  let changed = false;

  if (!content.match(/^node_modules\b/m)) {
    content += `\nnode_modules`;
    changed = true;
  }

  if (!content.match(/^.env\b/m)) {
    content += `\n.env`;
    changed = true;
  }

  if (changed) {
    await fs.writeFile(gitignorePath, `${content.trim()}\n`);
  }
};

const setupBaseTable = async (config: InitConfig) => {
  const filePath = path.join(dirPath, 'baseTable.ts');

  let content = `import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 0, max = Infinity) => t.text(min, max),`;

  const { timestamp } = config;
  if (timestamp) {
    content += `
    timestamp: <P extends number>(precision?: P) =>
      t.timestamp<P>(precision).${
        timestamp === 'date' ? 'asDate' : 'asNumber'
      }(),`;
  }

  content += `
  }),
});
`;

  await fs.writeFile(filePath, content);
};

const setupTables = async (config: InitConfig) => {
  if (!config.demoTables) return;

  const tablesDir = path.join(dirPath, 'tables');
  await fs.mkdir(tablesDir, { recursive: true });

  await fs.writeFile(
    path.join(tablesDir, 'post.table.ts'),
    `import { BaseTable } from '../baseTable';
import { CommentTable } from './comment.table';
${
  config.addSchemaToZod
    ? `import { tableToZod } from 'orchid-orm-schema-to-zod';\n`
    : ''
}
export type Post = PostTable['columns']['type'];
export class PostTable extends BaseTable {
  table = 'post';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    title: t.text(3, 100).unique(),
    text: t.text(20, 10000),
    ...t.timestamps(),
  }));

  relations = {
    comments: this.hasMany(() => CommentTable, {
      primaryKey: 'id',
      foreignKey: 'postId',
    }),
  };
}
${
  config.addSchemaToZod
    ? `\nexport const postSchema = tableToZod(PostTable);\n`
    : ''
}`,
  );

  await fs.writeFile(
    path.join(tablesDir, 'comment.table.ts'),
    `import { BaseTable } from '../baseTable';
import { PostTable } from './post.table';
${
  config.addSchemaToZod
    ? `import { tableToZod } from 'orchid-orm-schema-to-zod';\n`
    : ''
}
export type Comment = CommentTable['columns']['type'];
export class CommentTable extends BaseTable {
  table = 'comment';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    postId: t
      .integer()
      .foreignKey(() => PostTable, 'id')
      .index(),
    text: t.text(5, 1000),
    ...t.timestamps(),
  }));

  relations = {
    post: this.belongsTo(() => PostTable, {
      primaryKey: 'id',
      foreignKey: 'postId',
    }),
  };
}
${
  config.addSchemaToZod
    ? `\nexport const commentSchema = tableToZod(CommentTable);\n`
    : ''
}`,
  );
};

const setupConfig = async (config: InitConfig) => {
  const configPath = path.join(dirPath, 'config.ts');

  let content = `import 'dotenv/config';

const database = {
  databaseURL: process.env.DATABASE_URL,
};
if (!database.databaseURL) throw new Error('DATABASE_URL is missing in .env');`;

  if (config.testDatabase) {
    content += `

const testDatabase = {
  databaseURL: process.env.DATABASE_TEST_URL,
};

const allDatabases = [database];

if (testDatabase.databaseURL) {
  allDatabases.push(testDatabase);
}`;
  }

  content += `

export const config = {`;

  if (config.testDatabase) {
    content += `
  allDatabases,`;
  }

  if (config.testDatabase) {
    content += `
  database: process.env.NODE_ENV === 'test' ? testDatabase : database,`;
  } else {
    content += `
  database,`;
  }
  content += `
};
`;

  await fs.writeFile(configPath, content);
};

const setupMainDb = async (config: InitConfig) => {
  let imports = '';
  let tables = '';
  if (config.demoTables) {
    imports += `
import { PostTable } from './tables/post.table';
import { CommentTable } from './tables/comment.table';`;
    tables += `
  post: PostTable,
  comment: CommentTable,`;
  }

  const dbPath = path.join(dirPath, 'db.ts');
  await fs.writeFile(
    dbPath,
    `import { orchidORM } from 'orchid-orm';
import { config } from './config';${imports}

export const db = orchidORM(config.database, {${tables}
});
`,
  );
};

const setupMigrationScript = async (config: InitConfig) => {
  const filePath = path.join(dirPath, 'dbScripts.ts');
  await fs.writeFile(
    filePath,
    `import { rakeDb } from 'rake-db';
import { config } from './config';
import { appCodeUpdater } from 'orchid-orm';

rakeDb(${config.testDatabase ? 'config.allDatabases' : 'config.database'}, {
  migrationsPath: './migrations',
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => \`./tables/\${tableName}.table.ts\`,
    baseTablePath: './baseTable.ts',
    baseTableName: 'BaseTable',
    mainFilePath: './db.ts',
  }),
  useCodeUpdater: true, // set to false to disable code updater
  commands: {
    async seed() {
      const { seed } = await import('./seed');
      await seed();
    },
  },
});
`,
  );
};

const createMigrations = async (config: InitConfig) => {
  const migrationsPath = path.join(dirPath, 'migrations');
  await fs.mkdir(migrationsPath);

  if (!config.demoTables) return;

  const now = new Date();

  const postPath = path.join(
    migrationsPath,
    `${makeFileTimeStamp(now)}_createPost.ts`,
  );
  await fs.writeFile(
    postPath,
    `import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('post', (t) => ({
    id: t.serial().primaryKey(),
    title: t.text().unique(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
`,
  );

  now.setTime(now.getTime() + 1000);

  const commentPath = path.join(
    migrationsPath,
    `${makeFileTimeStamp(now)}_createComment.ts`,
  );
  await fs.writeFile(
    commentPath,
    `import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('comment', (t) => ({
    id: t.serial().primaryKey(),
    postId: t.integer().foreignKey('post', 'id').index(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
`,
  );
};

const makeFileTimeStamp = (now: Date) => {
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

const createSeed = async (config: InitConfig) => {
  const filePath = path.join(dirPath, 'seed.ts');

  let content;
  if (config.demoTables) {
    content = `await db.post.findBy({ title: 'Sample post' }).orCreate({
    title: 'Post',
    text: 'This is a text for a sample post. It contains words, spaces, and punctuation.',
    comments: {
      create: [
        {
          text: 'Nice post!',
        },
        {
          text: \`Too long, didn't read\`,
        },
      ],
    },
  });`;
  } else {
    content = `// create records here`;
  }

  await fs.writeFile(
    filePath,
    `import { db } from './db';

export const seed = async () => {
  ${content}

  await db.$close();
};
`,
  );
};

const greet = () => {
  console.log(`
Thank you for trying Orchid ORM!
  
To finish setup, install dependencies:

> npm i

Enter the correct database credentials to the .env file,
then create the database:

> npm run db create

And run the migrations:

> npm run db migrate
`);
};
