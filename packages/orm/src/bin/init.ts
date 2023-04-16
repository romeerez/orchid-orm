import fs from 'fs/promises';
import { resolve, join, relative } from 'path';
import https from 'https';
import prompts from 'prompts';

export type InitConfig = {
  path: string;
  hasTsConfig: boolean;
  testDatabase?: boolean;
  addSchemaToZod?: boolean;
  addTestFactory?: boolean;
  demoTables?: boolean;
  timestamp?: 'date' | 'number';
  swc?: boolean;
};

type DependencyKind = 'dependencies' | 'devDependencies';

export const askOrchidORMConfig = async () => {
  let cancelled = false;

  const response = await prompts(
    [
      {
        type: 'text',
        name: 'path',
        message: 'Where would you like to install Orchid ORM?',
        initial: process.cwd(),
      },
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
    ],
    {
      onCancel() {
        cancelled = true;
      },
    },
  );

  if (cancelled) return;

  const tsConfigPath = join(response.path, 'tsconfig.json');
  const hasTsConfig = await readFileSafe(tsConfigPath);
  (response as InitConfig).hasTsConfig = !!hasTsConfig;

  if (!hasTsConfig) {
    const res = await prompts(
      [
        {
          type: 'confirm',
          name: 'swc',
          initial: true,
          message: `Let's add fast TS compiler swc?`,
        },
      ],
      {
        onCancel() {
          cancelled = true;
        },
      },
    );

    if (cancelled) return;

    (response as InitConfig).swc = res.swc;
  }

  return response as InitConfig;
};

export const initOrchidORM = async (config: InitConfig) => {
  config.path = resolve(config.path);
  const dirPath = join(config.path, 'src', 'db');

  await fs.mkdir(dirPath, { recursive: true });

  await setupPackageJson(config);
  await setupTSConfig(config);
  await setupEnv(config);
  await setupGitIgnore(config);
  await setupBaseTable(config, dirPath);
  await setupTables(config, dirPath);
  await setupConfig(config, dirPath);
  await setupMainDb(config, dirPath);
  await setupMigrationScript(config, dirPath);
  await createMigrations(config, dirPath);
  await createSeed(config, dirPath);

  greet(config);
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
    config.swc && getLatestPackageVersion('@swc/core', 'devDependencies'),
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

  const packageJsonPath = join(config.path, 'package.json');
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

const setupTSConfig = async (config: InitConfig) => {
  if (config.hasTsConfig) return;

  const tsConfigPath = join(config.path, 'tsconfig.json');
  await fs.writeFile(
    tsConfigPath,
    `{${
      config.swc
        ? `
  "ts-node": {
    "swc": true
  },`
        : ''
    }
  "compilerOptions": {
    "strict": true
  }
}
`,
  );
};

const setupEnv = async (config: InitConfig) => {
  const envPath = join(config.path, '.env');
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

const setupGitIgnore = async (config: InitConfig) => {
  const gitignorePath = join(config.path, '.gitignore');
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

const setupBaseTable = async (config: InitConfig, dirPath: string) => {
  const filePath = join(dirPath, 'baseTable.ts');

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

const setupTables = async (config: InitConfig, dirPath: string) => {
  if (!config.demoTables) return;

  const tablesDir = join(dirPath, 'tables');
  await fs.mkdir(tablesDir, { recursive: true });

  await fs.writeFile(
    join(tablesDir, 'post.table.ts'),
    `import { BaseTable } from '../baseTable';
import { CommentTable } from './comment.table';
${
  config.addSchemaToZod
    ? `import { tableToZod } from 'orchid-orm-schema-to-zod';\n`
    : ''
}
export type Post = PostTable['columns']['type'];
export class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
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
    join(tablesDir, 'comment.table.ts'),
    `import { BaseTable } from '../baseTable';
import { PostTable } from './post.table';
${
  config.addSchemaToZod
    ? `import { tableToZod } from 'orchid-orm-schema-to-zod';\n`
    : ''
}
export type Comment = CommentTable['columns']['type'];
export class CommentTable extends BaseTable {
  readonly table = 'comment';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
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

const setupConfig = async (config: InitConfig, dirPath: string) => {
  const configPath = join(dirPath, 'config.ts');

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

const setupMainDb = async (config: InitConfig, dirPath: string) => {
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

  const dbPath = join(dirPath, 'db.ts');
  await fs.writeFile(
    dbPath,
    `import { orchidORM } from 'orchid-orm';
import { config } from './config';${imports}

export const db = orchidORM(config.database, {${tables}
});
`,
  );
};

const setupMigrationScript = async (config: InitConfig, dirPath: string) => {
  const filePath = join(dirPath, 'dbScripts.ts');
  await fs.writeFile(
    filePath,
    `import { makeChange, rakeDb } from 'rake-db';
import { appCodeUpdater } from 'orchid-orm';
import { config } from './config';
import { BaseTable } from './baseTable.ts';

export const change = rakeDb(${
      config.testDatabase ? 'config.allDatabases' : 'config.database'
    }, {
  baseTable: BaseTable,
  migrationsPath: './migrations',
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => \`./tables/\${tableName}.table.ts\`,
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

const createMigrations = async (config: InitConfig, dirPath: string) => {
  const migrationsPath = join(dirPath, 'migrations');
  await fs.mkdir(migrationsPath, { recursive: true });

  if (!config.demoTables) return;

  const now = new Date();

  const postPath = join(
    migrationsPath,
    `${makeFileTimeStamp(now)}_createPost.ts`,
  );
  await fs.writeFile(
    postPath,
    `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('post', (t) => ({
    id: t.identity().primaryKey(),
    title: t.text().unique(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
`,
  );

  now.setTime(now.getTime() + 1000);

  const commentPath = join(
    migrationsPath,
    `${makeFileTimeStamp(now)}_createComment.ts`,
  );
  await fs.writeFile(
    commentPath,
    `import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('comment', (t) => ({
    id: t.identity().primaryKey(),
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

const createSeed = async (config: InitConfig, dirPath: string) => {
  const filePath = join(dirPath, 'seed.ts');

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

const greet = (config: InitConfig) => {
  const relativePath = relative(process.cwd(), config.path);

  console.log(`
Thank you for trying Orchid ORM!
  
To finish setup,${
    relativePath ? ` cd to the project and` : ''
  } install dependencies:
${
  relativePath
    ? `
> cd ${relativePath}`
    : ''
}
> npm i

Enter the correct database credentials to the .env file,
then create the database:

> npm run db create

And run the migrations:

> npm run db migrate
`);
};
