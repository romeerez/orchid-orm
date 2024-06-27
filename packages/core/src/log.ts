import { SingleSql } from './query';

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
