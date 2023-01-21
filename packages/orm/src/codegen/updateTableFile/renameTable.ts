import { UpdateTableFileParams } from './updateTableFile';
import { RakeDbAst } from 'rake-db';
import fs from 'fs/promises';
import { FileChanges } from '../fileChanges';
import { ts } from '../tsUtils';
import { toPascalCase } from '../../utils';
import { Expression } from 'typescript';
import { singleQuote } from 'pqb';

export const renameTable = async ({
  ast,
  ...params
}: UpdateTableFileParams & { ast: RakeDbAst.RenameTable }) => {
  const tablePath = params.tablePath(ast.from);
  const content = await fs.readFile(tablePath, 'utf-8').catch(() => undefined);
  if (!content) return;

  const changes = new FileChanges(content);
  const statements = ts.getStatements(content);
  const className = toPascalCase(ast.from);

  for (const node of ts.class.iterate(statements)) {
    if (node.name?.escapedText !== className) continue;

    for (const member of node.members) {
      const name = ts.prop.getName(member);
      if (name !== 'table') continue;

      const { initializer: value } = member as unknown as {
        initializer?: Expression;
      };

      if (!value) continue;

      changes.replace(value.pos, value.end, ` ${singleQuote(ast.to)}`);
    }
  }

  await fs.writeFile(params.tablePath(ast.to), changes.apply());
};
