import { RakeDbAst } from '../ast';
import {
  ColumnType,
  referencesArgsToCode,
  constraintToCode,
  indexToCode,
  primaryKeyToCode,
  TimestampColumn,
  getConstraintKind,
  constraintPropsToCode,
} from 'pqb';
import {
  addCode,
  Code,
  codeToString,
  isRaw,
  quoteObjectKey,
  rawToCode,
  singleQuote,
} from 'orchid-core';
import { quoteSchemaTable, RakeDbConfig } from '../common';

export const astToMigration = (
  config: RakeDbConfig,
  ast: RakeDbAst[],
): string | undefined => {
  const first: Code[] = [];
  const tables: Code[] = [];
  const constraints: Code[] = [];
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
    } else if (item.type === 'constraint') {
      if (constraints.length) constraints.push([]);
      constraints.push(...createConstraint(item));
    }
  }

  if (!first.length && !tables.length && !constraints.length) return;

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

  if (constraints.length) {
    code += `
change(async (db) => {
${codeToString(constraints, '  ', '  ')}
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

  let hasTimestamps =
    isTimestamp(ast.shape.createdAt) && isTimestamp(ast.shape.updatedAt);

  const camelCaseTimestamps =
    !config.snakeCase &&
    hasTimestamps &&
    !ast.shape.createdAt?.data.name &&
    !ast.shape.updatedAt?.data.name;

  const snakeCaseTimestamps =
    hasTimestamps &&
    !camelCaseTimestamps &&
    ((!config.snakeCase &&
      ast.shape.createdAt?.data.name === 'created_at' &&
      ast.shape.updatedAt?.data.name === 'updated_at') ||
      (config.snakeCase &&
        !ast.shape.createdAt?.data.name &&
        !ast.shape.updatedAt?.data.name));

  if (!camelCaseTimestamps && !snakeCaseTimestamps) {
    hasTimestamps = false;
  }

  for (const key in ast.shape) {
    if (hasTimestamps && (key === 'createdAt' || key === 'updatedAt')) continue;

    const line: Code[] = [`${quoteObjectKey(key)}: `];
    for (const part of ast.shape[key].toCode('t', true)) {
      addCode(line, part);
    }
    addCode(line, ',');
    code.push(line);
  }

  if (hasTimestamps) {
    code.push([
      `...t.${
        camelCaseTimestamps || config.snakeCase
          ? 'timestamps'
          : 'timestampsSnakeCase'
      }(),`,
    ]);
  }

  if (ast.primaryKey) {
    code.push([primaryKeyToCode(ast.primaryKey, 't')]);
  }

  if (ast.indexes) {
    for (const index of ast.indexes) {
      code.push(indexToCode(index, 't'));
    }
  }

  if (ast.constraints) {
    for (const constraint of ast.constraints) {
      code.push(constraintToCode(constraint, 't'));
    }
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

const createConstraint = (item: RakeDbAst.Constraint): Code => {
  const kind = getConstraintKind(item);
  const table = quoteSchemaTable({
    schema: item.tableSchema,
    name: item.tableName,
  });

  if (kind === 'foreignKey' && item.references) {
    return [
      `await db.addForeignKey(`,
      [`${table},`, ...referencesArgsToCode(item.references, item.name)],
      ');',
    ];
  }

  if (kind === 'check' && item.check) {
    return [`await db.addCheck(${table}, ${rawToCode('t', item.check)});`];
  }

  return [
    `await db.addConstraint(${table}, {`,
    constraintPropsToCode('t', item),
    '});',
  ];
};
