import { belongsTo, hasOne } from './relations';
import { model } from './model';
import { createPg } from './test-utils/test-db';

describe('relations', () => {
  it('should attach one repo to another without circular problems', () => {
    class User extends model({
      table: 'user',
      schema: (t) => ({
        id: t.serial()
      })
    }) {
      relations = {
        profile: hasOne(() => Profile),
      };
    }

    class Profile extends model({
      table: 'profile',
      schema: (t) => ({
        id: t.serial()
      })
    }) {
      relations = {
        user: belongsTo(() => User),
      };
    }

    const db = createPg({
      user: User,
      profile: Profile,
    });

    expect(db.user.relations.profile.repoFn()).toBe(Profile);
    expect(db.profile.relations.user.repoFn()).toBe(User);
  });
});
