import { RakeDbAst } from '../ast';
import {
  ColumnType,
  referencesArgsToCode,
  constraintToCode,
  indexToCode,
  primaryKeyToCode,
  getConstraintKind,
  constraintPropsToCode,
  TimestampTZColumn,
  TimestampColumn,
} from 'pqb';
import {
  addCode,
  backtickQuote,
  Code,
  codeToString,
  ColumnSchemaConfig,
  isRawSQL,
  quoteObjectKey,
  singleQuote,
} from 'orchid-core';
import { quoteSchemaTable } from '../common';
import { AnyRakeDbConfig } from 'rake-db';

export const astToMigration = (
  currentSchema: string,
  config: AnyRakeDbConfig,
  ast: RakeDbAst[],
): ((importPath: string) => string) | undefined => {
  const first: Code[] = [];
  const tablesAndViews: Code[] = [];
  const last: Code[] = [];
  for (const item of ast) {
    if (item.type === 'schema') {
      (item.action === 'create' ? first : last).push(handleSchema(item));
    } else if (item.type === 'renameSchema') {
      first.push(renameSchema(item));
    } else if (item.type === 'extension' && item.action === 'create') {
      if (first.length) first.push([]);
      first.push(...createExtension(item));
    } else if (item.type === 'enum' && item.action === 'create') {
      if (first.length) first.push([]);
      first.push(createEnum(item));
    } else if (item.type === 'domain' && item.action === 'create') {
      if (first.length) first.push([]);
      first.push(...createDomain(item));
    } else if (item.type === 'collation' && item.action === 'create') {
      if (first.length) first.push([]);
      first.push(...createCollation(item));
    } else if (item.type === 'table' && item.action === 'create') {
      tablesAndViews.push(createTable(config, item));
    } else if (item.type === 'renameTable') {
      tablesAndViews.push(renameTable(currentSchema, item));
    } else if (item.type === 'view' && item.action === 'create') {
      tablesAndViews.push(createView(item));
    } else if (item.type === 'constraint') {
      if (last.length) last.push([]);
      last.push(...createConstraint(item));
    }
  }

  let code = '';

  if (!tablesAndViews.length) {
    first.push(...last);
    last.length = 0;
  }

  if (first.length) {
    code += codeToChange(first);
  }

  if (tablesAndViews.length) {
    for (const table of tablesAndViews) {
      code += codeToChange(table);
    }
  }

  if (last.length) code += codeToChange(last);

  return code.length
    ? (importPath) => `import { change } from '${importPath}';\n${code}`
    : undefined;
};

const codeToChange = (code: Code) => `
change(async (db) => {
${codeToString(code, '  ', '  ')}
});
`;

const handleSchema = (ast: RakeDbAst.Schema) => {
  return `await db.${
    ast.action === 'create' ? 'createSchema' : 'dropSchema'
  }(${singleQuote(ast.name)});`;
};

const renameSchema = (ast: RakeDbAst.RenameSchema) => {
  return `await db.renameSchema(${singleQuote(ast.from)}, ${singleQuote(
    ast.to,
  )});`;
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
    if (ast.default) props.push(`default: ${ast.default.toCode('db')},`);
    if (ast.check) props.push(`check: ${ast.check.toCode('db')},`);

    addCode(code, ', {');
    code.push(props);
    addCode(code, '}');
  }

  addCode(code, ');');
  return code;
};

const createCollation = (ast: RakeDbAst.Collation): Code[] => {
  const params: string[] = [];
  if (ast.locale) params.push(`locale: '${ast.locale}',`);
  if (ast.lcCollate) params.push(`lcCollate: '${ast.lcCollate}',`);
  if (ast.lcCType) params.push(`lcCType: '${ast.lcCType}',`);
  if (ast.provider) params.push(`provider: '${ast.provider}',`);
  if (ast.deterministic) params.push(`deterministic: ${ast.deterministic},`);
  if (ast.version) params.push(`version: '${ast.version}',`);

  return [
    `await db.createCollation(${quoteSchemaTable(ast)}, {`,
    params,
    '});',
  ];
};

