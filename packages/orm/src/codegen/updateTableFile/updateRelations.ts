import {
  AppCodeUpdaterRelations,
  AppCodeUpdaterRelationItem,
  AppCodeUpdaterRelation,
} from '../appCodeUpdater';
import { QueryLogOptions } from 'pqb';
import fs from 'fs/promises';
import path from 'path';
import { FileChanges } from '../fileChanges';
import { getImportPath, pathToLog, singleQuote } from 'orchid-core';
import { ts } from '../tsUtils';
import {
  ClassDeclaration,
  ClassElement,
  Expression,
  NodeArray,
  Statement,
} from 'typescript';
import { pluralize } from 'inflection';

export type UpdateRelationsParams = {
  relations: AppCodeUpdaterRelations;
  logger?: QueryLogOptions['logger'];
};

type Imports = Record<string, string>;

export const updateRelations = async ({
  relations,
  logger,
}: UpdateRelationsParams) => {
  await Promise.all(
    Object.entries(relations).map(([tableName, item]) =>
      updateRelationItem(tableName, item, logger),
    ),
  );
};

const updateRelationItem = async (
  tableName: string,
  item: AppCodeUpdaterRelationItem,
  logger?: QueryLogOptions['logger'],
) => {
  const content = await fs.readFile(item.path, 'utf-8').catch(() => undefined);
  if (!content) return;

  const changes = new FileChanges(content);
  const statements = ts.getStatements(content);
  const dirName = path.dirname(item.path);

  const imports: Imports = {};
  for (const relation of item.relations) {
    if (!imports[relation.path]) {
      imports[relation.path] = relation.className;
    }
  }

  let importsEnd = 0;
  for (const node of ts.import.iterate(statements)) {
    const source = ts.import.getSource(node);
    const full = path.join(dirName, source + '.ts');
    if (imports[full]) {
      delete imports[full];
    }
    importsEnd = node.end;
  }

  const addImports = Object.entries(imports)
    .map(
      ([path, name]) =>
        `import { ${name} } from '${getImportPath(item.path, path)}';`,
    )
    .join('\n');

  if (addImports) {
    changes.add(importsEnd, `\n${addImports}`);
  }

  const targetClass = findClassByTableName(statements, tableName);
  if (targetClass) {
    const relationsMember = findRelationsMember(targetClass.members);
    if (relationsMember) {
      const { initializer } = relationsMember as {
        initializer?: Expression;
      };
      const takenKeys: Record<string, true> = {};
      if (ts.is.objectLiteral(initializer)) {
        const props = initializer.properties;
        for (const prop of props) {
          const name = prop.name?.getText();
          if (name) takenKeys[name] = true;
        }

        const addRelations: string[] = [];
        for (const rel of item.relations) {
          if (!checkRelation(rel)) continue;

          const name = makeRelationName(rel);
          if (takenKeys[name]) continue;

          addRelations.push(relationToCode(rel));
        }

        if (addRelations.length) {
          const pos = props.end;
          changes.add(pos, addRelations.join(''));
        }
      }
    } else {
      changes.add(
        targetClass.end - 1,
        `\n  relations = {${item.relations
          .filter(checkRelation)
          .map((rel) => relationToCode(rel))
          .join('')}\n  };\n`,
      );
    }
  }

  await fs.writeFile(item.path, changes.apply());
  logger?.log(`Updated ${pathToLog(item.path)}`);
};

const findClassByTableName = (
  statements: NodeArray<Statement>,
  tableName: string,
): ClassDeclaration | undefined => {
  for (const node of ts.class.iterate(statements)) {
    for (const member of node.members) {
      const name = ts.prop.getName(member);
      if (name !== 'table') continue;

      const { initializer: value } = member as unknown as {
        initializer?: Expression;
      };
      if (!value || !ts.is.stringLiteral(value)) continue;

      if (value.text === tableName) {
        return node;
      }
    }
  }
  return;
};

const findRelationsMember = (
  members: NodeArray<ClassElement>,
): ClassElement | undefined => {
  for (const member of members) {
    const name = ts.prop.getName(member);
    if (name === 'relations') return member;
  }
  return;
};

const checkRelation = (rel: AppCodeUpdaterRelation): boolean => {
  return rel.columns.length === 1 && rel.foreignColumns.length === 1;
};

const makeRelationName = (rel: AppCodeUpdaterRelation): string => {
  return pluralize(
    rel.className[0].toLowerCase() +
      rel.className.slice(1).replace(/Table$/, ''),
  );
};

const relationToCode = (
  rel: AppCodeUpdaterRelation,
  name = makeRelationName(rel),
): string => {
  const code = [`\n    ${name}: this.${rel.kind}(() => ${rel.className}, {`];

  const pk = rel[rel.kind === 'hasMany' ? 'columns' : 'foreignColumns'];
  const fk = rel[rel.kind === 'hasMany' ? 'foreignColumns' : 'columns'];
  code.push(
    `      columns: [${pk.map(singleQuote).join(', ')}],`,
    `      references: [${fk.map(singleQuote).join(', ')}],`,
    '    }),',
  );

  return code.join('\n');
};
