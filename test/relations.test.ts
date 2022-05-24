import { createPg } from './utils';
import { belongsTo, hasOne } from '../src/postgres/postgres.relations';
import { PostgresModel } from '../src/postgres/postgres.model';

describe('relations', () => {
  it('should attach one repo to another without circular problems', () => {
    class User extends PostgresModel<{ id: number }> {
      relations = {
        profile: hasOne(() => Profile),
      };
    }

    class Profile extends PostgresModel<{ id: number }> {
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
