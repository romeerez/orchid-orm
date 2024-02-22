import fs from 'fs/promises';
import { initSteps } from '../init';
import { join } from 'path';
import { EnoentError, mockFn, testInitConfig } from '../../testUtils';

jest.mock('https', () => ({
  get(
    _: string,
    cb: (res: {
      on(event: string, cb: (chunk?: string) => void): void;
    }) => void,
  ) {
    return cb({
      on(event: string, cb: (chunk?: string) => void) {
        if (event === 'data') {
          cb(`{"version":"1.2.3"}`);
        } else if (event === 'end') {
          cb();
        }
      },
    });
  },
}));

const packageJSONPath = join(testInitConfig.path, 'package.json');

const readFile = mockFn(fs, 'readFile');
const writeFile = mockFn(fs, 'writeFile');

const dependencies = `"dotenv": "^1.2.3",
    "orchid-orm": "^1.2.3"`;

const devDependencies = `"rake-db": "^1.2.3",
    "@types/node": "^1.2.3",
    "typescript": "^1.2.3"`;

const tsxScripts = `"db": "NODE_ENV=development tsx src/db/dbScript.ts",
    "build:migrations": "rimraf dist/db && node esbuild.migrations.mjs",
    "db:compiled": "NODE_ENV=production node dist/db/dbScript.mjs"`;

const tsxDeps = `"tsx": "^1.2.3",
    "esbuild": "^1.2.3",
    "rimraf": "^1.2.3"`;

describe('setupPackageJSON', () => {
  beforeEach(jest.resetAllMocks);

  it('should create package.json if not exist', async () => {
    readFile.mockRejectedValueOnce(new EnoentError());

    await initSteps.setupPackageJSON(testInitConfig);

    expect(writeFile.mock.calls[0][1]).toBe(`{
  "name": "project",
  "type": "module",
  "scripts": {
    ${tsxScripts}
  },
  "dependencies": {
    ${dependencies}
  },
  "devDependencies": {
    "rake-db": "^1.2.3",
    "@types/node": "^1.2.3",
    "typescript": "^1.2.3",
    ${tsxDeps}
  }
}
`);
  });

  it('should create package.json with additional deps if not exist or when such dependencies are missing', async () => {
    for (const content of [null, '{}']) {
      for (const validation of ['zod', 'valibot'] as const) {
        jest.clearAllMocks();

        if (content) {
          readFile.mockResolvedValueOnce(content);
        } else {
          readFile.mockRejectedValueOnce(new EnoentError());
        }

        await initSteps.setupPackageJSON({
          ...testInitConfig,
          validation,
          addTestFactory: true,
        });

        expect(writeFile.mock.calls[0][1]).toBe(`{${
          content
            ? ''
            : `
  "name": "project",`
        }
  "type": "module",
  "scripts": {
    ${tsxScripts}
  },
  "dependencies": {
    ${dependencies},
    ${
      validation === 'zod'
        ? '"orchid-orm-schema-to-zod"'
        : '"orchid-orm-valibot"'
    }: "^1.2.3"
  },
  "devDependencies": {
    "rake-db": "^1.2.3",
    "orchid-orm-test-factory": "^1.2.3",
    "@types/node": "^1.2.3",
    "typescript": "^1.2.3",
    ${tsxDeps}
  }
}
`);
      }
    }
  });

  it('should insert scripts and dependencies', async () => {
    for (const validation of ['zod', 'valibot'] as const) {
      readFile.mockResolvedValueOnce(`{
  "scripts": {
    "ko": "ko"
  },
  "dependencies": {
    "ko": "ko"
  },
  "devDependencies": {
    "ko": "ko"
  }
}`);

      writeFile.mock.calls.length = 0;

      await initSteps.setupPackageJSON({
        ...testInitConfig,
        validation,
        addTestFactory: true,
      });

      const call = writeFile.mock.calls.find(([to]) => to === packageJSONPath);
      expect(call?.[1]).toBe(
        `{
  "type": "module",
  "scripts": {
    "ko": "ko",
    ${tsxScripts}
  },
  "dependencies": {
    "ko": "ko",
    "dotenv": "^1.2.3",
    "orchid-orm": "^1.2.3",
    ${
      validation === 'zod'
        ? '"orchid-orm-schema-to-zod"'
        : '"orchid-orm-valibot"'
    }: "^1.2.3"
  },
  "devDependencies": {
    "ko": "ko",
    "rake-db": "^1.2.3",
    "orchid-orm-test-factory": "^1.2.3",
    "@types/node": "^1.2.3",
    "typescript": "^1.2.3",
    ${tsxDeps}
  }
}
`,
      );
    }
  });

  it('should support tsx runner', async () => {
    readFile.mockRejectedValueOnce(new EnoentError());

    await initSteps.setupPackageJSON({
      ...testInitConfig,
      runner: 'tsx',
      esm: true,
    });

    expect(writeFile.mock.calls[0][1]).toBe(`{
  "name": "project",
  "type": "module",
  "scripts": {
    ${tsxScripts}
  },
  "dependencies": {
    ${dependencies}
  },
  "devDependencies": {
    ${devDependencies},
    ${tsxDeps}
  }
}
`);
  });

  it('should support vite-node runner', async () => {
    readFile.mockRejectedValueOnce(new EnoentError());

    await initSteps.setupPackageJSON({
      ...testInitConfig,
      runner: 'vite-node',
      esm: true,
    });

    expect(writeFile.mock.calls[0][1]).toBe(`{
  "name": "project",
  "type": "module",
  "scripts": {
    "db": "vite-node src/db/dbScript.ts --",
    "build:migrations": "vite build --config vite.migrations.mts",
    "db:compiled": "node dist/db/dbScript.mjs"
  },
  "dependencies": {
    ${dependencies}
  },
  "devDependencies": {
    ${devDependencies},
    "vite": "^1.2.3",
    "vite-node": "^1.2.3",
    "rollup-plugin-node-externals": "^1.2.3"
  }
}
`);
  });

  it('should support bun runner', async () => {
    readFile.mockRejectedValueOnce(new EnoentError());

    await initSteps.setupPackageJSON({
      ...testInitConfig,
      runner: 'bun',
      esm: true,
    });

    expect(writeFile.mock.calls[0][1]).toBe(`{
  "name": "project",
  "type": "module",
  "scripts": {
    "db": "bun src/db/dbScript.ts"
  },
  "dependencies": {
    ${dependencies}
  },
  "devDependencies": {
    ${devDependencies}
  }
}
`);
  });

  it('should support ts-node runner', async () => {
    readFile.mockRejectedValueOnce(new EnoentError());

    await initSteps.setupPackageJSON({
      ...testInitConfig,
      runner: 'ts-node',
      esm: false,
    });

    expect(writeFile.mock.calls[0][1]).toBe(`{
  "name": "project",
  "scripts": {
    "db": "ts-node src/db/dbScript.ts",
    "build": "tsc",
    "db:compiled": "node dist/dbScript.js"
  },
  "dependencies": {
    ${dependencies}
  },
  "devDependencies": {
    ${devDependencies},
    "ts-node": "^1.2.3"
  }
}
`);
  });
});
