import { RawSQLBase, TemplateLiteralArgs } from './raw';

// Argument for `query` and `queryArrays`, it can be a SQL template literal, or a raw SQL object.
export type SQLQueryArgs = TemplateLiteralArgs | [RawSQLBase];
