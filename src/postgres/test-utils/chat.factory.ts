import { Factory } from 'fishery';
import { Chat } from './test-models';
import { insert } from './test-utils';

export const chatFactory = Factory.define<Chat>(({ sequence, onCreate }) => {
  onCreate((params) => insert<Chat>('chat', params));

  const now = new Date();
  return {
    id: sequence,
    title: `Chat title ${sequence}`,
    createdAt: now,
    updatedAt: now,
  };
});
