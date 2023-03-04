import { UpdateTableFileParams } from './updateTableFile';
import { RakeDbAst } from 'rake-db';
import fs from 'fs/promises';
import { FileChanges } from '../fileChanges';
import { ts } from '../tsUtils';
import { toPascalCase } from '../../utils';
import { Expression } from 'typescript';
import { singleQuote } from 'orchid-core';

export const renameTable = async ({
  ast,
  ...params
}: UpdateTableFileParams & { ast: RakeDbAst.RenameTable }) => {
  const tablePath = params.tablePath(ast.from);
  const content = await fs.readFile(tablePath, 'utf-8').catch(() => undefined);
  if (!content) return;

  const changes = new FileChanges(content);
  const statements = ts.getStatements(content);
  const className = toPascalCase(ast.from) + 'Table';

  const changeSchema = ast.fromSchema !== ast.toSchema;

  for (const node of ts.class.iterate(statements)) {
    if (node.name?.escapedText !== className) continue;

    const addSchema =
      changeSchema &&
      ast.toSchema &&
      !node.members.some((member) => ts.prop.getName(member) === 'schema');

    if (addSchema && ast.toSchema) {
      changes.add(
        node.members.pos,
        `\n  schema = ${singleQuote(ast.toSchema)};`,
      );
    }

    for (const member of node.members) {
      const name = ts.prop.getName(member);

      if (name !== 'table' && !(changeSchema && name === 'schema')) continue;

      const { initializer: value } = member as unknown as {
        initializer?: Expression;
      };

      if (!value) continue;

      if (name === 'schema') {
        if (ast.toSchema) {
          changes.replace(
            value.pos,
            value.end,
            ` ${singleQuote(ast.toSchema)}`,
          );
        } else {
          changes.remove(member.pos, member.end);
        }
      } else {
        changes.replace(value.pos, value.end, ` ${singleQuote(ast.to)}`);
      }
    }
  }

  await fs.writeFile(tablePath, changes.apply());
};
