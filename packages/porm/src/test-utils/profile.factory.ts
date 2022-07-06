import { Factory } from 'fishery';
import { Profile } from './test-models';
import { insert } from './test-utils';

export const profileFactory = Factory.define<Profile>(
  ({ params, sequence, onCreate }) => {
    onCreate((params) => insert<Profile>('profile', params));

    if (!params.userId) throw new Error(`userId is a required field`);

    const now = new Date();
    return {
      id: sequence,
      userId: params.userId,
      bio: 'About person',
      createdAt: now,
      updatedAt: now,
    };
  },
);
