import { Factory } from 'fishery';
import { Message } from './test-models';
import { insert } from './test-utils';

export const messageFactory = Factory.define<Message>(
  ({ params, sequence, onCreate }) => {
    onCreate((params) => insert<Message>('message', params));

    if (!params.authorId || !params.chatId)
      throw new Error(`Required parameters are missing`);

    const now = new Date();
    return {
      id: sequence,
      chatId: params.chatId,
      authorId: params.authorId,
      text: `Message text ${sequence}`,
      createdAt: now,
      updatedAt: now,
    };
  },
);
