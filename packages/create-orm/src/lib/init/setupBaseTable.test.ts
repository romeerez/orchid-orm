import fs from 'fs/promises';
import { initSteps } from '../init';
import { resolve } from 'path';
import { mockFn, testInitConfig } from '../../testUtils';

const baseTablePath = resolve(testInitConfig.dbDirPath, 'baseTable.ts');

const writeFile = mockFn(fs, 'writeFile');

const header = `// Set \`snakeCase\` to \`true\` if columns in your database are in snake_case.
  // snakeCase: true,
`;

const columnTypesComment = `// Customize column types for all tables.`;

const textColumnComment = `// Set min and max validations for all text columns,
    // it is only checked when validating with Zod schemas derived from the table.`;

describe('setupBaseTable', () => {
  beforeEach(jest.resetAllMocks);

  it('should create base table', async () => {
    await initSteps.setupBaseTable(testInitConfig);

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  ${header}
  ${columnTypesComment}
  columnTypes: (t) => ({
    ...t,
  }),
});
`);
  });

  it('should create base table with zod schema provider if it is in config', async () => {
    await initSteps.setupBaseTable({ ...testInitConfig, addSchemaToZod: true });

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';
import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';

export const BaseTable = createBaseTable({
  ${header}
  schemaConfig: zodSchemaConfig,

  ${columnTypesComment}
  columnTypes: (t) => ({
    ...t,
    ${textColumnComment}
    text: (min = 0, max = Infinity) => t.text(min, max),
  }),
});
`);
  });

  it('should create base table with timestamp as date', async () => {
    await initSteps.setupBaseTable({
      ...testInitConfig,
      timestamp: 'date',
    });

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  ${header}
  ${columnTypesComment}
  columnTypes: (t) => ({
    ...t,
    // Parse timestamps to Date object.
    timestamp: (precision?: number) => t.timestamp(precision).asDate(),
  }),
});
`);
  });

  it('should create base table with timestamp as number', async () => {
    await initSteps.setupBaseTable({
      ...testInitConfig,
      timestamp: 'number',
    });

    const call = writeFile.mock.calls.find(([to]) => to === baseTablePath);
    expect(call?.[1]).toBe(`import { createBaseTable } from 'orchid-orm';

export const BaseTable = createBaseTable({
  ${header}
  ${columnTypesComment}
  columnTypes: (t) => ({
    ...t,
    // Parse timestamps to number.
    timestamp: (precision?: number) => t.timestamp(precision).asNumber(),
  }),
});
`);
  });
});
