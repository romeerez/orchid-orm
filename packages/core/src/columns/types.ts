/**
 * Symbol that turns on a snake case column names.
 * It is set on the column types.
 * When it's on, column names in ORM are still as user types them, but they are translated to snake_case when generating SQL.
 */
export const snakeCaseKey: unique symbol = Symbol('snakeCase');
