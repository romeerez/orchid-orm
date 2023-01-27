import { quote } from './quote';

describe('quote', () => {
  it('should quote different values', () => {
    expect(quote(123)).toBe('123');
    expect(quote('string')).toBe("'string'");
    expect(quote(`str'ing`)).toBe(`'str''ing'`);
    expect(quote(true)).toBe('true');
    expect(quote(false)).toBe('false');
    expect(quote(null)).toBe('NULL');
    expect(quote(undefined)).toBe('NULL');

    const now = new Date();
    expect(quote(now)).toBe(`'${now.toISOString()}'`);

    expect(quote({ key: `val'ue` })).toBe(`'{"key":"val''ue"}'`);

    expect(
      quote([
        1,
        'string',
        'str"ing',
        `str'ing`,
        true,
        false,
        now,
        null,
        undefined,
        { key: `val'ue` },
      ]),
    ).toBe(
      `'{1,"string","str\\"ing","str''ing",true,false,"${now.toISOString()}",NULL,NULL,"{\\"key\\":\\"val''ue\\"}"}'`,
    );
  });
});
