import {
  columnsShapeToCode,
  constraintToCode,
  excludeToCode,
  TableData,
  Code,
  codeToString,
  getImportPath,
  indexToCode,
  primaryKeyInnerToCode,
  RecordString,
  singleQuote,
  toCamelCase,
  toPascalCase,
  type ColumnToCodeCtx,
} from 'pqb/internal';
import { RakeDbAst, RakeDbConfig } from 'rake-db';
import path from 'node:path';

interface TableInfo {
  key: string;
  dbTableName: string;
  name: string;
  className: string;
  path: string;
}

interface TableInfos {
  [dbTableName: string]: TableInfo;
}

export interface AppCodeGenTable extends TableInfo {
  content: string;
}

export interface AppCodeGenTables {
  [K: string]: AppCodeGenTable;
}

export interface AppCodeGenTableFactorySource {
  /**
   * File path to import the configured table factory from.
   */
  path: string;
  /**
   * Exported identifier of the configured table factory.
   */
  exportedAs: string;
}

export const getTableInfos = (
  asts: RakeDbAst[],
  config: RakeDbConfig,
): TableInfos => {
  const generateTableTo =
    config.generateTableTo ?? ((name: string) => `./tables/${name}.table.ts`);

  const tableInfos: TableInfos = {};
  for (const ast of asts) {
    if (ast.type === 'table') {
      const tableKey = toCamelCase(ast.name);
      const dbTableName = ast.schema ? `${ast.schema}.${ast.name}` : ast.name;
      let tablePath = path.resolve(config.basePath, generateTableTo(tableKey));
      if (!tablePath.endsWith('.ts')) tablePath += '.ts';

      const name = toPascalCase(ast.name);

      const info: TableInfo = {
        dbTableName,
        key: tableKey,
        path: tablePath,
        name,
        className: `${name}Table`,
      };

      tableInfos[dbTableName] = info;
    }
  }

  return tableInfos;
};

export const appCodeGenTable = (
  tableInfos: TableInfos,
  ast: RakeDbAst.Table,
  tableFactorySource: AppCodeGenTableFactorySource,
  currentSchema: string,
): AppCodeGenTable => {
  const tableInfo =
    tableInfos[ast.schema ? `${ast.schema}.${ast.name}` : ast.name];

  const content = appCodeGenDefineTable(
    tableInfo,
    ast,
    tableFactorySource,
    currentSchema,
  );

  return {
    ...tableInfo,
    content,
  };
};

const appCodeGenDefineTable = (
  tableInfo: TableInfo,
  ast: RakeDbAst.Table,
  tableFactorySource: AppCodeGenTableFactorySource,
  currentSchema: string,
): string => {
  const tableOptions = getDefineTableOptions(tableInfo, ast);
  const hasTableData = Boolean(
    ast.primaryKey ||
    ast.indexes?.length ||
    ast.excludes?.length ||
    ast.constraints?.length,
  );

  const ctx: ColumnToCodeCtx = {
    t: 't',
    sql: 'sql',
    table: ast.name,
    currentSchema,
  };

  const shapeCode = columnsShapeToCode(ctx, ast.shape);

  const { name, className } = tableInfo;
  const code: Code[] = [
    `export type ${name} = Selectable<typeof ${className}>;
export type ${name}New = Insertable<typeof ${className}>;
export type ${name}Update = Updatable<typeof ${className}>;
`,
  ];

  if (tableOptions.length) {
    code.push(
      `export const ${className} = ${tableFactorySource.exportedAs}(`,
      [
        `${singleQuote(tableInfo.key)},`,
        ...tableOptions,
        '(t) => ({',
        shapeCode,
        '}),',
      ],
      `)${hasTableData ? '' : ';'}`,
    );
  } else if (hasTableData && getTableDataItemsCount(ast) === 1) {
    code.push(
      `export const ${className} = ${tableFactorySource.exportedAs}(`,
      [`${singleQuote(tableInfo.key)},`, '(t) => ({', shapeCode, '}),'],
      ')',
    );
  } else {
    code.push(
      `export const ${className} = ${tableFactorySource.exportedAs}(${singleQuote(
        tableInfo.key,
      )}, (t) => ({`,
      shapeCode,
      `}))${hasTableData ? '' : ';'}`,
    );
  }

  if (hasTableData) {
    let tableDataCode = getTableDataChainCode(ast, ctx);
    if (ast.constraints?.some(({ check }) => check)) {
      tableDataCode = addTrailingSemicolon(tableDataCode) as Code[];
    }
    code.push(tableDataCode, ';');
  }

  const imports: RecordString = {
    'orchid-orm': 'Selectable, Insertable, Updatable',
    [getImportPath(tableInfo.path, tableFactorySource.path)]: ctx.isSqlUsed
      ? `${tableFactorySource.exportedAs}, sql`
      : tableFactorySource.exportedAs,
  };

  const importsCode = importsToCode(imports);

  return (
    importsCode +
    '\n\n' +
    formatColumnSqlChains(codeToString(code, '', '  ')) +
    '\n'
  );
};

