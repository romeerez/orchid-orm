import { askOrchidORMConfig, initOrchidORM } from './init';
import fs from 'fs/promises';
import { asMock } from '../codegen/testUtils';
import { resolve, join } from 'path';
import prompts from 'prompts';

jest.mock('https', () => ({
  get(
    this: { result: string },
    _: string,
    cb: (res: {
      on(event: string, cb: (chunk?: string) => void): void;
    }) => void,
  ) {
    cb({
      on: (event: string, cb: (chunk?: string) => void) => {
        if (event === 'data') {
          cb(`{"version":"1.2.3"}`);
        } else if (event === 'end') {
          cb();
        }
      },
    });
  },
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

jest.mock('prompts', () => jest.fn());

class EnoentError extends Error {
  code = 'ENOENT';
}

const config = {
  path: 'project',
  hasTsConfig: true,
};

const path = resolve(config.path);
const packageJSONPath = join(path, 'package.json');
const tsConfigPath = join(path, 'tsconfig.json');
const envPath = join(path, '.env');
const gitignorePath = join(path, '.gitignore');
const dbDirPath = join(path, 'src', 'db');
const baseTablePath = join(dbDirPath, 'baseTable.ts');
const tablesDir = join(dbDirPath, 'tables');
const postTablePath = join(tablesDir, 'post.table.ts');
const commentTablePath = join(tablesDir, 'comment.table.ts');
const configPath = join(dbDirPath, 'config.ts');
const dbPath = join(dbDirPath, 'db.ts');
const migrationScriptPath = join(dbDirPath, 'dbScripts.ts');
const migrationsPath = join(dbDirPath, 'migrations');
const seedPath = join(dbDirPath, 'seed.ts');

const log = jest.fn();
console.log = log;

describe('askOrchidORMConfig', () => {
  beforeEach(jest.clearAllMocks);

  it('should ask about swc if no tsconfig', async () => {
    asMock(prompts).mockResolvedValueOnce({ ...config });
    asMock(prompts).mockResolvedValueOnce({ swc: true });
    asMock(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

    const res = await askOrchidORMConfig();

    expect(prompts).toBeCalledTimes(2);
    expect(res?.swc).toBe(true);
  });

  it('should not ask about swc if has tsconfig', async () => {
    asMock(prompts).mockResolvedValueOnce({ ...config });
    asMock(fs.readFile).mockResolvedValue('tsconfig content');

    const res = await askOrchidORMConfig();
    console.log(res);

    expect(prompts).toBeCalledTimes(1);
    expect(res?.swc).toBe(undefined);
  });

  it('should return undefined if cancelled in first prompts', async () => {
    asMock(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

    asMock(prompts).mockImplementation(
      (_: unknown, opts: { onCancel(): void }) => {
        opts.onCancel();
      },
    );

    const res = await askOrchidORMConfig();

    expect(prompts).toBeCalledTimes(1);
    expect(res).toBe(undefined);
  });

  it('should return undefined if cancelled in second prompts', async () => {
    asMock(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

    let time = 1;
    asMock(prompts).mockImplementation(
      (_: unknown, opts: { onCancel(): void }) => {
        if (time++ === 1) return config;

        opts.onCancel();
        return;
      },
    );

    const res = await askOrchidORMConfig();

    expect(prompts).toBeCalledTimes(2);
    expect(res).toBe(undefined);
  });
});

describe('initOrchidORM', () => {
  beforeEach(jest.clearAllMocks);

  it('should create db directory', async () => {
    await initOrchidORM(config);

    expect(fs.mkdir).toBeCalledWith(dbDirPath, { recursive: true });
  });

  describe('package.json', () => {
    const packageJSON = ({
      schemaToZod,
      testFactory,
      swc,
    }: {
      schemaToZod?: boolean;
      testFactory?: boolean;
      swc?: boolean;
    }) => `{
  "scripts": {
    "db": "ts-node src/db/dbScripts.ts"
  },
  "dependencies": {
    "dotenv": "^1.2.3",
    "orchid-orm": "^1.2.3",
    "pqb": "^1.2.3",
    "pg": "^1.2.3"${
      schemaToZod
        ? `,
    "orchid-orm-schema-to-zod": "^1.2.3"`
        : ''
    }
  },
  "devDependencies": {
    "rake-db": "^1.2.3",${
      testFactory
        ? `
    "orchid-orm-test-factory": "^1.2.3",`
        : ''
    }${
      swc
        ? `
    "@swc/core": "^1.2.3",`
        : ''
    }
    "@types/node": "^1.2.3",
    "ts-node": "^1.2.3",
    "typescript": "^1.2.3"
  }
}
`;

    it('should create package.json if not exist', async () => {
      asMock(fs.readFile).mockImplementation((path: string) => {
        if (path.endsWith('package.json')) {
          throw new EnoentError();
        }
      });

      await initOrchidORM(config);

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === packageJSONPath,
      );
      expect(content).toBe(packageJSON({}));
    });

    it('should create package.json with additional deps if not exist', async () => {
      asMock(fs.readFile).mockImplementation((path: string) => {
        if (path.endsWith('package.json')) {
          throw new EnoentError();
        }
      });

      await initOrchidORM({
        ...config,
        addSchemaToZod: true,
        addTestFactory: true,
        swc: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === packageJSONPath,
      );
      expect(content).toBe(
        packageJSON({
          schemaToZod: true,
          testFactory: true,
          swc: true,
        }),
      );
    });

    it('should add scripts, dependencies and devDependencies if they are not present in package.json', async () => {
      asMock(fs.readFile).mockImplementation((path: string) => {
        if (path.endsWith('package.json')) {
          return '{}';
        }
        return;
      });

      await initOrchidORM({
        ...config,
        addSchemaToZod: true,
        addTestFactory: true,
        swc: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === packageJSONPath,
      );
      expect(content).toBe(
        packageJSON({
          schemaToZod: true,
          testFactory: true,
          swc: true,
        }),
      );
    });

    it('should insert scripts and dependencies', async () => {
      asMock(fs.readFile).mockImplementation((path: string) => {
        if (path.endsWith('package.json')) {
          return `{
  "scripts": {
    "ko": "ko"
  },
  "dependencies": {
    "ko": "ko"
  },
  "devDependencies": {
    "ko": "ko"
  }
}`;
        }
        return;
      });

      await initOrchidORM({
        ...config,
        addSchemaToZod: true,
        addTestFactory: true,
        swc: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === packageJSONPath,
      );
      expect(content).toBe(
        `{
  "scripts": {
    "ko": "ko",
    "db": "ts-node src/db/dbScripts.ts"
  },
  "dependencies": {
    "ko": "ko",
    "dotenv": "^1.2.3",
    "orchid-orm": "^1.2.3",
    "pqb": "^1.2.3",
    "pg": "^1.2.3",
    "orchid-orm-schema-to-zod": "^1.2.3"
  },
  "devDependencies": {
    "ko": "ko",
    "rake-db": "^1.2.3",
    "orchid-orm-test-factory": "^1.2.3",
    "@swc/core": "^1.2.3",
    "@types/node": "^1.2.3",
    "ts-node": "^1.2.3",
    "typescript": "^1.2.3"
  }
}
`,
      );
    });
  });

  describe('tsconfig.json', () => {
    it('should create tsconfig.json if not not exist', async () => {
      await initOrchidORM({ ...config, hasTsConfig: false });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === tsConfigPath,
      );
      expect(content).toBe(`{
  "compilerOptions": {
    "strict": true
  }
}
`);
    });

    it('should create tsconfig.json with swc when is is true and config does not exist', async () => {
      await initOrchidORM({ ...config, swc: true, hasTsConfig: false });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === tsConfigPath,
      );
      expect(content).toBe(`{
  "ts-node": {
    "swc": true
  },
  "compilerOptions": {
    "strict": true
  }
}
`);
    });

    it('should not change tsconfig.json if it exists', async () => {
      await initOrchidORM({ ...config, hasTsConfig: true });

      expect(fs.writeFile).not.toBeCalledWith(tsConfigPath, expect.any(String));
    });
  });

  describe('.env', () => {
    it('should create .env if not exist', async () => {
      asMock(fs.readFile).mockImplementation((path: string) => {
        if (path.endsWith('.env')) {
          throw new EnoentError();
        }
      });

      await initOrchidORM(config);

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === envPath,
      );
      expect(content)
        .toBe(`DATABASE_URL=postgres://user:password@localhost:5432/dbname?ssl=false
`);
    });

    it('should append DATABASE_URL to existing .env', async () => {
      asMock(fs.readFile).mockImplementation((path: string) => {
        if (path.endsWith('.env')) {
          return 'KO=KO';
        }
        return '';
      });

      await initOrchidORM(config);

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === envPath,
      );
      expect(content).toBe(`KO=KO
DATABASE_URL=postgres://user:password@localhost:5432/dbname?ssl=false
`);
    });

    it('should append DATABASE_TEST_URL if testDatabase specified', async () => {
      asMock(fs.readFile).mockImplementation((path: string) => {
        if (path.endsWith('.env')) {
          return 'KO=KO';
        }
        return '';
      });

      await initOrchidORM({
        ...config,
        testDatabase: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === envPath,
      );
      expect(content).toBe(`KO=KO
DATABASE_URL=postgres://user:password@localhost:5432/dbname?ssl=false
DATABASE_TEST_URL=postgres://user:password@localhost:5432/dbname-test?ssl=false
`);
    });
  });

  describe('.gitignore', () => {
    it('should create .gitignore if not exists', async () => {
      asMock(fs.readFile).mockImplementation((path: string) => {
        if (path.endsWith('.gitignore')) {
          throw new EnoentError();
        }
      });

      await initOrchidORM(config);

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === gitignorePath,
      );
      expect(content).toBe(`node_modules
.env
`);
    });

    it('should append missing entries if .gitignore exists', async () => {
      asMock(fs.readFile).mockImplementation((path: string) => {
        if (path.endsWith('.gitignore')) {
          return 'node_modules/\nko';
        }
        return;
      });

      await initOrchidORM(config);

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === gitignorePath,
      );
      expect(content).toBe(`node_modules/
ko
.env
`);
    });
  });

  describe('baseTable', () => {
    it('should create base table', async () => {
      await initOrchidORM(config);

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === baseTablePath,
      );
      expect(content).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 0, max = Infinity) => t.text(min, max),
  }),
});
`);
    });

    it('should create base table with timestamp as date', async () => {
      await initOrchidORM({
        ...config,
        timestamp: 'date',
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === baseTablePath,
      );
      expect(content).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 0, max = Infinity) => t.text(min, max),
    timestamp: <P extends number>(precision?: P) =>
      t.timestamp<P>(precision).asDate(),
  }),
});
`);
    });

    it('should create base table with timestamp as number', async () => {
      await initOrchidORM({
        ...config,
        timestamp: 'number',
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === baseTablePath,
      );
      expect(content).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 0, max = Infinity) => t.text(min, max),
    timestamp: <P extends number>(precision?: P) =>
      t.timestamp<P>(precision).asNumber(),
  }),
});
`);
    });
  });

  describe('tables', () => {
    it('should do nothing if demoTables is not specified', async () => {
      await initOrchidORM(config);

      expect(fs.mkdir).not.toBeCalledWith(tablesDir, { recursive: true });
    });

    it('should create tables dir', async () => {
      await initOrchidORM({
        ...config,
        demoTables: true,
      });

      expect(fs.mkdir).toBeCalledWith(tablesDir, { recursive: true });
    });

    it('should create post table', async () => {
      await initOrchidORM({
        ...config,
        demoTables: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === postTablePath,
      );
      expect(content).toBe(`import { BaseTable } from '../baseTable';
