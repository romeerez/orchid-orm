import { RakeDbAst } from '../ast';
import {
  ColumnType,
  referencesArgsToCode,
  TimestampTZColumn,
  TimestampColumn,
  primaryKeyInnerToCode,
  indexInnerToCode,
  constraintInnerToCode,
  TableData,
  pushTableDataCode,
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
  toArray,
} from 'orchid-core';
import { exhaustive, quoteSchemaTable } from '../common';
import { AnyRakeDbConfig } from '../config';
import { astToGenerateItems } from './astToGenerateItems';

export const astToMigration = (
  currentSchema: string,
  config: AnyRakeDbConfig,
  asts: RakeDbAst[],
): string | undefined => {
  const items = astToGenerateItems(asts, currentSchema);

  const toBeAdded = new Set<string>();
  const toBeDropped = new Set<string>();
  const remainingDeps = new Map<string, number>();
  const added = new Set<string>();
  const dropped = new Set<string>();
  const groups: RakeDbAst[][] = [[]];
  const cycleAdd = new Set<string>();
  const cycleDrop = new Set<string>();
  const cycleDeps = new Map<string, number>();

  for (const item of items) {
    for (const add of item.add) {
      toBeAdded.add(add);
    }

    for (const drop of item.drop) {
      // `toBeDropped` contains only those items that are dropped and added in separate asts.
      // Skip it from `toBeDropped` if, for example, primary key is dropped and added inside a single table change.
      if (!item.add.has(drop)) {
        toBeDropped.add(drop);
      }
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
        // When the same thing is dropped and then added in a single migration,
        // make it to first drop and then add at a separate section to preserve the correct `down` order.
        for (const key of item.add) {
          if (toBeDropped.has(key) && !dropped.has(key)) {
            satisfied = false;
            break;
          }
        }
      }

      if (satisfied) {
        for (const key of item.add) {
          cycleAdd.add(key);
        }

        for (const key of item.drop) {
          cycleDrop.add(key);
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

    for (const drop of cycleDrop) {
      dropped.add(drop);
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

  return code;
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
    const hasTableData = Boolean(
      ast.primaryKey || ast.indexes?.length || ast.constraints?.length,
    );
    const isShifted = hasOptions || hasTableData;

    if (isShifted) {
      addCode(code, `await db.${ast.action}Table(`);

      const inner: Code[] = [`${quoteSchemaTable(ast)},`];
      code.push(inner);
      code = inner;

      if (hasOptions) {
        const options: string[] = [];
        if (ast.comment)
          options.push(`comment: ${JSON.stringify(ast.comment)},`);
        if (ast.noPrimaryKey === 'ignore') options.push(`noPrimaryKey: true,`);

        code.push('{', options, '},');
      }

      code.push('(t) => ({');
    } else {
      addCode(
        code,
        `await db.${ast.action}Table(${quoteSchemaTable(ast)}, (t) => ({`,
      );
    }

    const timestamps = getHasTimestamps(
      config,
      ast.shape.createdAt,
      ast.shape.updatedAt,
    );

    for (const key in ast.shape) {
      if (
        timestamps.hasAnyTimestamps &&
        (key === 'createdAt' || key === 'updatedAt')
      )
        continue;

      const line: Code[] = [`${quoteObjectKey(key)}: `];
      for (const part of ast.shape[key].toCode('t', true)) {
        addCode(line, part);
      }
      addCode(line, ',');
      code.push(line);
    }

    if (timestamps.hasAnyTimestamps) {
      code.push([`...${timestampsToCode(config, timestamps)},`]);
    }

    if (isShifted) {
      addCode(code, '}),');

      if (hasTableData) pushTableDataCode(code, ast);

      addCode(result, ');');
    } else {
      addCode(result, '}));');
    }

    return result;
  },
  changeTable(ast, config, currentSchema) {
    let code: Code[] = [];
    const result = code;

    const schemaTable = quoteSchemaTable({
      schema: ast.schema === currentSchema ? undefined : ast.schema,
      name: ast.name,
    });

    const { comment } = ast;
    if (comment !== undefined) {
      addCode(code, `await db.changeTable(`);

      const inner: Code[] = [
        `${schemaTable},`,
        `{ comment: ${JSON.stringify(ast.comment)} },`,
        '(t) => ({',
      ];
      code.push(inner);
      code = inner;
    } else {
      addCode(code, `await db.changeTable(${schemaTable}, (t) => ({`);
    }

    const [addTimestamps, dropTimestamps] = (['add', 'drop'] as const).map(
      (type) =>
        getHasTimestamps(
          config,
          ast.shape.createdAt &&
            'type' in ast.shape.createdAt &&
            ast.shape.createdAt?.type === type
            ? ast.shape.createdAt.item
            : undefined,
          ast.shape.updatedAt &&
            'type' in ast.shape.updatedAt &&
            ast.shape.updatedAt?.type === type
            ? ast.shape.updatedAt.item
            : undefined,
        ),
    );

    for (const key in ast.shape) {
      const changes = toArray(ast.shape[key]);
      for (const change of changes) {
        if (change.type === 'add' || change.type === 'drop') {
          if (
            (addTimestamps.hasAnyTimestamps ||
              dropTimestamps.hasAnyTimestamps) &&
            (key === 'createdAt' || key === 'updatedAt')
          )
            continue;

          const recreate = changes.length > 1;
          const line: Code[] = [
            recreate
              ? `...t.${change.type}(t.name(${singleQuote(key)})`
              : `${quoteObjectKey(key)}: t.${change.type}(`,
          ];
          const columnCode = change.item.toCode('t', true);
          for (let i = 0; i < columnCode.length; i++) {
            let part = columnCode[i];
            if (recreate && !i) part = part.slice(1);
            addCode(line, part);
          }
          addCode(line, '),');
          code.push(line);
        } else if (change.type === 'change') {
          if (!change.from.column || !change.to.column) continue;

          const line: Code[] = [
            `${quoteObjectKey(key)}: t${
              change.name ? `.name(${singleQuote(change.name)})` : ''
            }.change(`,
          ];
          for (const part of change.from.column.toCode('t', true)) {
            addCode(line, part);
          }
          addCode(line, ', ');
          for (const part of change.to.column.toCode('t', true)) {
            addCode(line, part);
          }

          if (change.using) {
            addCode(line, ', {');
            const u: string[] = [];
            if (change.using.usingUp) {
              u.push(`usingUp: ${change.using.usingUp.toCode('t')},`);
            }
            if (change.using.usingDown) {
              u.push(`usingDown: ${change.using.usingDown.toCode('t')},`);
            }
            addCode(line, u);
            addCode(line, '}');
          }

          addCode(line, '),');
          code.push(line);
        } else if (change.type === 'rename') {
          code.push([
            `${quoteObjectKey(key)}: t.rename(${singleQuote(change.name)}),`,
          ]);
        } else {
          exhaustive(change.type);
        }
      }
    }

    for (const key of ['drop', 'add'] as const) {
      const timestamps = key === 'add' ? addTimestamps : dropTimestamps;
      if (timestamps.hasAnyTimestamps) {
        addCode(code, [
          `...t.${key}(${timestampsToCode(config, timestamps)}),`,
        ]);
      }

      const { primaryKey, indexes, constraints } = ast[key];

      if (primaryKey) {
        addCode(code, [
          `...t.${key}(${primaryKeyInnerToCode(primaryKey, 't')}),`,
        ]);
      }

      if (indexes) {
        for (const index of indexes) {
          addCode(code, [`...t.${key}(`, indexInnerToCode(index, 't'), '),']);
        }
      }

      if (constraints) {
        for (const item of constraints) {
          addCode(code, [
            `...t.${key}(`,
            constraintInnerToCode(item, 't', true),
            '),',
          ]);
        }
      }
    }

    if (ast.comment !== undefined) {
      addCode(code, '}),');
      addCode(result, ');');
    } else {
      addCode(result, '}));');
    }

    return result;
  },
  renameType(ast, _, currentSchema) {
    const code: Code[] = [];
    const kind = ast.kind === 'TABLE' ? 'Table' : 'Type';

    if (ast.from === ast.to) {
      addCode(
        code,
        `await db.change${kind}Schema(${singleQuote(ast.to)}, ${singleQuote(
          ast.fromSchema ?? currentSchema,
        )}, ${singleQuote(ast.toSchema ?? currentSchema)});`,
      );
    } else {
      addCode(
        code,
        `await db.rename${kind}(${quoteSchemaTable({
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
    const code: Code[] = [
      `await db.${ast.action}Extension(${quoteSchemaTable(ast)}`,
    ];
    if (ast.version) {
      addCode(code, ', {');
      code.push([`version: ${singleQuote(ast.version)},`], '}');
    }
    addCode(code, ');');
    return code;
  },
  enum(ast) {
    return `await db.${
      ast.action === 'create' ? 'createEnum' : 'dropEnum'
    }(${quoteSchemaTable(ast)}, [${ast.values.map(singleQuote).join(', ')}]);`;
  },
  enumValues(ast) {
    return `await db.${ast.action}EnumValues(${quoteSchemaTable(
      ast,
    )}, [${ast.values.map(singleQuote).join(', ')}]);`;
  },
  renameEnumValues(ast) {
    return `await db.renameEnumValues(${quoteSchemaTable(
      ast,
    )}, { ${Object.entries(ast.values)
      .map(([from, to]) => `${quoteObjectKey(from)}: ${singleQuote(to)}`)
      .join(', ')} });`;
  },
  changeEnumValues(ast) {
    return `await db.changeEnumValues(${quoteSchemaTable(
      ast,
    )}, [${ast.fromValues.map(singleQuote).join(', ')}], [${ast.toValues
      .map(singleQuote)
      .join(', ')}]);`;
  },
  domain(ast) {
    return `await db.${ast.action}Domain(${quoteSchemaTable(
      ast,
    )}, (t) => ${ast.baseType.toCode('t')});`;
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
    const table = quoteSchemaTable({
      schema: ast.tableSchema,
      name: ast.tableName,
    });

    if (ast.references) {
      return [
        `await db.addForeignKey(`,
        [`${table},`, ...referencesArgsToCode(ast.references, ast.name, true)],
        ');',
      ];
    }

    const check = ast.check as TableData.Check;

    return [
      `await db.addCheck(${table}, ${check.toCode('t')}${
        ast.name ? `, ${singleQuote(ast.name)}` : ''
      });`,
    ];
  },
  renameTableItem(ast) {
    return [
      `await db.rename${
        ast.kind === 'INDEX' ? 'Index' : 'Constraint'
      }(${quoteSchemaTable({
        schema: ast.tableSchema,
        name: ast.tableName,
      })}, ${singleQuote(ast.from)}, ${singleQuote(ast.to)});`,
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
): boolean => {
  if (!column) return false;

  const { default: def } = column.data;
  return Boolean(
    column instanceof type &&
      !column.data.isNullable &&
      def &&
      typeof def === 'object' &&
      isRawSQL(def) &&
      (typeof def._sql === 'object' ? def._sql[0][0] : def._sql) === 'now()',
  );
};

interface AnyTimestampsInfo {
  hasTZTimestamps: boolean;
  hasAnyTimestamps: boolean;
  hasAnyCamelCaseTimestamps: boolean;
}

const getHasTimestamps = (
  config: AnyRakeDbConfig,
  createdAt: ColumnType | undefined,
  updatedAt: ColumnType | undefined,
): AnyTimestampsInfo => {
  const timestamps = getTimestampsInfo(
    config,
    createdAt,
    updatedAt,
    TimestampTZColumn,
  );
  const timestampsNoTZ = getTimestampsInfo(
    config,
    createdAt,
    updatedAt,
    TimestampColumn,
  );

  return {
    hasTZTimestamps: timestamps.hasTimestamps,
    hasAnyTimestamps: timestamps.hasTimestamps || timestampsNoTZ.hasTimestamps,
    hasAnyCamelCaseTimestamps:
      timestamps.camelCaseTimestamps || timestampsNoTZ.camelCaseTimestamps,
  };
};

interface TimestampsInfo {
  hasTimestamps: boolean;
  camelCaseTimestamps: boolean;
  snakeCaseTimestamps: boolean;
}

const getTimestampsInfo = (
  config: AnyRakeDbConfig,
  createdAt: ColumnType | undefined,
  updatedAt: ColumnType | undefined,
  type:
    | typeof TimestampTZColumn<ColumnSchemaConfig>
    | typeof TimestampColumn<ColumnSchemaConfig>,
): TimestampsInfo => {
  let hasTimestamps =
    isTimestamp(createdAt, type) && isTimestamp(updatedAt, type);

  const camelCaseTimestamps =
    !config.snakeCase &&
    hasTimestamps &&
    !createdAt?.data.name &&
    !updatedAt?.data.name;

  const snakeCaseTimestamps =
    hasTimestamps &&
    !camelCaseTimestamps &&
    ((!config.snakeCase &&
      createdAt?.data.name === 'created_at' &&
      updatedAt?.data.name === 'updated_at') ||
      (config.snakeCase && !createdAt?.data.name && !updatedAt?.data.name));

  if (!camelCaseTimestamps && !snakeCaseTimestamps) {
    hasTimestamps = false;
  }

  return {
    hasTimestamps,
    camelCaseTimestamps,
    snakeCaseTimestamps,
  };
};

const timestampsToCode = (
  config: AnyRakeDbConfig,
  { hasTZTimestamps, hasAnyCamelCaseTimestamps }: AnyTimestampsInfo,
): string => {
  const key = hasTZTimestamps ? 'timestamps' : 'timestampsNoTZ';

  return `t.${
    hasAnyCamelCaseTimestamps || config.snakeCase ? key : `${key}SnakeCase`
  }()`;
};