const getDefineTableOptions = (
  tableInfo: TableInfo,
  ast: RakeDbAst.Table,
): Code[] => {
  const options: string[] = [];

  if (ast.schema) {
    options.push(`schema: ${singleQuote(ast.schema)},`);
  }

  if (tableInfo.key !== ast.name) {
    options.push(`nameInDb: ${singleQuote(ast.name)},`);
  }

  if (ast.comment) {
    options.push(`comment: ${singleQuote(ast.comment)},`);
  }

  if (ast.noPrimaryKey === 'ignore') {
    options.push('noPrimaryKey: true,');
  }

  return options.length ? ['{', options, '},'] : [];
};

const getTableDataChainCode = (
  ast: TableData,
  ctx: ColumnToCodeCtx,
): Code[] => {
  const code: Code[] = [];

  if (ast.primaryKey) {
    code.push(primaryKeyInnerToCode(ast.primaryKey, ''));
  }

  if (ast.indexes) {
    for (const index of ast.indexes) {
      code.push(...removeTrailingComma(indexToCode(index, '')));
    }
  }

  if (ast.excludes) {
    for (const exclude of ast.excludes) {
      code.push(...removeTrailingComma(excludeToCode(exclude, '')));
    }
  }

  if (ast.constraints) {
    for (const constraint of ast.constraints) {
      code.push(
        ...removeTrailingComma(constraintToCode(constraint, '', true, '', ctx)),
      );
    }
  }

  return code;
};

const getTableDataItemsCount = (ast: TableData): number => {
  return (
    (ast.primaryKey ? 1 : 0) +
    (ast.indexes?.length ?? 0) +
    (ast.excludes?.length ?? 0) +
    (ast.constraints?.length ?? 0)
  );
};

const removeTrailingComma = (code: Code): Code => {
  if (typeof code === 'string') return removeComma(code);

  const copy = [...code];
  const lastIndex = copy.length - 1;
  const last = copy[lastIndex];
  if (last !== undefined) {
    copy[lastIndex] = removeTrailingComma(last);
  }
  return copy;
};

const removeComma = (code: string) =>
  code.endsWith(',') ? code.slice(0, -1) : code;

const formatColumnSqlChains = (code: string): string => {
  return code.replace(
    /^(\s+\S+: )t((?:\.\w+\([^{}\n]*\))+)\.index\(\{\n((?:\s+[^\n]*\n)*?)(\s+)\}\)(\.check\(sql[^\n]*)$/gm,
    (
      line: string,
      prefix: string,
      chain: string,
      options: string,
      _closeIndent: string,
      check: string,
    ) => {
      const indent = ' '.repeat(line.match(/^\s*/)?.[0].length ?? 0);
      const methodIndent = `${indent}  `;
      const optionIndent = `${methodIndent}  `;
      const optionLines = options
        .split('\n')
        .filter(Boolean)
        .map((line) => `${optionIndent}${line.trimStart()}`)
        .join('\n');

      return `${prefix}t${chain.replace(
        /\./g,
        `\n${methodIndent}.`,
      )}\n${methodIndent}.index({\n${optionLines}\n${methodIndent}})\n${methodIndent}${check}`;
    },
  );
};

const addTrailingSemicolon = (code: Code): Code => {
  if (typeof code === 'string') return `${code};`;

  const copy = [...code];
  const lastIndex = copy.length - 1;
  const last = copy[lastIndex];
  if (last !== undefined) {
    copy[lastIndex] = addTrailingSemicolon(last);
  }
  return copy;
};

function importsToCode(imports: Record<string, string>): string {
  return Object.entries(imports)
    .map(([from, name]) => `import { ${name} } from '${from}';`)
    .join('\n');
}
