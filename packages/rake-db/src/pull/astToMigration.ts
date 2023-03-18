import { RakeDbAst } from '../ast';
import {
  codeToString,
  ColumnType,
  foreignKeyArgsToCode,
  foreignKeyToCode,
  indexToCode,
  primaryKeyToCode,
  rawToCode,
  TimestampColumn,
} from 'pqb';
import { addCode, Code, isRaw, quoteObjectKey, singleQuote } from 'orchid-core';
import { quoteSchemaTable, RakeDbConfig } from '../common';

export const astToMigration = (
  config: RakeDbConfig,
  ast: RakeDbAst[],
): string | undefined => {
  const first: Code[] = [];
  const tables: Code[] = [];
  const foreignKeys: Code[] = [];
  for (const item of ast) {
    if (item.type === 'schema' && item.action === 'create') {
      first.push(createSchema(item));
    } else if (item.type === 'extension' && item.action === 'create') {
      if (first.length) first.push([]);
      first.push(...createExtension(item));
    } else if (item.type === 'enum' && item.action === 'create') {
      if (first.length) first.push([]);
      first.push(createEnum(item));
    } else if (item.type === 'domain' && item.action === 'create') {
      if (first.length) first.push([]);
      first.push(...createDomain(item));
    } else if (item.type === 'table' && item.action === 'create') {
      tables.push(createTable(config, item));
    } else if (item.type === 'foreignKey') {
      if (foreignKeys.length) foreignKeys.push([]);
      foreignKeys.push(...createForeignKey(item));
    }
  }

  if (!first.length && !tables.length && !foreignKeys.length) return;

  let code = `import { change } from 'rake-db';
`;

  if (first.length) {
    code += `
change(async (db) => {
${codeToString(first, '  ', '  ')}
});
`;
  }

  if (tables.length) {
    for (const table of tables) {
      code += `
change(async (db) => {
${codeToString(table, '  ', '  ')}
});
`;
    }
  }

  if (foreignKeys.length) {
    code += `
change(async (db) => {
${codeToString(foreignKeys, '  ', '  ')}
});
`;
  }

  return code;
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
  addCode(code, ');');
  return code;
};

const createEnum = (ast: RakeDbAst.Enum) => {
  return `await db.createEnum(${quoteSchemaTable(ast)}, [${ast.values
    .map(singleQuote)
    .join(', ')}]);`;
};

const createDomain = (ast: RakeDbAst.Domain) => {
  const code: Code[] = [
    `await db.createDomain(${quoteSchemaTable(
      ast,
    )}, (t) => ${ast.baseType.toCode('t')}`,
  ];

  if (ast.notNull || ast.collation || ast.default || ast.check) {
    const props: Code[] = [];
    if (ast.notNull) props.push(`notNull: true,`);
    if (ast.collation) props.push(`collation: ${singleQuote(ast.collation)},`);
    if (ast.default) props.push(`default: ${rawToCode('db', ast.default)},`);
    if (ast.check) props.push(`check: ${rawToCode('db', ast.check)},`);

    addCode(code, ', {');
    code.push(props);
    addCode(code, '}');
  }

  addCode(code, ');');
  return code;
};

const createTable = (config: RakeDbConfig, ast: RakeDbAst.Table) => {
  const code: Code[] = [];
  addCode(code, `await db.createTable(${quoteSchemaTable(ast)}, (t) => ({`);

  const hasTimestamps =
    !config.snakeCase &&
    isTimestamp(ast.shape.createdAt) &&
    isTimestamp(ast.shape.updatedAt);

  const hasTimestampsSnake =
    isTimestamp(ast.shape.created_at) && isTimestamp(ast.shape.updated_at);

  for (const key in ast.shape) {
    if (hasTimestamps && (key === 'createdAt' || key === 'updatedAt')) continue;
    if (hasTimestampsSnake && (key === 'created_at' || key === 'updated_at'))
      continue;

    const line: Code[] = [`${quoteObjectKey(key)}: `];
    for (const part of ast.shape[key].toCode('t')) {
      addCode(line, part);
    }
    addCode(line, ',');
    code.push(line);
  }

  if (hasTimestamps || (config.snakeCase && hasTimestampsSnake)) {
    code.push(['...t.timestamps(),']);
  }

  if (hasTimestampsSnake && !config.snakeCase) {
    code.push(['...t.timestampsSnakeCase(),']);
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

const createForeignKey = (item: RakeDbAst.ForeignKey): Code[] => {
  return [
    `await db.addForeignKey(`,
    [
      `${quoteSchemaTable({
        schema: item.tableSchema,
        name: item.tableName,
      })},`,
      ...foreignKeyArgsToCode(item),
    ],
    ');',
  ];
};
