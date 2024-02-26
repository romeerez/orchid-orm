import prompts from 'prompts';
import {
  setAdapterOptions,
  setAdminCredentialsToOptions,
} from './createOrDrop.utils';
import { asMock } from 'test-utils';

jest.mock('prompts', () => jest.fn());

describe('createOrDrop.utils', () => {
  describe('setAdapterOptions', () => {
    it('should set options in databaseURL to postgres', () => {
      const result = setAdapterOptions(
        {
          databaseURL: 'postgres://user:password@localhost:5432/dbname',
        },
        {
          database: 'updated-db',
          user: 'updated-user',
          password: 'updated-password',
        },
      );

      expect(result).toEqual({
        databaseURL:
          'postgres://updated-user:updated-password@localhost:5432/updated-db',
      });
    });

    it('should set object options', () => {
      const result = setAdapterOptions(
        {
          database: 'dbname',
          user: 'user',
          password: 'password',
        },
        {
          database: 'updated-db',
          user: 'updated-user',
          password: 'updated-password',
        },
      );

      expect(result).toEqual({
        database: 'updated-db',
        user: 'updated-user',
        password: 'updated-password',
      });
    });
  });

  describe('setAdminCredentialsToOptions', () => {
    beforeEach(() => {
      asMock(prompts).mockResolvedValueOnce({
        confirm: true,
      });

      asMock(prompts).mockResolvedValueOnce({
        user: 'admin-user',
        password: 'admin-password',
      });
    });

    it('should set admin credentials to databaseURL', async () => {
      const result = await setAdminCredentialsToOptions({
        databaseURL: 'postgres://user:password@localhost:5432/dbname',
      });

      expect(result).toEqual({
        databaseURL:
          'postgres://admin-user:admin-password@localhost:5432/dbname',
      });
    });

    it('should set admin credentials to options', async () => {
      const result = await setAdminCredentialsToOptions({
        database: 'dbname',
        user: 'user',
        password: 'password',
      });

      expect(result).toEqual({
        database: 'dbname',
        user: 'admin-user',
        password: 'admin-password',
      });
    });
  });
});