import { CommentTable } from './comment.table';

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
`);
    });

    it('should create post table with zod schema', async () => {
      await initOrchidORM({
        ...config,
        demoTables: true,
        addSchemaToZod: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === postTablePath,
      );
      expect(content).toBe(`import { BaseTable } from '../baseTable';
import { CommentTable } from './comment.table';
import { tableToZod } from 'orchid-orm-schema-to-zod';

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

export const postSchema = tableToZod(PostTable);
`);
    });

    it('should create comment table', async () => {
      await initOrchidORM({
        ...config,
        demoTables: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === commentTablePath,
      );
      expect(content).toBe(`import { BaseTable } from '../baseTable';
import { PostTable } from './post.table';

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
`);
    });

    it('should create post table with zod schema', async () => {
      await initOrchidORM({
        ...config,
        demoTables: true,
        addSchemaToZod: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === commentTablePath,
      );
      expect(content).toBe(`import { BaseTable } from '../baseTable';
import { PostTable } from './post.table';
import { tableToZod } from 'orchid-orm-schema-to-zod';

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

export const commentSchema = tableToZod(CommentTable);
`);
    });
  });

  describe('config', () => {
    it('should create config file', async () => {
      await initOrchidORM(config);

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === configPath,
      );
      expect(content).toBe(`import 'dotenv/config';

