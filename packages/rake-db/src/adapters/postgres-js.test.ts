import { rakeDb } from './postgres-js';
import { rakeDbCliWithAdapter, setRakeDbCliRunFn } from '../cli/rake-db.cli';

jest.mock('../cli/rake-db.cli', () => ({
  rakeDbCliWithAdapter: Object.assign(jest.fn(), { run: jest.fn() }),
  setRakeDbCliRunFn: jest.fn((rakeDb) => {
    rakeDb.run = jest.fn();
  }),
}));

describe('postgres-js', () => {
  it('should instantiate rakeDb with postgres-js adapter', () => {
    const config = {
      migrations: {},
    };
    const args = ['arg'];

    rakeDb(config, args);

    expect(rakeDbCliWithAdapter).toHaveBeenCalledWith(config, args);

    expect(setRakeDbCliRunFn).toHaveBeenCalledWith(rakeDb);
  });
});
