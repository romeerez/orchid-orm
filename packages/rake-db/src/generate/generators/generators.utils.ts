import { promptSelect } from '../../prompt';
import { colors } from '../../colors';

export const promptCreateOrRename = (
  kind: string,
  name: string,
  drop: string[],
): Promise<number> => {
  let max = 0;
  const add = name.length + 3;
  for (const name of drop) {
    if (name.length + add > max) {
      max = name.length + add;
    }
  }

  const renameMessage = `rename ${name}`;

  return promptSelect({
    message: `Create or rename ${colors.blueBold(
      name,
    )} ${kind} from another ${kind}?`,
    options: [
      `${colors.greenBold('+')} ${name} ${colors
        .pale('create name')
        .padStart(max + renameMessage.length - name.length, ' ')}`,
      ...drop.map(
        (d) =>
          `${colors.yellowBold('~')} ${d} ${colors.yellowBold(
            '>',
          )} ${name} ${colors
            .pale(renameMessage)
            .padStart(max + renameMessage.length - d.length - add, ' ')}`,
      ),
    ],
  });
};
