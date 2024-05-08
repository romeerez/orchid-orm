import {
  AnyRakeDbConfig,
  RakeDbAst,
  colors,
  exhaustive,
  getSchemaAndTableFromName,
  pluralize,
} from 'rake-db';
import { addCode, Code, codeToString, toArray } from 'orchid-core';
import { getColumnDbType } from './generators/columns.generator';
import { fnOrTableToString } from './generators/foreignKeys.generator';

export const report = (
  ast: RakeDbAst[],
  config: AnyRakeDbConfig,
  currentSchema: string,
) => {
  if (!config.logger) return;

  const code: Code[] = [];

  let green, red, yellow, pale;
  if (typeof config.log === 'object' && config.log.colors === false) {
    green = red = yellow = pale = (s: string) => s;
  } else {
    ({ green, red, yellow, pale } = colors);
  }

  for (const a of ast) {
    switch (a.type) {
      case 'table': {
        let hasPrimaryKey = !!a.primaryKey;
        const counters = {
          column: 0,
          index: a.indexes?.length ?? 0,
          'foreign key':
            a.constraints?.reduce<number>(
              (sum, c) => (c.references ? sum + 1 : sum),
              0,
            ) ?? 0,
          check:
            a.constraints?.reduce<number>(
              (sum, c) => (c.check ? sum + 1 : sum),
              0,
            ) ?? 0,
        };
        for (const key in a.shape) {
          counters.column++;

          const column = a.shape[key];
          if (column.data.primaryKey) {
            hasPrimaryKey = true;
          }

          if (column.data.indexes) {
            counters.index += column.data.indexes.length;
          }

          if (column.data.foreignKeys) {
            counters['foreign key'] += column.data.foreignKeys.length;
          }

          if (column.data.check) {
            counters.check++;
          }
        }

        const summary: string[] = [];

        for (const key in counters) {
          const value = counters[key as keyof typeof counters];
          if (value || key === 'column') {
            summary.push(
              `${value} ${pluralize(key, value, key === 'index' ? 'es' : 's')}`,
            );
          }
        }

        if (!hasPrimaryKey) {
          summary.push('no primary key');
        }

        code.push(
          `${
            a.action === 'create'
              ? green('+ create table')
              : red('- drop table')
          } ${dbItemName(a, currentSchema)} (${summary.join(', ')})`,
        );
        break;
      }
      case 'changeTable': {
        const inner: Code[] = [];

        for (const key in a.shape) {
          const changes = toArray(a.shape[key]);
          for (const change of changes) {
            if (change.type === 'add' || change.type === 'drop') {
              const column = change.item;
              const name = column.data.name ?? key;
              const { primaryKey, indexes, foreignKeys, check } = column.data;

              inner.push(
                `${
                  change.type === 'add'
                    ? green('+ add column')
                    : red('- drop column')
                } ${name} ${
                  column.data.alias ?? getColumnDbType(column, currentSchema)
                }${column.data.isNullable ? ' nullable' : ''}${
                  primaryKey ? ' primary key' : ''
                }${
                  foreignKeys
                    ? ` references ${foreignKeys
                        .map((fk) => {
                          return `${fnOrTableToString(
                            fk.fnOrTable,
                          )}(${fk.foreignColumns.join(', ')})`;
                        })
                        .join(', ')}`
                    : ''
                }${
                  indexes?.length
                    ? indexes.length === 1
                      ? ', has index'
                      : `, has ${indexes.length} indexes`
                    : ''
                }${check ? `, checks ${check.sql.toSQL({ values: [] })}` : ''}`,
              );
            } else if (change.type === 'change') {
              const name = change.from.column?.data.name ?? key;
              const changes: Code[] = [];
              inner.push(`${yellow('~ change column')} ${name}:`, changes);
              changes.push(`${yellow('from')}: `);
              for (const code of change.from.column!.toCode('t', true)) {
                addCode(changes, code);
              }
              changes.push(`  ${yellow('to')}: `);
              for (const code of change.to.column!.toCode('t', true)) {
                addCode(changes, code);
              }
            } else if (change.type === 'rename') {
              inner.push(
                `${yellow('~ rename column')} ${key} ${yellow('=>')} ${
                  change.name
                }`,
              );
            } else {
              exhaustive(change.type);
            }
          }
        }

        if (a.drop.primaryKey) {
          inner.push(
            `${red(`- drop primary key`)} on (${a.drop.primaryKey.columns.join(
              ', ',
            )})`,
          );
        }

        if (a.drop.indexes) {
          for (const index of a.drop.indexes) {
            inner.push(
              `${red(
                `- drop${index.options.unique ? ' unique' : ''} index`,
              )} on (${index.columns
                .map((c) => ('column' in c ? c.column : c.expression))
                .join(', ')})`,
            );
          }
        }

        if (a.drop.constraints) {
          for (const { references } of a.drop.constraints) {
            if (!references) continue;

            const [schema, name] = getSchemaAndTableFromName(
              references.fnOrTable as string,
            );

            inner.push(
              `${red(`- drop foreign key`)} on (${references.columns.join(
                ', ',
              )}) to ${dbItemName(
                {
                  schema,
                  name,
                },
                currentSchema,
              )}(${references.foreignColumns.join(', ')})`,
            );
          }

          for (const { check } of a.drop.constraints) {
            if (!check) continue;

            inner.push(`${red(`- drop check`)} ${check.toSQL({ values: [] })}`);
          }
        }

        if (a.add.primaryKey) {
          inner.push(
            `${green(`+ add primary key`)} on (${a.add.primaryKey.columns.join(
              ', ',
            )})`,
          );
        }

        if (a.add.indexes) {
          for (const index of a.add.indexes) {
            inner.push(
              `${green(
                `+ add${index.options.unique ? ' unique' : ''} index`,
              )} on (${index.columns
                .map((c) => ('column' in c ? c.column : c.expression))
                .join(', ')})`,
            );
          }
        }

        if (a.add.constraints) {
          for (const { references } of a.add.constraints) {
            if (!references) continue;

            inner.push(
              `${green(`+ add foreign key`)} on (${references.columns.join(
                ', ',
              )}) to ${
                references.fnOrTable as string
              }(${references.foreignColumns.join(', ')})`,
            );
          }

          for (const { check } of a.add.constraints) {
            if (!check) continue;

            inner.push(
              `${green(`+ add check`)} ${check.toSQL({ values: [] })}`,
            );
          }
        }

        code.push(
          `${yellow('~ change table')} ${dbItemName(a, currentSchema)}${
            inner.length ? ':' : ''
          }`,
        );

        if (inner.length) {
          code.push(inner);
        }

        break;
      }
      case 'schema': {
        code.push(
          `${
            a.action === 'create'
              ? green('+ create schema')
              : red('- drop schema')
          } ${a.name}`,
        );
        break;
      }
      case 'renameSchema': {
        code.push(
          `${yellow('~ rename schema')} ${a.from} ${yellow('=>')} ${a.to}`,
        );
        break;
      }
      case 'renameType': {
        code.push(
          `${yellow(
            `~ ${
              a.fromSchema !== a.toSchema
                ? a.from !== a.to
                  ? 'change schema and rename'
                  : 'change schema of'
                : 'rename'
            } ${a.kind.toLowerCase()}`,
          )} ${dbItemName(
            {
              schema: a.fromSchema,
              name: a.from,
            },
            currentSchema,
          )} ${yellow('=>')} ${dbItemName(
            {
              schema: a.toSchema,
              name: a.to,
            },
            currentSchema,
          )}`,
        );
        break;
      }
      case 'extension': {
        code.push(
          `${
            a.action === 'create'
              ? green('+ create extension')
              : red('- drop extension')
          } ${dbItemName(a, currentSchema)}${
            a.version ? ` ${pale(a.version)}` : ''
          }`,
        );
        break;
      }
      case 'enum': {
        code.push(
          `${
            a.action === 'create' ? green('+ create enum') : red('- drop enum')
          } ${dbItemName(a, currentSchema)}: (${a.values.join(', ')})`,
        );
        break;
      }
      case 'enumValues': {
        code.push(
          `${
            a.action === 'add'
              ? green('+ add values to enum')
              : red('- remove values from enum')
          } ${dbItemName(a, currentSchema)}: ${a.values.join(', ')}`,
        );
        break;
      }
      case 'changeEnumValues': {
        if (a.fromValues) {
          code.push(
            `${red('- remove values from enum')} ${dbItemName(
              a,
              currentSchema,
            )}: ${a.fromValues.join(', ')}`,
          );
        }
        if (a.toValues) {
          code.push(
            `${green('+ add values to enum')} ${dbItemName(
              a,
              currentSchema,
            )}: ${a.toValues.join(', ')}`,
          );
        }
        break;
      }
      case 'domain': {
        code.push(
          `${
            a.action === 'create'
              ? green('+ create domain')
              : red('- drop domain')
          } ${dbItemName(a, currentSchema)}`,
        );
        break;
      }
      case 'view':
      case 'collation':
      case 'renameEnumValues':
      case 'constraint':
        break;
      case 'renameTableItem': {
        code.push(
          `${yellow(`~ rename ${a.kind.toLowerCase()}`)} on table ${dbItemName(
            { schema: a.tableSchema, name: a.tableName },
            currentSchema,
          )}: ${a.from} ${yellow('=>')} ${a.to}`,
        );
        break;
      }
      default:
        exhaustive(a);
    }
  }

  const result = codeToString(code, '', '  ');
  config.logger.log(result);
};

const dbItemName = (
  { schema, name }: { schema?: string; name: string },
  currentSchema: string,
) => {
  return schema && schema !== currentSchema ? `${schema}.${name}` : name;
};
