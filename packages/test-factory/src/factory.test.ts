import { createFactory } from './factory';
import { assertType, db, User, useTestDatabase } from './test-utils';
import { z } from 'zod';

describe('factory', () => {
  useTestDatabase();

  const userFactory = createFactory(db.user);

  describe('build', () => {
    it('should build an object for the model', () => {
      const data = userFactory.build();

      assertType<typeof data, User>();

      expect(() => userFactory.schema.parse(data)).not.toThrow();
    });

    it('should accept data with values to override result', () => {
      const data = userFactory.build({
        age: 18,
        name: 'name',
        extra: true,
      });

      assertType<
        typeof data,
        User & { name: 'name'; age: 18; extra: boolean }
      >();

      expect(data).toMatchObject({ age: 18, name: 'name', extra: true });
    });

    it('should accept data with functions to override result', () => {
      const data = userFactory.build({
        age: () => 18,
        name: () => 'name',
        extra: () => true,
      });

      assertType<typeof data, User & { age: number; extra: true }>();

      expect(data).toMatchObject({ age: 18, name: 'name', extra: true });
    });
  });

  describe('buildList', () => {
    const original = userFactory.build;
    const buildMock = jest.fn();

    beforeAll(() => {
      userFactory.build = buildMock;
    });

    afterAll(() => {
      userFactory.build = original;
    });

    it('should call build provided number of times, pass the argument, return array', () => {
      const arg = { extra: true };
      const arr = userFactory.buildList(3, arg);

      assertType<typeof arr, (User & { extra: boolean })[]>();

      expect(buildMock).toHaveBeenCalledTimes(3);
      expect(buildMock).toHaveBeenCalledWith(arg);
    });
  });

  describe('omit', () => {
    it('should allow to build data with omitted fields', () => {
      const data = userFactory.omit({ id: true, name: true }).build();

      assertType<typeof data, Omit<User, 'id' | 'name'>>();

      expect(() =>
        userFactory.schema.strict().omit({ id: true, name: true }).parse(data),
      ).not.toThrow();
    });
  });

  describe('pick', () => {
    it('should allow to build data with picked fields', () => {
      const data = userFactory.pick({ id: true, name: true }).build();

      assertType<typeof data, Pick<User, 'id' | 'name'>>();

      expect(() =>
        userFactory.schema.strict().pick({ id: true, name: true }).parse(data),
      ).not.toThrow();
    });
  });

  describe('create', () => {
    it('should create record with generated data, except serial primary keys', async () => {
      const item = await userFactory.create();

      assertType<typeof item, User>();

      expect(() => userFactory.schema.parse(item)).not.toThrow();
    });

    it('should create record with overridden data', async () => {
      const item = await userFactory.create({ name: 'name' });

      assertType<typeof item, User>();

      expect(item.name).toBe('name');
    });

    it('should create record with nested create', async () => {
      const user = await userFactory.create({
        profile: {
          create: {
            bio: 'bio',
          },
        },
      });

      assertType<typeof user, User>();
    });
  });

  describe('createList', () => {
    it('should create a list of records', async () => {
      const items = await userFactory.createList(2);

      assertType<typeof items, User[]>();

      expect(() => z.array(userFactory.schema).parse(items)).not.toThrow();
    });

    it('should create a list of records with overridden data', async () => {
      const items = await userFactory.createList(2, { name: 'name' });

      assertType<typeof items, User[]>();

      expect(items.map((item) => item.name)).toEqual(['name', 'name']);
    });
  });

  describe('set', () => {
    it('should set data to override result and work with build', () => {
      const data = userFactory
        .set({
          age: 18,
        })
        .build({
          name: 'name',
        });

      assertType<typeof data, User & { age: number; name: 'name' }>();

      expect(data).toMatchObject({ age: 18, name: 'name' });
    });

    it('should set data to override result and work with buildList', () => {
      const arr = userFactory
        .set({
          age: 18,
        })
        .buildList(2, {
          name: 'name',
        });

      assertType<typeof arr, (User & { age: number; name: 'name' })[]>();
    });

    it('should set data to override result and work with create', async () => {
      const item = await userFactory.set({ age: 18 }).create();

      assertType<typeof item, User>();

      expect(() => userFactory.schema.parse(item)).not.toThrow();
      expect(item.age).toBe(18);
    });

    it('should set data to override result and work with createList', async () => {
      const items = await userFactory.set({ age: 18 }).createList(2);

      assertType<typeof items, User[]>();

      expect(() => z.array(userFactory.schema).parse(items)).not.toThrow();
      expect(items.map((item) => item.age)).toEqual([18, 18]);
    });
  });

  describe('custom methods', () => {
    class ExtendedFactory extends createFactory(db.user).extend() {
      specificUser(age: number) {
        return this.otherMethod().set({
          age,
          name: 'specific',
        });
      }
      otherMethod() {
        return this.set({ extra: true });
      }
    }

    const extendedFactory = new ExtendedFactory();

    it('should respect omitted fields and build a proper object', async () => {
      const data = extendedFactory.omit({ id: true }).specificUser(42).build();

      assertType<
        typeof data,
        Omit<User, 'id'> & { age: number; extra: boolean }
      >();

      expect(data).toMatchObject({ age: 42, name: 'specific', extra: true });
    });

    it('should respect picked fields and build a proper object', async () => {
      const data = extendedFactory
        .pick({ age: true, name: true })
        .specificUser(42)
        .build();

      assertType<typeof data, Pick<User, 'name'> & { age: number }>();

      expect(data).toEqual({ age: 42, name: 'specific' });
    });
  });
});
