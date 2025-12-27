import { User } from '../../../test-utils/pqb.test-utils';
import { assertType } from 'test-utils';

describe('clone', () => {
  it('should return new object with the same data structures', () => {
    const cloned = User.clone();
    expect(cloned).not.toBe(User);
    expect(cloned.table).toBe(User.table);
    expect(cloned.shape).toBe(User.shape);

    assertType<typeof User, typeof cloned>();
  });
});
