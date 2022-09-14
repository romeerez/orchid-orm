import { Query } from '../query';
import { Sql } from '../sql';
import { quote } from '../quote';

export type QueryLogObject = {
  colors: boolean;
  beforeQuery(q: Query, sql: Sql): unknown;
  afterQuery(q: Query, sql: Sql, logData: unknown): void;
  onError(error: Error, q: Query, sql: Sql, logData: unknown): void;
};

export type QueryLogger = {
  log(message: string): void;
  error(message: string): void;
};

export type QueryLogOptions = {
  log?: boolean | Partial<QueryLogObject>;
  logger?: QueryLogger;
};

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
  values: unknown[],
): string => {
  const elapsed = process.hrtime(time);
  const formattedTime = `(${elapsed[0] ? `${elapsed[0]}s ` : ''}${(
    elapsed[1] / 1000000
  ).toFixed(1)}ms)`;

  const formattedValues = `[${values.map(quote).join(', ')}]`;

  return `${colors ? timeColor(formattedTime) : formattedTime} ${
    colors ? sqlColor(sql) : sql
  } ${colors ? valuesColor(formattedValues) : formattedValues}`;
};

export const logParamToLogObject = (
  logger: QueryLogger,
  log: QueryLogOptions['log'],
): QueryLogObject | undefined => {
  if (!log) return;
  const logObject = Object.assign(
    {
      colors: true,
      beforeQuery() {
        return process.hrtime();
      },
      afterQuery(_, sql, time: [number, number]) {
        logger.log(
          makeMessage(
            colors,
            logColors.boldCyanBright,
            time,
            logColors.boldBlue,
            sql.text,
            logColors.boldYellow,
            sql.values,
          ),
        );
      },
      onError(error, _, sql, time: [number, number]) {
        const message = `Error: ${error.message}`;

        logger.error(
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
    } as QueryLogObject,
    log === true ? {} : log,
  );

  const colors = logObject.colors;

  return logObject;
};

export class QueryLog {
  log<T extends Query>(this: T, log = true): T {
    return this.clone()._log(log);
  }

  _log<T extends Query>(this: T, log = true): T {
    this.query.log = logParamToLogObject(this.query.logger, log);
    return this;
  }
}
