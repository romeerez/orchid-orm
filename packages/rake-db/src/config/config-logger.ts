import { QueryLogOptions } from 'pqb/index';
import { DbParam } from '../utils';

export const handleConfigLogger = (
  config: QueryLogOptions,
  db?: DbParam,
): QueryLogOptions | undefined => {
  const q = db
    ? '$qb' in db && db.$qb
      ? db.$qb.q
      : 'q' in db
        ? db.q
        : undefined
    : undefined;

  const queryLogger = q?.log && q.logger;

  return {
    log: config.log ?? q?.log,
    logger:
      config.log === true
        ? config.logger || queryLogger || console
        : config.log === false
          ? undefined
          : config.logger || queryLogger,
  };
};
