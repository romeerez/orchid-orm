export interface PostgresInterval {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

const intervalRegExp =
  /^\s*(?:([+-]?\d+)\s+years?)?\s*(?:([+-]?\d+)\s+mons?)?\s*(?:([+-]?\d+)\s+days?)?\s*(?:([+-])?(\d+):(\d\d):(\d\d(?:\.\d{1,6})?))?\s*$/;

export const parseInterval = (str: string): PostgresInterval => {
  const [, years, months, days, timeSign, hours, minutes, seconds] =
    intervalRegExp.exec(str) || [];
  const timeMultiplier = timeSign === '-' ? -1 : 1;
  const secondsFloat = Number(seconds) || 0;
  const wholeSeconds = Math.floor(secondsFloat);

  return {
    years: years ? Number(years) : 0,
    months: months ? Number(months) : 0,
    days: days ? Number(days) : 0,
    hours: hours ? timeMultiplier * Number(hours) : 0,
    minutes: minutes ? timeMultiplier * Number(minutes) : 0,
    seconds: timeMultiplier * wholeSeconds,
    milliseconds:
      Math.round(timeMultiplier * (secondsFloat - wholeSeconds) * 1000000) /
      1000,
  };
};
