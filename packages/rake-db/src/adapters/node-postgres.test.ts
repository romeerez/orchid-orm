import { rakeDb } from './node-postgres';
import { rakeDbCliWithAdapter, setRakeDbCliRunFn } from '../cli/rake-db.cli';

jest.mock('../cli/rake-db.cli', () => ({
  rakeDbCliWithAdapter: Object.assign(jest.fn(), { run: jest.fn() }),
  setRakeDbCliRunFn: jest.fn((rakeDb) => {
    rakeDb.run = jest.fn();
  }),
}));

describe('node-postgres', () => {
  it('should instantiate rakeDb with node-postgres adapter', () => {
    const config = {
      migrations: {},
    };
    const args = ['arg'];

    rakeDb(config, args);

    expect(rakeDbCliWithAdapter).toHaveBeenCalledWith(config, args);

    expect(setRakeDbCliRunFn).toHaveBeenCalledWith(
      rakeDb,
      expect.any(Function),
    );
  });
});
