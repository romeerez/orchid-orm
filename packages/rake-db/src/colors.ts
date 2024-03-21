export const colors = {
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  bright: (s: string) => `\x1b[1m${s}\x1b[0m`,
  blueBold: (s: string) => `\x1b[1m\x1b[34m${s}\x1b[0m`,
  yellowBold: (s: string) => `\x1b[1m\x1b[33m${s}\x1b[0m`,
  greenBold: (s: string) => `\x1b[1m\x1b[32m${s}\x1b[0m`,
  pale: (s: string) => `\x1b[2m${s}\x1b[0m`,
};
