import { escapeForLog } from '../../../quote';
import { _clone } from '../clone/clone';
import { SingleSql } from '../../sql/sql';

export interface QueryLogObject {
  colors: boolean;
  beforeQuery(sql: SingleSql): unknown;
  afterQuery(sql: SingleSql, logData: unknown): void;
  onError(error: Error, sql: SingleSql, logData: unknown): void;
}

export interface QueryLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface QueryLogOptions {
  log?: boolean | Partial<QueryLogObject>;
  logger?: QueryLogger;
}

export const logColors = {
  boldCyanBright: (message: string) =>
    `\u001b[1m\u001b[96m${message}\u001b[39m\u001b[22m`,

  boldBlue: (message: string) =>
    `\u001b[1m\u001b[34m${message}\u001b[39m\u001b[22m`,

  boldYellow: (message: string) =>
    `\u001b[1m\u001b[33m${message}\u001b[39m\u001b[22m`,

  boldMagenta: (message: string) =>
    `\u001b[1m\u001b[33m${message}\u001b[39m\u001b[22m`,

  boldRed: (message: string) =>
    `\u001b[1m\u001b[31m${message}\u001b[39m\u001b[22m`,
};

const makeMessage = (
  colors: boolean,
  timeColor: (message: string) => string,
  time: [number, number],
  sqlColor: (message: string) => string,
  sql: string,
  valuesColor: (message: string) => string,
  values?: unknown[],
): string => {
  const elapsed = process.hrtime(time);
  const formattedTime = `(${elapsed[0] ? `${elapsed[0]}s ` : ''}${(
    elapsed[1] / 1000000
  ).toFixed(1)}ms)`;

  const result = `${colors ? timeColor(formattedTime) : formattedTime} ${
    colors ? sqlColor(sql) : sql
  }`;

  if (!values?.length) {
    return result;
  }

  const formattedValues = `[${values.map(escapeForLog).join(', ')}]`;

  return `${result} ${colors ? valuesColor(formattedValues) : formattedValues}`;
};

/**
 * Key of the logger of a log object.
 * It's registered globally to be the same in every loaded copy of pqb, such as its CommonJS and ES module builds.
 * The property under this key is not enumerable, so a log object copied into a `log` option doesn't bring its logger.
 */
const loggerKey = Symbol.for('pqb.queryLogger');

interface LogObjectWithLogger extends QueryLogObject {
  [loggerKey]: QueryLogger;
}

/**
 * Default settings and callbacks of a log object.
 * The callbacks take `colors` and the logger from the log object they are called on.
 */
const defaultLogObject: QueryLogObject = {
  colors: true,
  beforeQuery() {
    return process.hrtime();
  },
  afterQuery(this: LogObjectWithLogger, sql, time: [number, number]) {
    this[loggerKey].log(
      makeMessage(
        this.colors,
        logColors.boldCyanBright,
        time,
        logColors.boldBlue,
        sql.text,
        logColors.boldYellow,
        sql.values,
      ),
    );
  },
  onError(this: LogObjectWithLogger, error, sql, time: [number, number]) {
    const { colors } = this;
    const message = `Error: ${error.message}`;

    this[loggerKey].error(
      `${makeMessage(
        colors,
        logColors.boldMagenta,
        time,
        logColors.boldRed,
        sql.text,
        logColors.boldYellow,
        sql.values,
      )} ${colors ? logColors.boldRed(message) : message}`,
    );
  },
};

export const logParamToLogObject = (
  logger: QueryLogger,
  log: QueryLogOptions['log'],
): QueryLogObject | undefined => {
  if (!log) return;

  const logObject: QueryLogObject = Object.assign(
    {},
    defaultLogObject,
    log === true ? undefined : log,
  );

  Object.defineProperty(logObject, loggerKey, { value: logger });

  return logObject;
};

export class QueryLog {
  /**
   * Override the `log` option, which can also be set in `createDb` or when creating a table instance:
   *
   * ```ts
   * // turn log on for this query:
   * await db.table.all().log(true);
   * await db.table.all().log(); // no argument for true
   *
   * // turn log off for this query:
   * await db.table.all().log(false);
   * ```
   *
   * Use {@link $withOptions} to override `log` for a scope of a callback.
   */
  log<T>(this: T, log = true): T {
    const q = _clone(this);
    q.q.log = logParamToLogObject(q.q.logger, log);
    return q as T;
  }
}