const database = {
  databaseURL: process.env.DATABASE_URL,
};
if (!database.databaseURL) throw new Error('DATABASE_URL is missing in .env');

export const config = {
  database,
};
`);
    });

    it('should add test database config if specified', async () => {
      await initOrchidORM({
        ...config,
        testDatabase: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === configPath,
      );
      expect(content).toBe(`import 'dotenv/config';

const database = {
  databaseURL: process.env.DATABASE_URL,
};
if (!database.databaseURL) throw new Error('DATABASE_URL is missing in .env');

const testDatabase = {
  databaseURL: process.env.DATABASE_TEST_URL,
};

const allDatabases = [database];

if (testDatabase.databaseURL) {
  allDatabases.push(testDatabase);
}

export const config = {
  allDatabases,
  database: process.env.NODE_ENV === 'test' ? testDatabase : database,
};
`);
    });
  });

  describe('db.ts', () => {
    it('should create db.ts', async () => {
      await initOrchidORM(config);

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === dbPath,
      );
      expect(content).toBe(`import { orchidORM } from 'orchid-orm';
import { config } from './config';

export const db = orchidORM(config.database, {
});
`);
    });

    it('should create db.ts with demo tables', async () => {
      await initOrchidORM({
        ...config,
        demoTables: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === dbPath,
      );
      expect(content).toBe(`import { orchidORM } from 'orchid-orm';
