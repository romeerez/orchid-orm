import { RakeDbAst } from '../ast';
import {
  addCode,
  Code,
  codeToString,
  ColumnType,
  foreignKeyToCode,
  indexToCode,
  isRaw,
  primaryKeyToCode,
  quoteObjectKey,
  singleQuote,
  TimestampColumn,
} from 'pqb';
import { quoteSchemaTable } from '../common';

export const astToMigration = (ast: RakeDbAst[]): string | undefined => {
  const code: Code[] = [];
  for (const item of ast) {
    if (item.type === 'schema' && item.action === 'create') {
      code.push(createSchema(item));
    } else if (item.type === 'extension' && item.action === 'create') {
      code.push(...createExtension(item));
    } else if (item.type === 'table' && item.action === 'create') {
      if (code.length) code.push([]);
      code.push(...createTable(item));
    }
  }

  if (!code.length) return;

  return `import { change } from 'rake-db';

change(async (db) => {
${codeToString(code, '  ', '  ')}
});
`;
};

const createSchema = (ast: RakeDbAst.Schema) => {
  return `await db.createSchema(${singleQuote(ast.name)});`;
};

const createExtension = (ast: RakeDbAst.Extension): Code[] => {
  const code: Code[] = [`await db.createExtension(${singleQuote(ast.name)}`];
  if (ast.schema || ast.version) {
    addCode(code, ', {');
    if (ast.schema) {
      code.push([`schema: ${singleQuote(ast.schema)},`]);
    }
    if (ast.version) {
      code.push([`version: ${singleQuote(ast.version)},`]);
    }
    addCode(code, '}');
  }
  addCode(code, ')');
  return code;
};

const createTable = (ast: RakeDbAst.Table) => {
  const code: Code[] = [];
  addCode(code, `await db.createTable(${quoteSchemaTable(ast)}, (t) => ({`);

  const hasTimestamps =
    isTimestamp(ast.shape.createdAt) && isTimestamp(ast.shape.updatedAt);

  for (const key in ast.shape) {
    if (hasTimestamps && (key === 'createdAt' || key === 'updatedAt')) continue;

    const line: Code[] = [`${quoteObjectKey(key)}: `];
    for (const part of ast.shape[key].toCode('t')) {
      addCode(line, part);
    }
    addCode(line, ',');
    code.push(line);
  }

  if (hasTimestamps) {
    code.push(['...t.timestamps(),']);
  }

  if (ast.primaryKey) {
    code.push([primaryKeyToCode(ast.primaryKey, 't')]);
  }

  for (const index of ast.indexes) {
    code.push(indexToCode(index, 't'));
  }

  for (const foreignKey of ast.foreignKeys) {
    code.push(foreignKeyToCode(foreignKey, 't'));
  }

  addCode(code, '}));');

  return code;
};

const isTimestamp = (column?: ColumnType) => {
  if (!column) return false;

  const { default: def } = column.data;
  return (
    column instanceof TimestampColumn &&
    !column.data.isNullable &&
    def &&
    typeof def === 'object' &&
    isRaw(def) &&
    def.__raw === 'now()'
  );
};
