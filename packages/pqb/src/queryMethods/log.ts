import { escapeForLog } from '../quote';
import {
  logColors,
  QueryLogger,
  QueryLogObject,
  QueryLogOptions,
} from 'orchid-core';
import { _clone } from '../query/queryUtils';

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
      afterQuery(sql, time: [number, number]) {
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
      onError(error, sql, time: [number, number]) {
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
  log<T>(this: T, log = true): T {
    const q = _clone(this);
    q.q.log = logParamToLogObject(q.q.logger, log);
    return q as T;
  }
}
