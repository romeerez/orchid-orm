import { InitConfig } from '../../lib';
import { join } from 'path';
import fs from 'fs/promises';

export async function setupBaseTable(config: InitConfig): Promise<void> {
  const filePath = join(config.dbDirPath, 'baseTable.ts');

  let content = `import { createBaseTable } from 'orchid-orm';${
    config.addSchemaToZod
      ? `\nimport { zodSchemaProvider } from 'orchid-orm-schema-to-zod';`
      : ''
  }

export const BaseTable = createBaseTable({
  // Customize column types for all tables.
  columnTypes: (t) => ({
    ...t,${
      config.addSchemaToZod
        ? `
    // Set min and max validations for all text columns,
    // it is only checked when validating with Zod schemas derived from the table.
    text: (min = 0, max = Infinity) => t.text(min, max),`
        : ''
    }`;

  const { timestamp } = config;
  if (timestamp && timestamp !== 'string') {
    content += `
    // Parse timestamps to ${timestamp === 'number' ? 'number' : 'Date object'}.
    timestamp: <P extends number>(precision?: P) =>
      t.timestamp<P>(precision).${
        timestamp === 'date' ? 'asDate' : 'asNumber'
      }(),`;
  }

  content += `
  }),${
    config.addSchemaToZod
      ? `
  schemaProvider: zodSchemaProvider,`
      : ''
  }
});
`;

  await fs.writeFile(filePath, content);
}
