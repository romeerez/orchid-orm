import { db } from 'test-utils';
import { assertType } from 'test-utils';

describe('clone', () => {
  it('should return new object with the same data structures', () => {
    const cloned = db.user.clone();
    expect(cloned).not.toBe(db.user);
    expect(cloned.table).toBe(db.user.table);
    expect(cloned.shape).toBe(db.user.shape);

    assertType<typeof db.user, typeof cloned>();
  });
});
