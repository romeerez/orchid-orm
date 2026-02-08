import { InitConfig } from '../../lib';
import { join } from 'path';
import fs from 'fs/promises';

export async function setupBaseTable(config: InitConfig): Promise<void> {
  const filePath = join(config.dbDirPath, 'base-table.ts');

  const { timestamp } = config;
  const customTimestamp = timestamp && timestamp !== 'string';
  const columnTypesComment = customTimestamp ? '' : '// ';

  let content = `import { createBaseTable } from 'orchid-orm';${
    config.validation === 'zod'
      ? `\nimport { zodSchemaConfig } from 'orchid-orm-schema-to-zod';`
      : config.validation === 'valibot'
      ? `\nimport { valibotSchemaConfig } from 'orchid-orm-valibot';`
      : ''
  }

export const BaseTable = createBaseTable({
  // Set \`snakeCase\` to \`true\` if columns in your database are in snake_case.
  // snakeCase: true,${
    config.validation !== 'no'
      ? `

  schemaConfig: ${
    config.validation === 'zod' ? 'zodSchemaConfig' : 'valibotSchemaConfig'
  },`
      : ''
  }

  // Customize column types for all tables.
  ${columnTypesComment}columnTypes: (t) => ({
  ${columnTypesComment}  ...t,`;

  if (customTimestamp) {
    content += `
    // Parse timestamps to ${timestamp === 'number' ? 'number' : 'Date object'}.
    timestamp: (precision?: number) => t.timestamp(precision).${
      timestamp === 'date' ? 'asDate' : 'asNumber'
    }(),`;
  }

  content += `
  ${columnTypesComment}}),
});

export const { sql } = BaseTable;
`;

  await fs.writeFile(filePath, content);
}
