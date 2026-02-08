import { makeRakeDbConfig } from 'rake-db';
import { testRakeDb } from 'test-utils';

export const mockChangeLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const rakeDbConfig = makeRakeDbConfig({
  migrations: {},
  log: { colors: false },
  logger: mockChangeLogger,
});

export const { change } = testRakeDb(rakeDbConfig);
