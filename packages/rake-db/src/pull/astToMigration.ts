import { RakeDbAst } from '../ast';
import {
  addCode,
  Code,
  codeToString,
  foreignKeyToCode,
  indexToCode,
  primaryKeyToCode,
  quoteObjectKey,
  singleQuote,
} from 'pqb';
import { quoteSchemaTable } from '../common';

export const astToMigration = (ast: RakeDbAst[]): string | undefined => {
  const code: Code[] = [];
  for (const item of ast) {
    if (item.type === 'schema' && item.action === 'create') {
      code.push(createSchema(item));
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

const createTable = (ast: RakeDbAst.Table) => {
  const code: Code[] = [];
  addCode(code, `await db.createTable(${quoteSchemaTable(ast)}, (t) => ({`);

  for (const key in ast.shape) {
    const line: Code[] = [`${quoteObjectKey(key)}: `];
    addCode(line, ast.shape[key].toCode('t'));
    addCode(line, ',');
    code.push(line);
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
