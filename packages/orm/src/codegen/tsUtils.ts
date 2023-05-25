import {
  CallExpression,
  ClassDeclaration,
  ComputedPropertyName,
  Expression,
  Identifier,
  ImportDeclaration,
  NamedImports,
  Node,
  NodeArray,
  NumericLiteral,
  ObjectLiteralElement,
  ObjectLiteralExpression,
  PrivateIdentifier,
  PropertyAccessExpression,
  PropertyAssignment,
  ShorthandPropertyAssignment,
  Statement,
  StringLiteral,
  VariableStatement,
  ThisExpression,
  ArrowFunction,
  ParenthesizedExpression,
  PropertyName,
  SpreadAssignment,
  ArrayLiteralExpression,
} from 'typescript';
import typescript from 'typescript';
const { createSourceFile, ScriptTarget, SyntaxKind } = typescript;

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

const isNode = <T extends Expression | ObjectLiteralElement | Node>(
  kind: number,
) => {
  return (node?: Expression | ObjectLiteralElement | Node): node is T => {
    return node?.kind === kind;
  };
};

export const ts = {
  getStatements(content: string): NodeArray<Statement> {
    const { statements } = createSourceFile(
      'file.ts',
      content,
      ScriptTarget.Latest,
      true,
    );
    return statements;
  },
  is: {
    call: isNode<CallExpression>(SyntaxKind.CallExpression),
    objectLiteral: isNode<ObjectLiteralExpression>(
      SyntaxKind.ObjectLiteralExpression,
    ),
    propertyAssignment: isNode<PropertyAssignment>(
      SyntaxKind.PropertyAssignment,
    ),
    shorthandPropertyAssignment: isNode<ShorthandPropertyAssignment>(
      SyntaxKind.ShorthandPropertyAssignment,
    ),
    identifier: isNode<Identifier>(SyntaxKind.Identifier),
    stringLiteral: isNode<StringLiteral>(SyntaxKind.StringLiteral),
    arrayLiteral: isNode<ArrayLiteralExpression>(
      SyntaxKind.ArrayLiteralExpression,
    ),
    numericLiteral: isNode<NumericLiteral>(SyntaxKind.NumericLiteral),
    computedPropertyName: isNode<ComputedPropertyName>(
      SyntaxKind.ComputedPropertyName,
    ),
    privateIdentifier: isNode<PrivateIdentifier>(SyntaxKind.PrivateIdentifier),
    this: isNode<ThisExpression>(SyntaxKind.ThisKeyword),
    propertyAccess: isNode<PropertyAccessExpression>(
      SyntaxKind.PropertyAccessExpression,
    ),
    arrowFunction: isNode<ArrowFunction>(SyntaxKind.ArrowFunction),
    parenthesizedExpression: isNode<ParenthesizedExpression>(
      SyntaxKind.ParenthesizedExpression,
    ),
    spreadAssignment: isNode<SpreadAssignment>(SyntaxKind.SpreadAssignment),
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
  class: {
    iterate: iterate<ClassDeclaration>(SyntaxKind.ClassDeclaration),
  },
  prop: {
    getName({ name }: { name?: PropertyName }) {
      if (ts.is.identifier(name)) {
        return name.escapedText;
      } else if (name && 'text' in name) {
        return name.text;
      } else {
        return name?.getText();
      }
    },
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
  spaces: {
    getAtLine(content: string, pos: number) {
      const lines = content.slice(0, pos).split('\n');
      const last = lines[lines.length - 1];
      return last.match(/^\s+/)?.[0] || '';
    },
  },
};
