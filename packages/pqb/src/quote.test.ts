import { escapeForLog } from './quote';

describe('quote', () => {
  it('should escapeForLog different values', () => {
    expect(escapeForLog(123)).toBe('123');
    expect(escapeForLog(12345678901234567890n)).toBe('12345678901234567890');
    expect(escapeForLog('string')).toBe("'string'");
    expect(escapeForLog(`str'ing`)).toBe(`'str''ing'`);
    expect(escapeForLog(true)).toBe('true');
    expect(escapeForLog(false)).toBe('false');
    expect(escapeForLog(null)).toBe('NULL');
    expect(escapeForLog(undefined)).toBe('NULL');

    const now = new Date();
    expect(escapeForLog(now)).toBe(`'${now.toISOString()}'`);

    expect(escapeForLog({ key: `val'ue` })).toBe(`'{"key":"val''ue"}'`);

    expect(
      escapeForLog([
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