import { config } from './config';
import { PostTable } from './tables/post.table';
import { CommentTable } from './tables/comment.table';

export const db = orchidORM(config.database, {
  post: PostTable,
  comment: CommentTable,
});
`);
    });
  });

  describe('migrationScript', () => {
    it('should create script', async () => {
      await initOrchidORM(config);

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === migrationScriptPath,
      );
      expect(content).toBe(`import { makeChange, rakeDb } from 'rake-db';
import { appCodeUpdater } from 'orchid-orm';
import { config } from './config';
import { BaseTable } from './baseTable.ts';

export const change = rakeDb(config.database, {
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
`);
    });

    it('should create script with multiple databases', async () => {
      await initOrchidORM({
        ...config,
        testDatabase: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === migrationScriptPath,
      );
      expect(content).toBe(`import { makeChange, rakeDb } from 'rake-db';
import { appCodeUpdater } from 'orchid-orm';
import { config } from './config';
import { BaseTable } from './baseTable.ts';

export const change = rakeDb(config.allDatabases, {
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
`);
    });
  });

  describe('migrations', () => {
    it('should create migrations directory', async () => {
      await initOrchidORM(config);

      expect(fs.mkdir).toBeCalledWith(migrationsPath, { recursive: true });
    });

    it('should create migrations if demoTables specified', async () => {
      await initOrchidORM({
        ...config,
        demoTables: true,
      });

      const [, post] = asMock(fs.writeFile).mock.calls.find(([to]) =>
        to.endsWith('createPost.ts'),
      );
      expect(post).toBe(`import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('post', (t) => ({
    id: t.identity().primaryKey(),
    title: t.text().unique(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
`);

      const [, comment] = asMock(fs.writeFile).mock.calls.find(([to]) =>
        to.endsWith('createComment.ts'),
      );
      expect(comment).toBe(`import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('comment', (t) => ({
    id: t.identity().primaryKey(),
    postId: t.integer().foreignKey('post', 'id').index(),
    text: t.text(),
    ...t.timestamps(),
  }));
});
`);
    });
  });

  describe('seed', () => {
    it('should create seed file', async () => {
      await initOrchidORM(config);

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === seedPath,
      );
      expect(content).toBe(`import { db } from './db';

export const seed = async () => {
  // create records here

  await db.$close();
};
`);
    });

    it('should create seed file with sample records when demoTables is set to true', async () => {
      await initOrchidORM({
        path,
        hasTsConfig: true,
        demoTables: true,
      });

      const [, content] = asMock(fs.writeFile).mock.calls.find(
        ([to]) => to === seedPath,
      );
      expect(content).toBe(`import { db } from './db';

export const seed = async () => {
  await db.post.findBy({ title: 'Sample post' }).orCreate({
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
  });

  await db.$close();
};
`);
    });
  });

  describe('success message', () => {
    it('should log `cd project` when user specified a path', async () => {
      await initOrchidORM(config);

      const message = log.mock.calls[0][0];
      expect(message).toContain('cd to the project');
      expect(message).toContain('> cd project');
    });

    it('should log `cd project` when user specified a path', async () => {
      await initOrchidORM({ ...config, path: process.cwd() });

      const message = log.mock.calls[0][0];
      expect(message).not.toContain('cd to the project');
      expect(message).not.toContain('> cd project');
    });
  });
});
