import { colors } from './colors';

const ESC = '\x1B';
const CSI = `${ESC}[`;
const cursorShow = `${CSI}?25h`;
const cursorHide = `${CSI}?25l`;
const { stdin, stdout } = process;

const visibleChars = (s: string) =>
  s.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PRZcf-ntqry=><~]))/g,
    '',
  ).length;

const clear = (text: string) => {
  const rows = text
    .split(/\r?\n/)
    .reduce(
      (rows, line) =>
        rows +
        1 +
        Math.floor(Math.max(visibleChars(line) - 1, 0) / stdout.columns),
      0,
    );

  let clear = '';
  for (let i = 0; i < rows; i++) {
    clear += `${CSI}2K`;
    if (i < rows - 1) {
      clear += `${CSI}${i < rows - 1 ? '1A' : 'G'}`;
    }
  }
  return clear;
};

interface Ctx<T> {
  value: T;
  submitted: boolean;
  render: () => void;
  submit(value?: T): void;
}

const prompt = async <T>({
  render,
  onKeyPress,
  validate,
  value,
  cursor: showCursor,
}: {
  render(ctx: Ctx<T>): string;
  onKeyPress(ctx: Ctx<T>, s: string): void;
  validate?(ctx: Ctx<T>): boolean;
  value?: T;
  cursor?: boolean;
}): Promise<T> => {
  stdin.resume();
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.setEncoding('utf-8');

  if (!showCursor) stdout.write(cursorHide);

  return new Promise<T>((res) => {
    let prevText: string | undefined;

    const ctx: Ctx<T> = {
      value: value as T,
      submitted: false,
      render() {
        let text =
          (ctx.submitted ? colors.greenBold('✔') : colors.yellowBold('?')) +
          ' ' +
          render(ctx);

        if (ctx.submitted) text += '\n';

        stdout.write(prevText ? clear(prevText) + '\r' + text : text);

        prevText = text;
      },
      submit(value) {
        if (value !== undefined) ctx.value = value;
        if (ctx.value === undefined || (validate && !validate?.(ctx))) return;

        ctx.submitted = true;
        ctx.render();
        close();
        res(ctx.value);
      },
    };

    const close = () => {
      if (!showCursor) stdout.write(cursorShow);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.off('data', keypress);
      stdin.pause();
    };

    const keypress = (s: string) => {
      // ctrl-c, ctrl-d
      if (s === '\u0003' || s === '\u0004') {
        close?.();
        process.exit(0);
      }

      if (s === '\r' || s === '\n' || s === '\r\n') {
        ctx.submit();
      } else {
        onKeyPress(ctx, s);
      }
    };

    stdin.on('data', keypress);

    ctx.render();
  });
};

const defaultActive = (s: string) => `${colors.blueBold('❯')} ${s}`;
const defaultInactive = (s: string) => `  ${s}`;

export const promptSelect = ({
  message,
  options,
  active = defaultActive,
  inactive = defaultInactive,
}: {
  message: string;
  options: string[];
  active?: (s: string) => string;
  inactive?: (s: string) => string;
}) =>
  prompt<number>({
    value: 0,
    render(ctx) {
      let text = `${message} ${colors.pale(
        'Use arrows or jk. Press enter to submit.',
      )}\n`;

      for (let i = 0; i < options.length; i++) {
        text += (ctx.value === i ? active : inactive)(options[i]) + '\n';
      }

      return text;
    },
    onKeyPress(ctx, s) {
      ctx.value =
        s === '\u001b[H' // home
          ? 0
          : s === '\u001b[F' // end
          ? options.length - 1
          : s === '\u001b[A' || s === 'k' // up
          ? ctx.value === 0
            ? options.length - 1
            : ctx.value - 1
          : s === '\u001b[B' || s === 'j' || s === '\t' // down
          ? ctx.value === options.length - 1
            ? 0
            : ctx.value + 1
          : ctx.value;

      ctx.render();
    },
  });

export const promptConfirm = ({
  message,
}: {
  message: string;
  password?: boolean;
}) =>
  prompt<boolean>({
    value: true,
    render(ctx) {
      return `${colors.bright(message)}\n${
        ctx.submitted
          ? `> ${ctx.value ? colors.greenBold('Yes') : colors.yellowBold('No')}`
          : colors.pale(`> (Y/n)`)
      }\n`;
    },
    onKeyPress(ctx, s) {
      let ok;
      if (s === 'y' || s === 'Y') ok = true;
      else if (s === 'n' || s === 'N') ok = false;

      if (ok !== undefined) {
        ctx.submit(ok);
      }
    },
  });

export const promptText = ({
  message,
  default: def = '',
  password,
  min,
}: {
  message: string;
  default?: string;
  password?: boolean;
  min?: number;
}) => {
  let showDefault = true;
  let x = 0;

  const renderValue = (ctx: Ctx<string>) =>
    password ? '*'.repeat(ctx.value.length) : ctx.value;

  return prompt<string>({
    value: def,
    cursor: true,
    validate: (ctx) => !min || ctx.value.length >= min,
    render(ctx) {
      let text = `${colors.bright(message)}\n> ${
        ctx.submitted
          ? renderValue(ctx)
          : showDefault
          ? colors.pale(def) + '\b'.repeat(def.length)
          : ctx.value
      }`;

      if (ctx.submitted) text += '\n';

      return text;
    },
    onKeyPress(ctx, s) {
      let value = showDefault ? '' : ctx.value;
      if (s === '\u001b[D' && x > 0) {
        // left
        x--;
        stdout.write('\b');
      } else if (s === '\u001b[C' && x < value.length) {
        // right
        stdout.write(value[x]);
        x++;
      }

      if (s !== '' && s !== '\u001b[3~' && !visibleChars(s)) return;

      if (showDefault) {
        showDefault = false;
        stdout.write(' '.repeat(def.length) + '\b'.repeat(def.length));
      }

      const prev = value;
      const prevX = x;

      if (s === '') {
        if (x > 0) {
          value = value.slice(0, x - 1) + value.slice(x);
          x--;
        }
      } else if (s === '\u001b[3~') {
        if (x < value.length) {
          value = value.slice(0, x) + value.slice(x + 1);
        }
      } else {
        value = value.slice(0, x) + s + value.slice(x);
        x++;
      }

      ctx.value = value;

      const spaces = prev.length - value.length;
      stdout.write(
        '\b'.repeat(prevX) +
          renderValue(ctx) +
          (spaces > 0 ? ' '.repeat(spaces) + '\b'.repeat(spaces) : '') +
          '\b'.repeat(value.length - x),
      );
    },
  });
};
