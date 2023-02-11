import { change, clearChanges, getCurrentChanges } from './change';

describe('change', () => {
  const fn = async () => {};

  it('should push callback to currentChanges', () => {
    change(fn);
    expect(getCurrentChanges()).toEqual([fn]);
  });

  it('should clear changes', () => {
    getCurrentChanges().push(fn);
    clearChanges();
    expect(getCurrentChanges()).toEqual([]);
  });
});
