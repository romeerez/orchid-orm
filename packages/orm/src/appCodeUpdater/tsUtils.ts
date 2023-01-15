import {
  CallExpression,
  Expression,
  ImportDeclaration,
  NamedImports,
  NodeArray,
  ObjectLiteralElement,
  ObjectLiteralExpression,
  PropertyAssignment,
  ShorthandPropertyAssignment,
  Statement,
  SyntaxKind,
  VariableStatement,
} from 'typescript';
import path from 'path';

const iterate = <T>(
  kind: number,
): ((statements: NodeArray<Statement>) => Generator<T, void, unknown>) => {
  return function* (statements: NodeArray<Statement>) {
    for (const node of statements) {
      if (node.kind === kind) {
        yield node as T;
      }
    }
  };
};

const isNode = <T extends { kind: number }>() => {
  return <U extends T>(kind: number) => {
    return (node?: T): node is U => {
      return node?.kind === kind;
    };
  };
};

const isExpression = isNode<Expression>();
const isObjectLiteral = isNode<ObjectLiteralElement>();

export const ts = {
  is: {
    call: isExpression<CallExpression>(SyntaxKind.CallExpression),
    objectLiteral: isExpression<ObjectLiteralExpression>(
      SyntaxKind.ObjectLiteralExpression,
    ),
    propertyAssignment: isObjectLiteral<PropertyAssignment>(
      SyntaxKind.PropertyAssignment,
    ),
    shorthandPropertyAssignment: isObjectLiteral<ShorthandPropertyAssignment>(
      SyntaxKind.ShorthandPropertyAssignment,
    ),
  },
  import: {
    iterate: iterate<ImportDeclaration>(SyntaxKind.ImportDeclaration),
    *iterateWithSource(statements: NodeArray<Statement>, path: string) {
      for (const node of ts.import.iterate(statements)) {
        if (ts.import.getSource(node) !== path) continue;
        yield node;
      }
    },
    getSource(node: ImportDeclaration) {
      return node.moduleSpecifier.getText().slice(1, -1);
    },
    getEndPos(statements: NodeArray<Statement>) {
      let end = 0;
      for (const node of ts.import.iterate(statements)) {
        end = node.end;
      }
      return end;
    },
    getStatementsImportedName(
      statements: NodeArray<Statement>,
      path: string,
      key: string,
    ) {
      for (const node of ts.import.iterateWithSource(statements, path)) {
        const name = ts.import.getImportName(node, key);
        if (name) return name;
      }

      return;
    },
    getImportName(node: ImportDeclaration, key: string) {
      if (!node.importClause) return;

      const elements = (node.importClause.namedBindings as NamedImports)
        ?.elements;

      if (!elements) return;

      for (const element of elements) {
        if (
          element.propertyName?.escapedText === key ||
          element.name.escapedText === key
        ) {
          return element.name.escapedText.toString();
        }
      }

      return;
    },
  },
  variable: {
    iterate: iterate<VariableStatement>(SyntaxKind.VariableStatement),
    *iterateDeclarations(statements: NodeArray<Statement>) {
      for (const node of ts.variable.iterate(statements)) {
        for (const dec of node.declarationList.declarations) {
          yield dec;
        }
      }
    },
  },
  prop: {
    getValue(prop: ObjectLiteralElement) {
      if (ts.is.propertyAssignment(prop)) {
        return prop.initializer.getText();
      } else if (ts.is.shorthandPropertyAssignment(prop)) {
        return prop.name.escapedText.toString();
      } else {
        return;
      }
    },
  },
  path: {
    getRelative(from: string, to: string) {
      const rel = path.relative(path.dirname(from), to);
      return rel.startsWith('./') || rel.startsWith('../') ? rel : `./${rel}`;
    },
  },
  spaces: {
    getAtLine(content: string, pos: number) {
      const lines = content.slice(0, pos).split('\n');
      const last = lines[lines.length - 1];
      return last.match(/^\s+/)?.[0] || '';
    },
  },
};
