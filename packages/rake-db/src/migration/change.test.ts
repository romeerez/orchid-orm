import { clearChanges, getCurrentChanges, pushChange } from './change';

describe('change', () => {
  it('should push, get and clear changes', () => {
    pushChange({ fn: async () => {}, config: {} as never });
    expect(getCurrentChanges().length).toBe(1);
    clearChanges();
    expect(getCurrentChanges().length).toBe(0);
  });
});