const createTable = (config: AnyRakeDbConfig, ast: RakeDbAst.Table) => {
  const code: Code[] = [];
  addCode(code, `await db.createTable(${quoteSchemaTable(ast)}, (t) => ({`);

  const timestamps = getTimestampsInfo(config, ast, TimestampTZColumn);
  const timestampsNoTZ = getTimestampsInfo(config, ast, TimestampTZColumn);
  const hasAnyTimestamps =
    timestamps.hasTimestamps || timestampsNoTZ.hasTimestamps;
  const hasAnyCamelCaseTimestamps =
    timestamps.camelCaseTimestamps || timestampsNoTZ.camelCaseTimestamps;

  for (const key in ast.shape) {
    if (hasAnyTimestamps && (key === 'createdAt' || key === 'updatedAt'))
      continue;

    const line: Code[] = [`${quoteObjectKey(key)}: `];
    for (const part of ast.shape[key].toCode('t', true)) {
      addCode(line, part);
    }
    addCode(line, ',');
    code.push(line);
  }

  if (hasAnyTimestamps) {
    const key = timestamps.hasTimestamps ? 'timestamps' : 'timestampsNoTZ';

    code.push([
      `...t.${
        hasAnyCamelCaseTimestamps || config.snakeCase ? key : `${key}SnakeCase`
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

const renameTable = (currentSchema: string, item: RakeDbAst.RenameTable) => {
  const code: Code[] = [];

  if (item.from === item.to) {
    addCode(
      code,
      `await db.changeTableSchema(${singleQuote(item.to)}, ${singleQuote(
        item.fromSchema ?? currentSchema,
      )}, ${singleQuote(item.toSchema ?? currentSchema)});`,
    );
  }

  return code;
};

const isTimestamp = (
  column: ColumnType | undefined,
  type:
    | typeof TimestampTZColumn<ColumnSchemaConfig>
    | typeof TimestampColumn<ColumnSchemaConfig>,
) => {
  if (!column) return false;

  const { default: def } = column.data;
  return (
    column instanceof type &&
    !column.data.isNullable &&
    def &&
    typeof def === 'object' &&
    isRawSQL(def) &&
    def._sql === 'now()'
  );
};

const getTimestampsInfo = (
  config: AnyRakeDbConfig,
  ast: RakeDbAst.Table,
  type:
    | typeof TimestampTZColumn<ColumnSchemaConfig>
    | typeof TimestampColumn<ColumnSchemaConfig>,
) => {
  let hasTimestamps =
    isTimestamp(ast.shape.createdAt, type) &&
    isTimestamp(ast.shape.updatedAt, type);

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

  return {
    hasTimestamps,
    camelCaseTimestamps,
    snakeCaseTimestamps,
  };
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
    return [`await db.addCheck(${table}, ${item.check.toCode('t')});`];
  }

  return [
    `await db.addConstraint(${table}, {`,
    constraintPropsToCode('t', item),
    '});',
  ];
};

const createView = (ast: RakeDbAst.View) => {
  const code: Code[] = [`await db.createView(${quoteSchemaTable(ast)}`];

  const options: Code[] = [];
  if (ast.options.recursive) options.push('recursive: true,');

  const w = ast.options.with;
  if (w?.checkOption) options.push(`checkOption: '${w.checkOption}',`);
  if (w?.securityBarrier)
    options.push(`securityBarrier: ${w.securityBarrier},`);
  if (w?.securityInvoker)
    options.push(`securityInvoker: ${w.securityInvoker},`);

  if (options.length) {
    addCode(code, ', {');
    code.push(options, '}');
  }

  addCode(code, ', ');

  if (!ast.sql._values) {
    const raw = ast.sql._sql;
    let sql;
    if (typeof raw === 'string') {
      sql = raw;
    } else {
      sql = '';
      const parts = raw[0];
      const last = parts.length - 1;
      for (let i = 0; i < last; i++) {
        sql += parts[i] + `\${${raw[i + 1]}}`;
      }
      sql += parts[last];
    }

    addCode(code, backtickQuote(sql));
  } else {
    addCode(code, ast.sql.toCode('db'));
  }

  addCode(code, ');');
  return code;
};
