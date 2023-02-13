import { BaseOperators } from './operators';
import { Code } from './code';

// output type of the column
export type ColumnOutput<T extends ColumnTypeBase> = T['type'];

// input type of the column
export type ColumnInput<T extends ColumnTypeBase> = T['inputType'];

// base type of object with columns
export type ColumnShapeBase = Record<string, ColumnTypeBase>;

// output of base shape of columns
export type ColumnShapeOutput<Shape extends ColumnShapeBase> = {
  [K in keyof Shape]: ColumnOutput<Shape[K]>;
};

// base data of column
export type ColumnDataBase = {
  isNullable?: boolean;
};

// base column type
export abstract class ColumnTypeBase<
  Type = unknown,
  Ops extends BaseOperators = BaseOperators,
  InputType = Type,
  Data extends ColumnDataBase = ColumnDataBase,
> {
  // name of the type in a database
  abstract dataType: string;

  // operators supported by the type, that are available in `where` method
  abstract operators: Ops;

  // turn the column into TS code, used for code generation
  abstract toCode(t: string): Code;

  // output type
  type!: Type;

  // input type
  inputType!: InputType;

  // is null values allowed
  isNullable!: boolean;

  // data of the column that specifies column characteristics and validations
  data = {} as Data;

  // is column a primary key in a database
  isPrimaryKey = false;

  // is column removed from default table selection
  isHidden = false;

  // if column has a default value, then it can be omitted in `create` method
  hasDefault = false;

  // encode value passed to `create` to an appropriate value for a database
  encodeFn?: (input: any) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

  // parse value from a database into what is preferred by the app
  parseFn?: (input: unknown) => unknown;

  // parse value from a database when it is an element of database array type
  parseItem?: (input: string) => unknown;
}
