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
import { astToGenerateItems } from './astToGenerateItems';

export const astToMigration = (
  currentSchema: string,
  config: AnyRakeDbConfig,
  asts: RakeDbAst[],
): ((importPath: string) => string) | undefined => {
  const items = astToGenerateItems(asts, currentSchema);

  const toBeAdded = new Set<string>();
  const remainingDeps = new Map<string, number>();
  const added = new Set<string>();
  const groups: RakeDbAst[][] = [[]];
  const cycleAdd = new Set<string>();
  const cycleDeps = new Map<string, number>();

  for (const item of items) {
    for (const add of item.add) {
      toBeAdded.add(add);
    }

    for (const dep of item.deps) {
      remainingDeps.set(dep, (remainingDeps.get(dep) ?? 0) + 1);
    }
  }

  let len = items.length;
  if (!len) return;

  for (;;) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      let satisfied = true;
      for (const dep of item.deps) {
        if (toBeAdded.has(dep) && !added.has(dep)) {
          satisfied = false;
          break;
        }
      }

      if (satisfied) {
        for (const key of item.drop) {
          if (remainingDeps.has(key)) {
            satisfied = false;
            break;
          }
        }
      }

      if (satisfied) {
        for (const key of item.add) {
          cycleAdd.add(key);
        }

        for (const key of item.deps) {
          cycleDeps.set(key, (cycleDeps.get(key) ?? 0) + 1);
        }

        items.splice(i, 1);
        i--;
        groups[groups.length - 1].push(item.ast);
      }
    }

    if (len === items.length) {
      throw Object.assign(
        new Error(
          `Cannot satisfy migration dependencies: ${JSON.stringify(
            items.map((item) => ({
              ast: item.ast,
              add: [...item.add.values()],
              drop: [...item.drop.values()],
              deps: [...item.deps.values()],
            })),
            null,
            2,
          )}`,
        ),
      );
    }

    for (const add of cycleAdd) {
      added.add(add);
    }

    for (const [key, num] of cycleDeps) {
      const set = (remainingDeps.get(key) ?? num) - num;
      if (set) remainingDeps.set(key, set);
      else remainingDeps.delete(key);
    }

    len = items.length;
    if (!len) break;

    groups.push([]);
  }

  if (!groups[0].length) return;

  let code = '';
  for (const group of groups) {
    code += `
change(async (db) => {
${group
  .map((ast) =>
    codeToString(
      (
        astEncoders as {
          [K: string]: (
            ast: RakeDbAst,
            config: AnyRakeDbConfig,
            currentSchema: string,
          ) => Code;
        }
      )[ast.type](ast, config, currentSchema),
      '  ',
      '  ',
    ),
  )
  .join('\n\n')}
});
`;
  }

  return (importPath) => `import { change } from '${importPath}';\n${code}`;
};

const astEncoders: {
  [K in RakeDbAst['type']]: (
    ast: RakeDbAst & { type: K },
    config: AnyRakeDbConfig,
    currentSchema: string,
  ) => Code;
} = {
  table(ast, config) {
    let code: Code[] = [];
    const result = code;

    const hasOptions = Boolean(ast.comment || ast.noPrimaryKey === 'ignore');

    if (hasOptions) {
      addCode(code, `await db.${ast.action}Table(`);

      const inner: Code[] = [`${quoteSchemaTable(ast)},`];
      code.push(inner);
      code = inner;

      const options: string[] = [];
      if (ast.comment) options.push(`comment: ${JSON.stringify(ast.comment)},`);
      if (ast.noPrimaryKey === 'ignore') options.push(`noPrimaryKey: true,`);

      code.push('{', options, '},', '(t) => ({');
    } else {
      addCode(
        code,
        `await db.${ast.action}Table(${quoteSchemaTable(ast)}, (t) => ({`,
      );
    }

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
          hasAnyCamelCaseTimestamps || config.snakeCase
            ? key
            : `${key}SnakeCase`
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

    if (hasOptions) {
      addCode(code, '}),');
      addCode(result, ');');
    } else {
      addCode(result, '}));');
    }

    return result;
  },
  changeTable() {
    return 'todo';
  },
  renameTable(ast, _, currentSchema) {
    const code: Code[] = [];

    if (ast.from === ast.to) {
      addCode(
        code,
        `await db.changeTableSchema(${singleQuote(ast.to)}, ${singleQuote(
          ast.fromSchema ?? currentSchema,
        )}, ${singleQuote(ast.toSchema ?? currentSchema)});`,
      );
    } else {
      addCode(
        code,
        `await db.renameTable(${quoteSchemaTable({
          schema: ast.fromSchema === currentSchema ? undefined : ast.fromSchema,
          name: ast.from,
        })}, ${quoteSchemaTable({
          schema: ast.toSchema === currentSchema ? undefined : ast.toSchema,
          name: ast.to,
        })});`,
      );
    }

    return code;
  },
  schema(ast) {
    return `await db.${
      ast.action === 'create' ? 'createSchema' : 'dropSchema'
    }(${singleQuote(ast.name)});`;
  },
  renameSchema(ast) {
    return `await db.renameSchema(${singleQuote(ast.from)}, ${singleQuote(
      ast.to,
    )});`;
  },
  extension(ast) {
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
  },
  enum(ast) {
    return `await db.createEnum(${quoteSchemaTable(ast)}, [${ast.values
      .map(singleQuote)
      .join(', ')}]);`;
  },
  domain(ast) {
    const code: Code[] = [
      `await db.createDomain(${quoteSchemaTable(
        ast,
      )}, (t) => ${ast.baseType.toCode('t')}`,
    ];

    if (ast.notNull || ast.collation || ast.default || ast.check) {
      const props: Code[] = [];
      if (ast.notNull) props.push(`notNull: true,`);
      if (ast.collation)
        props.push(`collation: ${singleQuote(ast.collation)},`);
      if (ast.default) props.push(`default: ${ast.default.toCode('db')},`);
      if (ast.check) props.push(`check: ${ast.check.toCode('db')},`);

      addCode(code, ', {');
      code.push(props);
      addCode(code, '}');
    }

    addCode(code, ');');
    return code;
  },
  collation(ast) {
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
  },
  constraint(ast) {
    const kind = getConstraintKind(ast);
    const table = quoteSchemaTable({
      schema: ast.tableSchema,
      name: ast.tableName,
    });

    if (kind === 'foreignKey' && ast.references) {
      return [
        `await db.addForeignKey(`,
        [`${table},`, ...referencesArgsToCode(ast.references, ast.name)],
        ');',
      ];
    }

    if (kind === 'check' && ast.check) {
      return [`await db.addCheck(${table}, ${ast.check.toCode('t')});`];
    }

    return [
      `await db.addConstraint(${table}, {`,
      constraintPropsToCode('t', ast),
      '});',
    ];
  },
  view(ast) {
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
  },
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
