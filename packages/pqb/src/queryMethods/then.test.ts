import { db } from '../test-utils';

describe('then', () => {
  describe('catch', () => {
    it.only('should catch error', (done) => {
      db('kokoko').catch((err) => {
        expect(err.message).toBe(`relation "kokoko" does not exist`);
        done();
      });
    });
  });
});
