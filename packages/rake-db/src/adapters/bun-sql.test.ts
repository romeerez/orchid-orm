import { rakeDb } from './bun-sql';
import { rakeDbCliWithAdapter, setRakeDbCliRunFn } from '../cli/rake-db.cli';

jest.mock('../cli/rake-db.cli', () => ({
  rakeDbCliWithAdapter: Object.assign(jest.fn(), { run: jest.fn() }),
  setRakeDbCliRunFn: jest.fn((rakeDb) => {
    rakeDb.run = jest.fn();
  }),
}));

describe('bun-sql', () => {
  it('should instantiate rakeDb with bun-sql adapter', () => {
    const config = {
      migrations: {},
    };
    const args = ['arg'];

    rakeDb(config, args);

    expect(rakeDbCliWithAdapter).toHaveBeenCalledWith(config, args);

    expect(setRakeDbCliRunFn).toHaveBeenCalledWith(rakeDb);
  });
});
