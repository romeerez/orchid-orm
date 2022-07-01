import { Factory } from 'fishery';
import { User } from './test-models';
import { insert } from './test-utils';

export const userFactory = Factory.define<User>(({ sequence, onCreate }) => {
  onCreate((params) => insert<User>('user', params));

  const now = new Date();
  return {
    id: sequence,
    name: `Name ${sequence}`,
    password: 'password',
    picture: null,
    createdAt: now,
    updatedAt: now,
  };
});
