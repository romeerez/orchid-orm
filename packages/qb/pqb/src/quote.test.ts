import { quote } from './quote';

describe('quote', () => {
  it('should quote different values', () => {
    expect(quote(123)).toBe('123');
    expect(quote(12345678901234567890n)).toBe('12345678901234567890');
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
        12345678901234567890n,
        'string',
        'str"ing',
        `str'ing`,
        true,
        false,
        now,
        null,
        undefined,
        { key: `val'ue` },
        [1, 2, 'str"ing', `str'ing`],
        [
          [1, 2],
          [3, 4],
        ],
      ]),
    ).toBe(
      `ARRAY[1,12345678901234567890,'string','str"ing','str''ing',true,false,'${now.toISOString()}',NULL,NULL,'{"key":"val''ue"}',[1,2,'str"ing','str''ing'],[[1,2],[3,4]]]`,
    );
  });
});
