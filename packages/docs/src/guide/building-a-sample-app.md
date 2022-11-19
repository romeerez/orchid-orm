# Building a sample app

In this section, we will walk through the process of creating of API server.
Here you can get an overall idea of how `Orchid ORM` looks and feels,
what problem it solves, and see the benefits and possible drawbacks.

Feel free to skip it, or briefly scroll it, as it turned out to be embarrassingly long.
Still, it can be useful to peek how one or another case can be handled with `Orchid ORM`.

We are going to build an API for a blog site with users, articles, and tags, users can follow each other.
It is inspired by [realworld](https://github.com/gothinkster/realworld) API spec.

Full code is available [here](https://github.com/romeerez/orchid-orm-examples/tree/main/packages/blog-api).

## API routes

- **POST** `/users`: register new user
    * JSON payload:
        - **username**: string
        - **email**: string
        - **password**: string
    * Responds with user object and auth token

- **POST** `/users/auth`: login
    * JSON payload:
        - **email**: string
        - **password**: string
    * Responds with user object and auth token

- **POST** `/users/:username/follow`: follow a user
    * No payload and no response needed

- **DELETE** `/users/:username/follow`: unfollow a user
    * No payload and no response needed

- **GET** `/articles`: get a list of articles
    * URI params:
        - **author**: filter articles by the username of the author
        - **tag**: filter articles by tag
        - **feed**: list articles only from authors which the current user is following
        - **favorite**: list only articles favorited by the current user
        - **limit**: limit articles
        - **offset**: offset articles
    * Responds with article data

- **POST** `/articles`: create a new article
    * JSON payload:
        - **slug**: string
        - **title**: string
        - **body**: string
        - **tags**: array of strings
    * Responds with article data

- **PATCH** `/articles/:slug`: update article
    * JSON payload:
        - **slug**?: string
        - **title**?: string
        - **body**?: string
        - **tags**?: array of strings
    * Responds with article data

- **POST** `/articles/:slug/favorite`
    * JSON payload:
        - **favorite**: true to make favorite, false to un-favorite the article
    * No response is needed

- **DELETE** `/articles/:slug`: delete article
    * No response is needed

Register and login responses should be of the following type:

```ts
type AuthResponse = {
  user: {
    id: number
    username: string
    email: string
  }
  token: string
}
```

```ts
type ArticleResponse = {
  slug: string
  title: string
  body: string
  // how much users have favorited this article
  favoritesCount: number
  // whether requesting user has favorited this article
  favorited: boolean
  tags: string[]
  author: {
    username: string
    // following means if the user who performs the request is following this user
    following: boolean
  }
  
  // Postgres is returning dates in such format: `2022-11-04 10:53:02.129306 +00:00`
  // but this format is not supported by all browsers
  // As a bonus, both transferring and parsing date as an epoch number is more efficient, so let's use numbers for dates:
  createdAt: number
  udpatedAt: number
}
```

## initialize the project

Let's init the project:

```sh
mkdir blog-api
cd blog-api
npm init
git init .
mkdir src
```

Add a .gitignore:

```text
node_modules

# local environment variables
.env.local
```

The first thing we need in every node.js project is a TypeScript:

```sh
npm i -D typescript @types/node
```

The second thing to add in every node.js project is eslint with prettier, it takes quite a long list of dependencies and few file changes, check this [commit](https://github.com/romeerez/orchid-orm-examples/commit/5824fbdb334093154a41bb2104904cf6d2b6e6b1) for an example configuration.

We won't get stuck here on the topic of configuring the server and test framework, here is a [commit](https://github.com/romeerez/orchid-orm-examples/commit/785511c77eb2376c46930c19ca5ccde798d3f8c1) for sample server configuration, and here is [commit](https://github.com/romeerez/orchid-orm-examples/commit/37decfa0e4ba676b7dd38ef0c34cd09b3d5150b4) for configuring tests.

For the sample application, I chose [fastify](https://www.fastify.io/) as a server framework
because it is easier to set up (async error handling out of the box, unlike express),
has more concise syntax for routes, and it includes a very nice utility for testing out of the box.
Of course, you can use `Orchid ORM` with your favorite framework.

## setup Orchid ORM

Install `Orchid ORM` dependencies:

```sh
npm i orchid-orm pqb orchid-orm-schema-to-zod
# dev dependencies:
npm i -D rake-db orchid-orm-test-factory
```

See details for each dependency in a [Quickstart](/guide/quickstart).

Let's also install an additional tool for tests, it will wrap each test in a transaction, so we won't have to clean the db manually:

```sh
npm i -D pg pg-transactional-tests
```

Place database URLs to .env.local file (which should be listed in .gitignore), one database for development and a second for tests:

```text
DATABASE_URL=postgres://user:password@localhost:5432/blog-api
DATABASE_URL_TEST=postgres://user:password@localhost:5432/blog-api-test
```

Load these variables in the app,
this is a good practice to validate variables so our team members can see if something is missing,
we can use `zod` for validation:

```ts
// src/config.ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const env = z
  .object({
    PORT: z.number().default(3000),
    NODE_ENV: z
      .literal('development')
      .or(z.literal('production'))
      .or(z.literal('test'))
      .default('development'),
    DATABASE_URL: z.string(),
    // DATABASE_URL_TEST is optional because production may not have it
    DATABASE_URL_TEST: z.string().optional(),
  })
  .parse(process.env);

export const config = {
  ...env,
  currentDatabaseUrl:
    env.NODE_ENV === 'test' ? env.DATABASE_URL_TEST : env.DATABASE_URL,
};
```

Now, `config` has `DATABASE_URL` for the dev database, `DATABASE_URL_TEST` for the test database,
and `currentDatabaseUrl` with the database for the current environment.

Create the main file for the database instance:

```ts
// src/db.ts
import { orchid-orm } from 'orchid-orm';
import { config } from './config';

export const db = orchid-orm(
  {
    connectionString: config.currentDatabaseUrl,
    log: true,
  },
  {
    // models will be listed here
  }
);
```

Define a base `Model` class which will be used later to extend models from.

By default, timestamps are returned as strings, the same as when loading timestamps from databases directly.

For this API let's agree to return timestamps as epoch numbers (it's efficient and simple to use),
but if you prefer to deal with `Date` objects write `columnTypes.timestamp().asDate()` instead.

```ts
// src/lib/model.ts
import { createModel } from 'orchid-orm';
import { columnTypes } from 'pqb';

export const Model = createModel({
  columnTypes: {
    ...columnTypes,
    timestamp: () => columnTypes.timestamp().asNumber(),
  },
});
```

Create a script that we will use from a terminal to generate and run migrations:

```ts
// src/scripts/db.ts
import path from 'path';
import { rakeDb } from 'rake-db';
import { config } from '../config';

const migrationsPath = path.resolve(__dirname, '..', 'migrations');

const options = [{ connectionString: config.DATABASE_URL }];

// when running in production we don't need to test the database
if (config.NODE_ENV !== 'production') {
  const url = config.DATABASE_URL_TEST;
  if (!url) {
    throw new Error('DATABASE_URL_TEST env variable is missing');
  }
  options.push({ connectionString: url });
}

// pass options and migrationPath to `rakeDb`
rakeDb(options, { migrationsPath });
```

Add it to `package.json` scripts section:

```json
{
  "scripts": {
    "db": "ts-node src/scripts/db.ts"
  }
}
```

Now we can create databases from the command line:

```sh
npm run db create
```

If the database user specified in `.env.local` is not a superuser, this command will ask for a superuser username/password to create databases.

After successfully running it will print:

```text
Database blog-api successfully created
Created versions table
Database blog-api-test successfully created
Created versions table
```

So we can see it created two databases.
Each of them has a special table to track which migrations were already applied and which were not.

Add a `jest-setup.ts` to the root of the project.
This will make every test case that makes db queries wrapped in a transaction with rollback,
so every change will seamlessly disappear.

```ts
import {
  patchPgForTransactions,
  startTransaction,
  rollbackTransaction,
} from 'pg-transactional-tests';
import { db } from './src/db';

patchPgForTransactions();

beforeAll(startTransaction);
beforeEach(startTransaction);
afterEach(rollbackTransaction);
afterAll(async () => {
  await rollbackTransaction();
  await db.$close();
});
```

Add it to `package.json` "jest" section:

```json
{
  "jest": {
    "setupFilesAfterEnv": [
      "./jest-setup.ts"
    ]
  }
}
```

## user endpoints

Let's begin by writing a user model.
Every model must have a table name and a set of columns.

Usually, each model should have a primary key column.
We will use `t.serial().primaryKey()` for this purpose, it is an autoincrementing integer type.
Another available option for primary keys is to use `t.uuid().primaryKey()`.

It is a good idea to have `createdAt` and `updatedAt` columns in every model, even if it is not asked in the requirements,
these columns may come in handy later, for displaying, and sorting by them, `updatedAt` may be used for cache invalidation.
Add them to the model by writing: `...t.timestamps()`.

Each column has a type, which is used to get a TypeScript type and a database type when running a migration.
Some column methods have an effect only in migration, some methods are for validation.

## writing a model

```ts
// src/app/user/user.model.ts
import { Model } from '../../lib/model';
import { modelToZod } from 'orchid-orm-schema-to-zod';

export class UserModel extends Model {
  // specify a database table name:
  table = 'user';
  
  // specify a set of columns:
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    username: t.text().unique().min(3).max(30),
    email: t.text().unique().email().max(100),
    password: t.text().min(8).max(100),
    // add `createdAt` and `updatedAt` timestamps
    ...t.timestamps(),
  }));
}

// will be used later to validate the parameters
export const userSchema = modelToZod(UserModel);
```

Consider the `email` column:

```ts
t.text() // this is a column type
  .unique() // has effect only in migration
  .email() // validates email
```

After defining a model, place it into the `db` models list:

```ts
// src/db.ts
import { orchid-orm } from 'orchid-orm';
import { config } from './config';
import { UserModel } from './app/user/user.model';

export const db = orchid-orm(
  {
    connectionString: config.currentDatabaseUrl,
    log: true,
  },
  {
    user: UserModel,
  }
);
```

Now `user` is defined on `db`, we can write queries like `db.user.count()`, `db.user.select(...)`, and many others.

Define a test factory that we will use very soon:

```ts
// src/lib/test/testFactories.ts
import { createFactory } from 'orchid-orm-test-factory';
import { db } from '../../db';

export const userFactory = createFactory(db.user);
```

## add migration

Generate a new migration file by running:

```sh
npm run db g createUser
```

In the newly added file we can see such content:

```ts
// src/migrations/*timestamp*_createUser.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('user', (t) => ({
  }));
});
```

Now simply copy-paste columns from your UserModel to this migration:

```ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('user', (t) => ({
    id: t.serial().primaryKey(),
    username: t.text().unique().min(3).max(30),
    email: t.text().unique().email().max(100),
    password: t.text().min(8).max(100),
    ...t.timestamps(),
  }));
});
```

Note that `min`, `max`, and `email` have no effect on the migration, these methods are only for validation that we will use later.

`Orchid ORM` will probably gain a feature of auto-generated migrations in the future, but for now, they are written manually.

## writing tests for registering user endpoint

Let's write tests for the first endpoint `POST /users`:

```ts
// src/app/user/user.controller.test.ts
import { testRequest } from '../../lib/test/testRequest';
import { userFactory } from '../../lib/test/testFactories';
import { db } from '../../db';

describe('user controller', () => {
  describe('POST /users', () => {
    // pick params to use for this request
    const params = userFactory.pick({
      username: true,
      email: true,
      password: true,
    });

    it('should register a new user, save it with hashed password, return a user and a token', async () => {
      // build an object with randomly generated data
      const data = params.build();

      // perform a POST request to the /users endpoint with the data
      const res = await testRequest.post('/users', data);

      // ensure that response has a correct data
      const json = res.json()
      expect(json).toMatchObject({
        user: {
          username: data.username,
          email: data.email,
        },
        token: expect.any(String),
      });

      // check that the user was saved to the database with the correct fields
      const savedUser = await db.user.findBy({ username: data.username });
      expect(savedUser).toMatchObject({
        username: data.username,
        email: data.email,
      });

      // ensure that we don't store plain text passwords to the database
      expect(savedUser.password).not.toBe(data.password);
    });

    it('should return error when username is taken', async () => {
      // build new randomly generated params
      const data = params.build();
      // create a new user with this specific username
      await userFactory.create({ username: data.username });

      // perform request
      const res = await testRequest.post('/users', data);

      // expect error because a user with such username was created before the request
      expect(res.json()).toMatchObject({
        message: 'Username is already taken',
      });
    });

    // similar to username test
    it('should return error when email is taken', async () => {
      const data = params.build();
      await userFactory.create({ email: data.email });

      const res = await testRequest.post('/users', data);

      expect(res.json()).toMatchObject({
        message: 'Email is already taken',
      });
    });
  });
});
```

`testRequest` is a custom helper around `app.inject` from fastify to perform a fake request without the app running.

`express` doesn't have such tools and can be tested with real requests, it's recommended to use `axios` for this purpose.

We can freely create database records thanks to `pg-transactional-tests` which was configured earlier in a `jest-setup.ts`.

## register user endpoint

On real projects, the auth will be more sophisticated, but for demo purposes, let's do a simple token-based auth.

Add `JWT_SECRET` to the `.env` file and `config.ts`:

```ts
// src/config.ts

const env = z
  .object({
    // ...snip
    JWT_SECRET: z.string(),
  })

```

Here are utility functions for JSON web tokens:

```ts
// src/lib/jwt.ts
import { JwtPayload, sign, verify } from 'jsonwebtoken';
import { config } from '../config';

export const createToken = ({ id }: { id: number }): string => {
  return sign({ id }, config.JWT_SECRET);
};

export const verifyToken = (token: string): string | JwtPayload => {
  return verify(token, config.JWT_SECRET);
};
```

Utility functions for hashing and comparing passwords:

```ts
// src/lib/password.ts
import { genSalt, hash, compare } from 'bcrypt';

export const encryptPassword = async (password: string): Promise<string> => {
  const salt = await genSalt(10);
  return await hash(password, salt);
};

export const comparePassword = async (
  password: string,
  encrypted: string
): Promise<boolean> => {
  return await compare(password, encrypted);
};
```

Now that we have `verifyToken` and `comparePassword`, we can use them in the test to check the token and the password:

```ts
it('should register a new user, save it with hashed password, return a user and a token', async () => {
  // ...snip
  
  expect(verifyToken(json.token)).toMatchObject({ id: savedUser.id });
  
  expect(comparePassword(data.password, savedUser.password));
})
```

Every node.js framework and even specific project usually have own custom way of validating request parameters,
some people use middleware for this, and some use decorators like in the `Nest.js` framework.
No matter how it is implemented, it should serve the purposes of:

- request query, body, and route params must be validated properly
- validated query, body, and params should have proper types
- it is nice to have response validation in the dev/test environment, so you won't leak sensitive data by accident, and no need to write tedious tests for this

Usually, out-of-the-box validation utility fails to satisfy all 3 points,
I'm using a custom utility `routeHandler` to validate parameters and results by using `zod` schemas, [here is the source](link to routeHandler).

From our API spec, we can see that both the registration and login endpoint returns the same shape of data: user object and token,
and it makes sense to reuse the response validator for them. Let's place it in the `user.dto.ts` file (dto stands for Data Transfer Object):

```ts
// src/user/user.dto.ts
import { z } from 'zod';
import { userSchema } from './user.model';

export const authDto = z.object({
  user: userSchema.pick({
    id: true,
    username: true,
    email: true,
  }),
  token: z.string(),
});
```

And, finally, we can write the registering endpoint itself:

```ts
// src/app/user/user.controller.ts

import { routeHandler } from '../../lib/routeHandler';
import { db } from '../../db';
import { encryptPassword } from '../../lib/password';
import { createToken } from '../../lib/jwt';
import { userSchema } from './user.model';
import { ApiError } from '../../lib/errors';
import { authDto } from './user.dto';

export const registerUserRoute = routeHandler(
  {
    body: userSchema.pick({
      username: true,
      email: true,
      password: true,
    }),
    result: authDto,
  },
  async (req) => {
    try {
      const user = await db.user.select('id', 'email', 'username').create({
        ...req.body,
        password: await encryptPassword(req.body.password),
      });

      return {
        user,
        token: createToken({ id: user.id }),
      };
    } catch (err) {
      if (err instanceof db.user.error && err.isUnique) {
        if (err.columns.username) {
          throw new ApiError('Username is already taken');
        }
        if (err.columns.email) {
          throw new ApiError('Email is already taken');
        }
      }
      throw err;
    }
  }
);
```

Consider the code for creating a user:

```ts
const user = await db.user.select('username', 'email').create({
  ...req.body,
  password: await encryptPassword(req.body.password),
});
```

`select` before `create` changes `RETURNING` SQL statement, if we use `create` without `select` it will return a full record.

It is safe to use `...req.body` because `body` was validated and all unknown keys were stripped out of it.

Inside of error handler, first, we check `err instanceof db.user.error` to know if this error belongs to the user model,
then we check `err.isUnique` to ensure this is a unique violation error.
And then we check `err.columns.username` and `err.columns.email` to determine which column has failed uniqueness to throw the corresponding error.

Add the route function to the router:

```ts
// src/routes.ts
import { FastifyInstance } from 'fastify';
import * as user from './app/user/user.controller';

export const routes = async (app: FastifyInstance) => {
  app.post('/users', user.registerUserRoute);
};
```

I'm skipping some framework-specific details: how to configure a server, and configure routing, this depends on the framework and your preferences.

## login endpoint

Add corresponding tests:

```ts
// src/app/user/user.controller.test.ts

describe('user controller', () => {
  // ...snip

  describe('POST /users/auth', () => {
    it('should authorize user, return user object and auth token', async () => {
      const password = 'password';
      const user = await userFactory.create({
        password: await encryptPassword(password),
      });

      const res = await testRequest.post('/users/auth', {
        email: user.email,
        password,
      });

      const json = res.json();
      expect(json).toMatchObject({
        user: {
          username: user.username,
          email: user.email,
        },
        token: expect.any(String),
      });

      expect(verifyToken(json.token)).toMatchObject({ id: user.id });
    });

    it('should return error when email is not registered', async () => {
      const res = await testRequest.post('/users/auth', {
        email: 'not-registered@test.com',
        password: 'password',
      });

      expect(res.json()).toMatchObject({
        message: 'Email or password is invalid',
      });
    });

    it('should return error when password is invalid', async () => {
      const user = await userFactory.create();

      const res = await testRequest.post('/users/auth', {
        email: user.email,
        password: 'invalid password',
      });

      expect(res.json()).toMatchObject({
        message: 'Email or password is invalid',
      });
    });
  });
});
```

Controller code:

```ts
// src/app/user/user.controller.ts

export const loginUser = routeHandler(
  {
    body: userSchema.pick({
      email: true,
      password: true,
    }),
    result: authDto,
  },
  async (req) => {
    const user = await db.user
      .select('id', 'email', 'username', 'password')
      .findByOptional({
        email: req.body.email,
      });

    if (!user || !(await comparePassword(req.body.password, user.password))) {
      throw new ApiError('Email or password is invalid');
    }

    return {
      // omit is an utility defined somewhere else
      user: omit(user, 'password'),
      token: createToken({ id: user.id }),
    };
  }
);
```

In the user query note that we use `findByOptional` method, which returns `undefined` when not found.

There is a similar `findBy` method that would throw a `NotFoundError` when not found, but here we want to check it manually.

Add the route function to the router:

```ts
// src/routes.ts
import { FastifyInstance } from 'fastify';
import * as user from './app/user/user.controller';

export const routes = async (app: FastifyInstance) => {
  app.post('/users', user.registerUserRoute);
  app.post('/users/auth', user.loginUserRoute);
};
```

## follow and unfollow

Add a new model `UserFollow`:

```ts
// src/app/user/userFollow.model.ts
import { Model } from '../../lib/model';
import { UserModel } from './user.model';

export class UserFollowModel extends Model {
  table = 'userFollow';
  columns = this.setColumns((t) => ({
    followingId: t.integer().foreignKey(() => UserModel, 'id'),
    followerId: t.integer().foreignKey(() => UserModel, 'id'),
    ...t.primaryKey(['followingId', 'followerId']),
  }));
}
```

This model has `followingId` for the user who is being followed, and the `followerId` for the one who follows.
Both these columns have `foreignKey` which connects it with an `id` of `UserModel` to ensure that the value always points to an existing user record.

With such syntax `...t.primaryKey([column1, column2])` we define a composite primary key.
Internally Postgres will add a multi-column unique index and ensure that all of these columns are not null.

Add this model to the list of models in db:

```ts
// src/db.ts
// ...snip
import { UserFollowModel } from './app/user/userFollow.model';

export const db = orchid-orm(
  // ...snip
  {
    userFollow: UserFollowModel,
  }
);
```

Add a migration:

```sh
npm run db g createUserFollow
```

```ts
// src/migrations/*timestamp*_createUserFollow.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('userFollow', (t) => ({
    followingId: t.integer().foreignKey('user', 'id'),
    followerId: t.integer().foreignKey('user', 'id'),
    ...t.primaryKey(['followingId', 'followerId']),
  }));
});
```

Adding `followers` and `followings` relations to the user model:

```ts
// src/app/user/user.model.ts
import { UserFollowModel } from './userFollow.model';

export class UserModel extends Model {
  // ...snip
  
  relations = {
    follows: this.hasMany(() => UserFollowModel, {
      primaryKey: 'id',
      foreignKey: 'followingId',
    }),

    followings: this.hasMany(() => UserFollowModel, {
      primaryKey: 'id',
      foreignKey: 'followerId',
    }),
  };
}
```

Tests for the follow/unfollow endpoints:

```ts
// src/app/user/user.controller.test.ts

  describe('POST /users/:username/follow', () => {
    it('should follow a user', async () => {
      // create a user to perform the request from
      const currentUser = await userFactory.create();
      // create a user to follow
      const userToFollow = await userFactory.create();

      // perform request as a provided user
      await testRequest
        .as(currentUser)
        .post(`/users/${userToFollow.username}/follow`);

      
      // check that the userFollow record exists in the database
      const follows = await db.userFollow.where({
        followingId: userToFollow.id,
      });
      expect(follows).toEqual([
        {
          followerId: currentUser.id,
          followingId: userToFollow.id,
        },
      ]);
    });

    it('should return not found error when no user found by username', async () => {
      const currentUser = await userFactory.create();

      const res = await testRequest
        .as(currentUser)
        .post(`/users/lalala/follow`);

      expect(res.json()).toEqual({
        message: 'Record is not found',
      });
    });
  });

  describe('DELETE /users/:username/follow', () => {
    it('should unfollow a user', async () => {
      const currentUser = await userFactory.create();
      const userToFollow = await userFactory.create({
        follows: { create: [{ followerId: currentUser.id }] },
      });

      await testRequest
        .as(currentUser)
        .delete(`/users/${userToFollow.username}/follow`);

      const follows = await db.userFollow.where({
        followingId: userToFollow.id,
      });
      expect(follows).toEqual([]);
    });

    it('should return not found error when no user found by username', async () => {
      const currentUser = await userFactory.create();

      const res = await testRequest
        .as(currentUser)
        .post(`/users/lalala/follow`);

      // check that such userFollow record doesn't exist
      const exists = await db.userFollow
        .where({
          followingId: userToFollow.id,
        })
        .exists();
      expect(exists).toEqual(false);
    });
  });
```

Follow user controller:

```ts
// src/app/user/user.controller.ts

export const followUserRoute = routeHandler(
  {
    params: userSchema.pick({
      username: true,
    }),
  },
  async (req) => {
    const userId = getCurrentUserId(req);

    await db.user
      .findBy({
        username: req.params.username,
      })
      .follows.create({
        followerId: userId,
      });
  }
);
```

`getCurrentUserId` is a function to get the user id from the `JWT` token, leaving it beyond this tutorial, here is its [source](link to the user.service).

After defining the `follows` relation in the user model, `db.user` receives a `follows` property which allows doing different queries, and the code above shows the use of such chained `create` method.

If there is a need to do multiple queries it will wrap them in a transaction to prevent unexpected race conditions.

`Orchid ORM` strives to perform as few queries as possible to gain the maximum performance, and in this case, it does a single `INSERT ... SELECT ...` query, so it inserts `userFollow` from selecting the `user` record to use user id.

The `findBy` method will throw `NotFoundError` in case the record is not found, add a such section to the global error handler of your app to report such errors to the user:

```ts
if (error instanceof NotFoundError) {
  res.status(404).send({
    message: 'Record is not found',
  });
}
```

Unfollow user controller:

```ts
// src/app/user/user.controller.ts

export const unfollowUserRoute = routeHandler(
  {
    params: userSchema.pick({
      username: true,
    }),
  },
  async (req) => {
    const userId = getCurrentUserId(req);

    await db.user
      .findBy({
        username: req.params.username,
      })
      .follows.findBy({
        followerId: userId,
      })
      .delete();
  }
);
```

Similarly to the code in follow controller, this code building query to delete `userFollow`.

`Orchid ORM` will perform one `DELETE` query by this code.

Add route functions to the router:

```ts
// src/routes.ts
import { FastifyInstance } from 'fastify';
import * as user from './app/user/user.controller';

export const routes = async (app: FastifyInstance) => {
  // ...snip
  app.post('/users/:username/follow', user.followUserRoute);
  app.delete('/users/:username/follow', user.unfollowUserRoute);
};
```

## article related models

Create migration files:

```sh
npm run db g createArticle
npm run db g createTag
npm run db g createArticleTag
npm run db g createArticleFavorite
```

Article table migration:

```ts
// src/migrations/*timestamp*_createArticle.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('article', (t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer().foreignKey('user', 'id').index(),
    slug: t.text().unique(),
    title: t.text(),
    body: t.text(),
    favoritesCount: t.integer(),
    ...t.timestamps(),
  }));
});
```

Tag table migration:

```ts
// src/migrations/*timestamp*_createTag.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('tag', (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    ...t.timestamps(),
  }));
});
```

Article tag join table migration:

```ts
// src/migrations/*timestamp*_createArticleTag.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('articleTag', (t) => ({
    articleId: t.integer().foreignKey('article', 'id'),
    tagId: t.integer().foreignKey('tag', 'id'),
    ...t.primaryKey(['tagId', 'articleId']),
  }));
});
```

Article favorite join table migration:

```ts
// src/migrations/*timestamp*_createArticleFavorite.ts
import { change } from 'rake-db';

change(async (db) => {
  await db.createTable('articleFavorite', (t) => ({
    userId: t.integer().foreignKey('user', 'id'),
    articleId: t.integer().foreignKey('article', 'id'),
    ...t.primaryKey(['userId', 'articleId']),
  }));
});
```

Run migrations:

```sh
npm run db migrate
```

Model files can be added in any order, and you can first define all models and later define their relations.

Tag model:

```ts
// src/app/tag/tag.model.ts
import { Model } from '../../lib/model';
import { modelToZod } from 'orchid-orm-schema-to-zod';
import { ArticleTagModel } from './articleTag.model';

export class TagModel extends Model {
  table = 'tag';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    name: t.text().min(3).max(20),
    ...t.timestamps(),
  }));

  relations = {
    articleTags: this.hasMany(() => ArticleTagModel, {
      primaryKey: 'id',
      foreignKey: 'tagId',
    }),
  };
}

export const tagSchema = modelToZod(TagModel);
```

The tag model has no relations in the example above, but only because they're not needed in future queries.
`Orchid ORM` is designed to deal with circular dependencies without problems,
so `TagModel` can use `ArticleModel` in the relation, and `ArticleModel` can have `TagModel` in the relation at the same time.

Article tag model:

```ts
// src/app/article/articleTag.model.ts
import { Model } from '../../lib/model';
import { TagModel } from '../tag/tag.model';

export class ArticleTagModel extends Model {
  table = 'articleTag';
  columns = this.setColumns((t) => ({
    articleId: t.integer().foreignKey('article', 'id'),
    tagId: t.integer().foreignKey('tag', 'id'),
    ...t.primaryKey(['tagId', 'articleId']),
  }));

  relations = {
    // this `tag` relation name is used in the article model `tags` relation in the `source` option
    tag: this.belongsTo(() => TagModel, {
      primaryKey: 'id',
      foreignKey: 'tagId',
    }),
  };
}
```

Article favorite model:

```ts
// src/app/article/articleFavorite.model.ts
import { Model } from '../../lib/model';

export class ArticleFavoriteModel extends Model {
  table = 'articleFavorite';
  columns = this.setColumns((t) => ({
    userId: t.integer().foreignKey('user', 'id'),
    articleId: t.integer().foreignKey('article', 'id'),
    ...t.primaryKey(['userId', 'articleId']),
  }));
}
```

Article model:

```ts
// src/app/article/article.model.ts
import { Model } from '../../lib/model';
import { UserModel } from '../user/user.model';
import { ArticleTagModel } from './articleTag.model';
import { TagModel } from '../tag/tag.model';
import { ArticleFavoriteModel } from './articleFavorite.model';
import { modelToZod } from 'orchid-orm-schema-to-zod';

export class ArticleModel extends Model {
  table = 'article';
  columns = this.setColumns((t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer().foreignKey('user', 'id').index(),
    // it is important to set `min` and `max` for text fields
    // to make sure that the user won't submit empty strings or billion chars long strings:
    slug: t.text().unique().min(10).max(200),
    title: t.text().min(10).max(200),
    body: t.text().min(100).max(100000),
    favoritesCount: t.integer(),
    ...t.timestamps(),
  }));

  relations = {
    author: this.belongsTo(() => UserModel, {
      primaryKey: 'id',
      foreignKey: 'userId',
    }),

    favorites: this.hasMany(() => ArticleFavoriteModel, {
      primaryKey: 'id',
      foreignKey: 'articleId',
    }),

    articleTags: this.hasMany(() => ArticleTagModel, {
      primaryKey: 'id',
      foreignKey: 'articleId',
    }),

    tags: this.hasMany(() => TagModel, {
      through: 'articleTags',
      source: 'tag',
    }),
  };
}

export const articleSchema = modelToZod(ArticleModel);
```

Add models to `db.ts`:

```ts
// src/db.ts

import { ArticleModel } from './app/article/article.model';
import { ArticleTagModel } from './app/article/articleTag.model';
import { TagModel } from './app/tag/tag.model';
import { ArticleFavoriteModel } from './app/article/articleFavorite.model';

export const db = orchid-orm(
  // ...snip
  {
    // ...snip
    article: ArticleModel,
    articleFavorite: ArticleFavoriteModel,
    articleTag: ArticleTagModel,
    tag: TagModel,
  }
);
```

Add a factory for the article for use in tests:

```ts
// src/lib/test/testFactories.ts
import { createFactory } from 'orchid-orm-test-factory';
import { db } from '../../db';

export const userFactory = createFactory(db.user);

export const articleFactory = createFactory(db.article);
```

## list articles endpoint

I write one test for one feature, one by one, and this helps me a lot when writing backends and libraries.

For this tutorial, I'm listing the whole test suite for endpoint only to keep the tutorial a bit more compact.

Here are all tests for the `GET /articles` endpoint:

```ts
// src/app/article/article.controller.test
import { articleFactory, userFactory } from '../../lib/test/testFactories';
import { testRequest } from '../../lib/test/testRequest';
import { itShouldRequireAuth } from '../../lib/test/testUtils';

describe('article controller', () => {
  describe('GET /articles', () => {
    it('should load articles for public request, favorited and author following fields must be false, newer articles should go first', async () => {
      const author = await userFactory.create();
      await articleFactory.createList(2, { userId: author.id });

      const res = await testRequest.get('/articles');

      const data = res.json();
      expect(data.length).toBe(2);

      const [first, second] = data;
      expect(first.favorited).toBe(false);
      expect(first.author.following).toBe(false);
      expect(first.createdAt).toBeGreaterThan(second.createdAt);
    });

    it('should load articles for authorized user, favorited and author following fields must have proper values, newer articles should go first', async () => {
      const currentUser = await userFactory.create();

      const notFollowedAuthor = await userFactory.create();
      await articleFactory.create({ userId: notFollowedAuthor.id });

      const followedAuthor = await userFactory.create({
        follows: {
          create: [
            {
              followerId: currentUser.id,
            },
          ],
        },
      });

      await articleFactory.create({
        userId: followedAuthor.id,
        favorites: {
          create: [
            {
              userId: currentUser.id,
            },
          ],
        },
      });

      const res = await testRequest.as(currentUser).get('/articles');

      const data = res.json();
      const [first, second] = data;

      expect(second.favorited).toBe(false);
      expect(second.author.following).toBe(false);

      expect(first.favorited).toBe(true);
      expect(first.author.following).toBe(true);
    });

    describe('query params', () => {
      describe('author', () => {
        it('should filter articles by username of author', async () => {
          const [author1, author2] = await userFactory.createList(2);

          await articleFactory.create({ userId: author1.id });
          await articleFactory.create({ userId: author2.id });

          const res = await testRequest.get('/articles', {
            query: {
              author: author1.username,
            },
          });

          const data = res.json();
          expect(data.length).toBe(1);
          expect(data[0].author.username).toBe(author1.username);
        });
      });

      describe('tag', () => {
        it('should filter articles by tag', async () => {
          const author = await userFactory.create();

          // create article with matching tag
          await articleFactory.create({
            userId: author.id,
            articleTags: {
              create: ['one', 'two'].map((name) => ({
                tag: {
                  create: {
                    name,
                  },
                },
              })),
            },
          });

          // create article with different tags
          await articleFactory.create({
            userId: author.id,
            articleTags: {
              create: ['three', 'four'].map((name) => ({
                tag: {
                  create: {
                    name,
                  },
                },
              })),
            },
          });

          // create article without tags
          await articleFactory.create({ userId: author.id });

          const res = await testRequest.get('/articles', {
            query: {
              tag: 'one',
            },
          });

          const data = res.json();
          expect(data.length).toBe(1);
          expect(data[0].tags).toEqual(['one', 'two']);
        });
      });

      describe('feed', () => {
        itShouldRequireAuth(() =>
          testRequest.get('/articles', {
            query: {
              feed: 'true',
            },
          })
        );

        it('should return articles from followed authors for authorized user', async () => {
          const currentUser = await userFactory.create();
          const unfollowedAuthor = await userFactory.create();
          const followedAuthor = await userFactory.create({
            follows: {
              create: [
                {
                  followerId: currentUser.id,
                },
              ],
            },
          });

          const expectedArticles = await articleFactory.createList(2, {
            userId: followedAuthor.id,
          });

          await articleFactory.createList(2, {
            userId: unfollowedAuthor.id,
          });

          const res = await testRequest.as(currentUser).get('/articles', {
            query: {
              feed: 'true',
            },
          });

          const data = res.json();
          expect(data.length).toBe(2);
          expect(data).toMatchObject(
            expectedArticles
              .reverse()
              .map((article) => ({ slug: article.slug }))
          );
        });
      });

      describe('favorite', () => {
        itShouldRequireAuth(() =>
          testRequest.get('/articles', {
            query: {
              favorite: 'true',
            },
          })
        );

        it('should returns only articles favorited by current user', async () => {
          const [currentUser, author] = await userFactory.createList(2);

          const favoritedArticles = await articleFactory.createList(2, {
            userId: author.id,
            favorites: {
              create: [
                {
                  userId: currentUser.id,
                },
              ],
            },
          });

          await articleFactory.create({ userId: author.id });

          const res = await testRequest.as(currentUser).get('/articles', {
            query: {
              favorite: 'true',
            },
          });

          const data = res.json();
          expect(data).toMatchObject(
            favoritedArticles
              .reverse()
              .map((article) => ({ slug: article.slug }))
          );
        });
      });
    });
  });
});
```

Note that all nested create code of the `userFactory` and `articleFactory` is also applicable to the `db.user` and `db.article`.

`itShouldRequireAuth` is a utility for tests to save some lines of code when testing protected routes.

```ts
// src/lib/test/testUtils.ts
export const itShouldRequireAuth = (
  req: () => Promise<{ statusCode: number; json(): unknown }>
) => {
  it('should require authorization', async () => {
    const res = await req();
    expectUnauthorized(res);
  });
};

export const expectUnauthorized = (res: {
  statusCode: number;
  json(): unknown;
}) => {
  expect(res.statusCode).toBe(401);
  expect(res.json()).toEqual({
    message: 'Unauthorized',
  });
};
```

Define the `articleDto` schema, it will be used for response in `GET /articles`, `PATCH /articles/:id`, `POST /articles`,
so better to have it separately:

```ts
// src/app/article/article.dto.ts
import { articleSchema } from './article.model';
import { userSchema } from '../user/user.model';
import { z } from 'zod';

export const articleDto = articleSchema
  .pick({
    slug: true,
    title: true,
    body: true,
    favoritesCount: true,
    createdAt: true,
    updatedAt: true,
  })
  .and(
    z.object({
      tags: z.string().array(),
      favorited: z.boolean(),
      author: userSchema
        .pick({
          username: true,
        })
        .and(
          z.object({
            following: z.boolean(),
          })
        ),
    })
  );
```

Controller code:

```ts
import { routeHandler } from '../../lib/routeHandler';
import { db } from '../../db';
import { getOptionalCurrentUserId } from '../user/user.service';
import { z } from 'zod';
import { UnauthorizedError } from '../../lib/errors';
import { articleDto } from './article.dto';

export const listArticlesRoute = routeHandler(
  {
    query: z.object({
      author: z.string().optional(),
      tag: z.string().optional(),
      feed: z.literal('true').optional(),
      favorite: z.literal('true').optional(),
      limit: z
        .preprocess((s) => parseInt(s as string), z.number().min(1).max(20))
        .default(20),
      offset: z
        .preprocess((s) => parseInt(s as string), z.number().min(0))
        .optional(),
    }),
    result: articleDto.array(),
  },
  (req) => {
    // currentUserId will be an id for authorized, undefined for not authorized
    const currentUserId = getOptionalCurrentUserId(req);

    let query = db.article
      .select(
        'slug',
        'title',
        'body',
        'favoritesCount',
        'createdAt',
        'updatedAt',
        {
          // `pluck` method collects a column into an array
          // order is ASC by default
          tags: (q) => q.tags.order('name').pluck('name'),
          favorited: currentUserId
            // if currentUserId is defined, return exists query
            ? (q) => q.favorites.where({ userId: currentUserId }).exists()
            // if no currentUserId, return raw 'false' SQL of boolean type
            : db.article.raw((t) => t.boolean(), 'false'),
          author: (q) =>
            q.author.select('username', {
              // we load the following similar to the favorited above
              following: currentUserId
                ? (q) => q.follows.where({ followerId: currentUserId }).exists()
                : db.article.raw((t) => t.boolean(), 'false'),
            }),
        }
      )
      .order({
        createdAt: 'DESC',
      })
      // limit has default 20 in the params schema above
      .limit(req.query.limit)
      // offset parameter is optional, and it is fine to pass `undefined` to the .offset method
      .offset(req.query.offset);

    // filtering articles by author, tag, and other relations by using `whereExists`
    if (req.query.author) {
      query = query.whereExists('author', (q) =>
        q.where({ username: req.query.author })
      );
    }

    if (req.query.tag) {
      query = query.whereExists('tags', (q) =>
        q.where({ name: req.query.tag })
      );
    }

    if (req.query.feed || req.query.favorite) {
      if (!currentUserId) throw new UnauthorizedError();

      if (req.query.feed) {
        query = query.whereExists('author', (q) =>
          // `whereExists` can be nested to filter by the relation of the relation
          q.whereExists('follows', (q) =>
            q.where({ followerId: currentUserId })
          )
        );
      }

      if (req.query.favorite) {
        query = query.whereExists('favorites', (q) =>
          q.where({ userId: currentUserId })
        );
      }
    }

    // query is Promise-like and will be awaited automatically
    return query;
  }
);
```

Register this controller in the router:

```ts
// src/routes.ts
import * as article from './app/article/article.controller';

export const routes = async (app: FastifyInstance) => {
  // ...snip
  app.get('/articles', article.listArticlesRoute);
};
```

## refactoring code by using repo

Currently, the controller code for listing articles looks messy: too many things are happening,
too many query details to read the code quickly and clearly.

Here I want to tell about one special feature of the `Orchid ORM` which doesn't exist in other node.js ORMs.
There are similar capabilities in `Objection.js` and `Openrecord`, but they aren't type-safe.

Let's start from the article's `author` field: querying author includes some nuances specific to the user model,
better to keep such queries encapsulated inside the related feature folder.

Extract author object from `articleDto` into own `userDto`:

```ts
// src/app/article/article.dto.ts
import { userDto } from '../user/user.dto';

export const articleDto = articleSchema
  .pick({
    slug: true,
    title: true,
    favoritesCount: true,
    createdAt: true,
    updatedAt: true,
  })
  .and(
    z.object({
      tags: z.string().array(),
      favorited: z.boolean(),
      // move this part to the user.dto
      // author: userSchema
      //   .pick({
      //     username: true,
      //   })
      //   .and(
      //     z.object({
      //       following: z.boolean(),
      //     })
      //   ),
      author: userDto,
    })
  );
```

```ts
// src/app/user/user.dto.ts
import { userSchema } from './user.model';

export const userDto = userSchema
  .pick({
    username: true,
  })
  .and(
    z.object({
      following: z.boolean(),
    })
  );
```

Create a new file `user.repo.ts` with the content:

```ts
// src/app/user/user.repo.ts
import { createRepo } from 'orchid-orm';
import { db } from '../../db';

export const userRepo = createRepo(db.user, {
  queryMethods: {
    selectDto(q, currentUserId: number | undefined) {
      return q.select('username', {
        following: currentUserId
          ? (q) => q.follows.where({ followerId: currentUserId }).exists()
          : db.article.raw((t) => t.boolean(), 'false'),
      });
    },
  },
});
```

And now we can simplify querying the `author` object in the articles` controller:

```ts
// src/article/article.controller.ts
import { userRepo } from '../user/user.repo';

export const listArticlesRoute = routeHandler(
  // ...snip
  (req) => {
    let query = db.article
      .select(
        // ...snip
        {
          // ...snip
          author: (q) => userRepo(q.author).selectDto(currentUserId),
        }
      )
    
    // ...snip
  }
)
```

Note that in the `user.repo.ts` the `selectDto` has two arguments: first is a user query, and second is `currentUserId`.

The first argument is injected automatically, so in the controller, we are only passing the rest of the arguments.
An editor can be confused by this and print a warning, but TypeScript understands it well,
if you put a string instead of `currentUserId` TS will show an error.

Later we will load the same article fields in other endpoints,
and it makes sense for both readability and re-usability to move articles\` select into `articleRepo.selectDto`:

```ts
// src/app/article/article.repo.ts
import { createRepo } from 'orchid-orm';
import { db } from '../../db';
import { userRepo } from '../user/user.repo';

export const articleRepo = createRepo(db.article, {
  queryMethods: {
    selectDto(q, currentUserId: number | undefined) {
      return q.select(
        'slug',
        'title',
        'body',
        'favoritesCount',
        'createdAt',
        'updatedAt',
        {
          tags: (q) => q.tags.order('name').pluck('name'),
          favorited: currentUserId
            ? (q) => q.favorites.where({ userId: currentUserId }).exists()
            : db.article.raw((t) => t.boolean(), 'false'),
          author: (q) => userRepo(q.author).selectDto(currentUserId),
        }
      );
    },
  },
});
```

When using the repo in a subquery, as we did for the `author` field, need to wrap a subquery into a repo like `userRepo(q.user).selectDto(...)`.

But if the repo is not inside of the subquery, you can use the repo object directly to build queries:

```ts
// src/article/article.controller.ts
import { userRepo } from '../user/user.repo';

export const listArticlesRoute = routeHandler(
  // ...snip
  (req) => {
    const currentUserId = getOptionalCurrentUserId(req);

    let query = articleRepo
      .selectDto(currentUserId)
      .order({
        createdAt: 'DESC',
      })
      .limit(req.query.limit)
      .offset(req.query.offset);
    
    // ...snip
  }
)
```

Let's move all article filtering logic into repo methods:

```ts
// src/app/article/article.repo.ts
import { createRepo } from 'orchid-orm';
import { db } from '../../db';
import { userRepo } from '../user/user.repo';

export const articleRepo = createRepo(db.article, {
  queryMethods: {
    selectDto(q, currentUserId: number | undefined) {
      return q.select(
        'slug',
        'title',
        'body',
        'favoritesCount',
        'createdAt',
        'updatedAt',
        {
          tags: (q) => q.tags.order('name').pluck('name'),
          favorited: currentUserId
            ? (q) => q.favorites.where({ userId: currentUserId }).exists()
            : db.article.raw((t) => t.boolean(), 'false'),
          author: (q) => userRepo(q.author).selectDto(currentUserId),
        }
      );
    },
    filterByAuthorUsername(q, username: string) {
      return q.whereExists('author', (q) => q.where({ username }));
    },
    filterByTag(q, name: string) {
      return q.whereExists('tags', (q) => q.where({ name }));
    },
    filterForUserFeed(q, currentUserId: number) {
      return q.whereExists('author', (q) =>
        q.whereExists('follows', (q) => q.where({ followerId: currentUserId }))
      );
    },
    filterFavorite(q, currentUserId: number) {
      return q.whereExists('favorites', (q) =>
        q.where({ userId: currentUserId })
      );
    },
  },
});
```

And now the article controller can look so fabulous:

```ts
// src/article/article.controller.ts
// ...imports

export const listArticlesRoute = routeHandler(
  // ...snip
  (req) => {
    const currentUserId = getOptionalCurrentUserId(req);

    let query = articleRepo
      .selectDto(currentUserId)
      .order({
        createdAt: 'DESC',
      })
      .limit(req.query.limit)
      .offset(req.query.offset);

    if (req.query.author) {
      query = query.filterByAuthorUsername(req.query.author);
    }

    if (req.query.tag) {
      query = query.filterByTag(req.query.tag);
    }

    if (req.query.feed || req.query.favorite) {
      if (!currentUserId) throw new UnauthorizedError();

      if (req.query.feed) {
        query = query.filterForUserFeed(currentUserId);
      }

      if (req.query.favorite) {
        query = query.filterFavorite(currentUserId);
      }
    }

    return query;
  }
);
```

With the help of repositories, the controller code became more than twice shorter,
each repo method can be reused individually in other controllers or other repositories,
the code became easy to read and grasp.

## create an article

Here is the test for creating an article:

```ts
// src/app/article/article.controller.test.ts

describe('article controller', () => {
  // ...snip

  describe('POST /articles', () => {
    const params = articleFactory
      .pick({
        slug: true,
        title: true,
        body: true,
      })
      .build();

    itShouldRequireAuth(() =>
      testRequest.post('/articles', {
        ...params,
        tags: [],
      })
    );

    it('should create article without tags, return articleDto', async () => {
      const currentUser = await userFactory.create();

      const res = await testRequest.as(currentUser).post('/articles', {
        ...params,
        tags: [],
      });

      const data = res.json();
      expect(data.tags).toEqual([]);
      expect(data.author.username).toBe(currentUser.username);
    });

    it('should create article and tags, should connect existing tags, return articleDto', async () => {
      const currentUser = await userFactory.create();
      const tagId = await db.tag.get('id').create({ name: 'one' });

      const res = await testRequest.as(currentUser).post('/articles', {
        ...params,
        tags: ['one', 'two'],
      });

      const data = res.json();
      expect(data.tags).toEqual(['one', 'two']);
      expect(data.favorited).toBe(false);
      expect(data.author.username).toBe(currentUser.username);
      expect(data.author.following).toBe(false);

      const savedArticle = await db.article
        .findBy({ slug: data.slug })
        .select('slug', 'title', 'body', {
          tags: (q) => q.tags.order('name'),
        });

      expect(savedArticle).toMatchObject(params);
      expect(savedArticle.tags).toMatchObject([
        {
          id: tagId,
          name: 'one',
        },
        {
          name: 'two',
        },
      ]);
    });
  });
})
```

Implementation of the controller:

```ts
export const createArticleRoute = routeHandler(
  {
    body: articleSchema
      .pick({
        slug: true,
        title: true,
        body: true,
      })
      .extend({
        tags: tagSchema.shape.name.array(),
      }),
  },
  (req) => {
    const currentUserId = getCurrentUserId(req);

    // wrap creating an article and retrieving it to the transaction
    return db.$transaction(async (db) => {
      const { tags, ...params } = req.body;

      const articleId = await db.article.get('id').create({
        ...params,
        favoritesCount: 0,
        userId: currentUserId,
        articleTags: {
          create: tags.map((name) => ({
            tag: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
        },
      });

      return articleRepo(db.article).selectDto(currentUserId).find(articleId);
    });
  }
);
```

This example demonstrates the use of nested `create` with nested `connectOrCreate`:
it will try to find a tag by name and will create a tag only if not found.

Notice that `articleRepo` is wrapping `db.article`: it must be so when using the repository inside a transaction.
By default, the repo will use a default connection, so it will try to perform a query outside of a transaction.
Luckily, `pg-transactional-tests` will catch this mistake when running tests,
the test will hang when trying to use more than 1 connection.

Register this controller in the router:

```ts
// src/routes.ts
import * as article from './app/article/article.controller';

export const routes = async (app: FastifyInstance) => {
  // ...snip
  app.post('/articles', article.listArticlesRoute);
};
```

## update article endpoint

One specific thing which is needed to be tested properly is tags:
when the user is updating article tags, the app should create new tag records in case they didn't exist before,
it should delete tags that aren't used by any article, and connect the article to all tags properly.

So if in the future the app will have a tags endpoint that lists all tags, there won't be duplicates.

Tests for the endpoint:

```ts
describe('article controller', () => {
  // ...snip

  describe('PATCH /articles/:slug', () => {
    const params = articleFactory
      .pick({
        slug: true,
        title: true,
        body: true,
      })
      .build();

    // this test helper was defined earlier
    itShouldRequireAuth(() =>
      testRequest.patch('/articles/article-slug', params)
    );

    it('should return unauthorized error when trying to update article of other user', async () => {
      const currentUser = await userFactory.create();
      const author = await userFactory.create();
      const article = await articleFactory.create({
        userId: author.id,
      });

      const res = await testRequest
        .as(currentUser)
        .patch(`/articles/${article.slug}`, params);

      // this test helper was defined earlier
      expectUnauthorized(res);
    });

    it('should update article fields', async () => {
      const currentUser = await userFactory.create();
      const article = await articleFactory.create({
        userId: currentUser.id,
      });

      const res = await testRequest
        .as(currentUser)
        .patch(`/articles/${article.slug}`, params);

      const data = res.json();
      expect(data).toMatchObject(params);
    });

    it('should set new tags to article, create new tags, delete not used tags', async () => {
      const [currentUser, otherAuthor] = await userFactory.createList(2);
      
      const article = await articleFactory.create({
        userId: currentUser.id,
        articleTags: {
          create: ['one', 'two'].map((name) => ({
            tag: {
              create: {
                name,
              },
            },
          })),
        },
      });

      await articleFactory.create({
        userId: otherAuthor.id,
        articleTags: {
          create: ['two', 'three'].map((name) => ({
            tag: {
              create: {
                name,
              },
            },
          })),
        },
      });

      const res = await testRequest
        .as(currentUser)
        .patch(`/articles/${article.slug}`, {
          tags: ['two', 'new tag'],
        });

      const data = res.json();
      expect(data.tags).toEqual(['new tag', 'two']);

      const allTagNames = await db.tag.pluck('name');
      expect(allTagNames).not.toContain('one');
    });
  });
})
```

Controller:

```ts
export const updateArticleRoute = routeHandler(
  {
    body: articleSchema
      .pick({
        slug: true,
        title: true,
        body: true,
      })
      .extend({
        tags: tagSchema.shape.name.array(),
        favorite: z.boolean(),
      })
      .partial(),
    params: z.object({
      slug: articleSchema.shape.slug,
    }),
    result: articleDto,
  },
  (req) => {
    const currentUserId = getCurrentUserId(req);

    return db.$transaction(async (db) => {
      const { slug } = req.params;
      
      // assigning repo to local variable to not repeat it
      const repo = articleRepo(db.article);

      // retrieve required fields and the current tags of article
      const article = await repo.findBy({ slug }).select('id', 'userId', {
        tags: (q) => q.tags.select('id', 'name'),
      });

      if (article.userId !== currentUserId) {
        throw new UnauthorizedError();
      }

      const { tags, favorite, ...params } = req.body;

      await repo
        .find(article.id)
        .update(params)
        // updateTags is a repo method, see below
        .updateTags(db.tag, article.tags, tags);

      return await repo.selectDto(currentUserId).find(article.id);
    });
  }
);
```

The logic for updating tags is complex enough, so it is encapsulated into the article repo.

```ts
// src/app/article/article.repo.ts
import { createRepo } from 'orchid-orm';
import { db } from '../../db';

export const articleRepo = createRepo(db.article, {
  queryMethods: {
    // ...snip
  },
  queryOneWithWhereMethods: {
    async updateTags(q) {
      // TODO
    },
  },
})
```

All previous repo methods were placed under `queryMethods`, but here we place it under the `queryOneWithWhereMethods`.
The difference is in the type of the `q` parameter.

It is forbidden to create related records from the query which returns multiple records, for example:

```ts
// will result in a TS error
db.article.where({ id: { in: [1, 2, 3] } }).update({
  articleTags: {
    create: { ...someData }
  }
})
```

This code not only creates new `articleTags` but also connects them to the article.
If we select 3 articles and create `articleTags` for the query it wouldn't make much sense because a single `articleTag` can be connected to a single `article` only, but cannot connect to many.

That's why the type of `q` have to indicate that it is returning a single record.

Also, the `update` query must be applied only after we pass search conditions, to make sure we won't update all records in the database by mistake.

```ts
// will result in TS error
db.article.update({ ...data })
```

That's why the type of `q` have to indicate it has some search statements.
So we placed a new query method into `queryOneWithWhereMethods` where `q` is promised to have search conditions and to search for a single record.

Here is the `updateTags` implementation:

```ts
// src/app/article/article.repo.ts
import { createRepo } from 'orchid-orm';
import { db } from '../../db';
import { tagRepo } from './tag.repo';

export const articleRepo = createRepo(db.article, {
  queryMethods: {
    // ...snip
  },
  queryOneWithWhereMethods: {
    async updateTags(
      q,
      // first argument is a queryable instance of the tag
      tag: typeof db.tag,
      // tags which article is connected to at the moment
      currentTags: { id: number; name: string }[],
      // tag names from user parameters to use for the article
      tags?: string[]
    ) {
      const currentTagNames = currentTags.map(({ name }) => name);
      const addTagNames = tags?.filter(
        (name) => !currentTagNames.includes(name)
      );
      const removeTagIds = tags
        ? currentTags
          .filter(({ name }) => !tags.includes(name))
          .map((tag) => tag.id)
        : [];

      await q.update({
        articleTags: {
          // note the `?` mark: nothing will happen if `addTagNames` is not defined
          create: addTagNames?.map((name) => ({
            tag: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
          // won't delete anything if we pass an empty array
          delete: removeTagIds.length ? { tagId: { in: removeTagIds } } : [],
        },
      });

      if (removeTagIds.length) {
        // `deleteUnused` will be defined in a tag repo
        await tagRepo(tag).whereIn('id', removeTagIds).deleteUnused();
      }
    },
  },
})
```

The first parameter is `tag` from `db.tag` (see in article controller).
We import `db.tag` directly here because it is important to use `db` from the callback of the transaction.

Another thing to point out here, this method doesn't return a query object, so it cannot be chained.
This is a limitation for the case when you want to await a query inside of the method.

`deleteUnused` is not complex and could be inlined, but it feels good to move the code to places where it feels like home.
It is not a concern of the article to know what an unused tag is, it is a concern of a tag, so it belongs to the tag repo:

```ts
// src/app/tag/tag.repo.ts
import { createRepo } from 'orchid-orm';
import { db } from '../../db';

export const tagRepo = createRepo(db.tag, {
  queryMethods: {
    deleteUnused(q) {
      return q.whereNotExists('articleTags').delete();
    },
  },
});
```

Add a controller to the router:

```ts
// src/routes.ts
import * as article from './app/article/article.controller';

export const routes = async (app: FastifyInstance) => {
  // ...snip
  app.patch('/articles/:slug', article.updateArticleRoute);
};
```

## mark/unmark the article as a favorite

Tests:

```ts
// src/app/article/article.controller.test.ts

describe('article controller', () => {
  // ...snip

  describe('POST /articles/:slug/favorite', () => {
    it('should mark article as favorited when passing true', async () => {
      const [currentUser, author] = await userFactory.createList(2);
      const article = await articleFactory.create({
        userId: author.id,
      });

      await testRequest
        .as(currentUser)
        .post(`/articles/${article.slug}/favorite`, {
          favorite: true,
        });

      const { favorited } = await articleRepo
        .find(article.id)
        // .selectFavorited will be defined in articleRepo later
        .selectFavorited(currentUser.id);
      expect(favorited).toBe(true);
    });

    it('should not fail when passing true and article is already favorited', async () => {
      const [currentUser, author] = await userFactory.createList(2);
      const article = await articleFactory.create({
        userId: author.id,
        favorites: {
          create: [
            {
              userId: currentUser.id,
            },
          ],
        },
      });

      const res = await testRequest
        .as(currentUser)
        .post(`/articles/${article.slug}/favorite`, {
          favorite: true,
        });

      expect(res.statusCode).toBe(200);
    });

    it('should unmark article as favorited when passing false', async () => {
      const [currentUser, author] = await userFactory.createList(2);
      const article = await articleFactory.create({
        userId: author.id,
        favorites: {
          create: [
            {
              userId: currentUser.id,
            },
          ],
        },
      });

      await testRequest
        .as(currentUser)
        .post(`/articles/${article.slug}/favorite`, {
          favorite: false,
        });

      const { favorited } = await articleRepo
        .find(article.id)
        .selectFavorited(currentUser.id);
      expect(favorited).toBe(false);
    });

    it('should not fail when article is not favorited and passing false', async () => {
      const [currentUser, author] = await userFactory.createList(2);
      const article = await articleFactory.create({
        userId: author.id,
      });

      const res = await testRequest
        .as(currentUser)
        .post(`/articles/${article.slug}/favorite`, {
          favorite: false,
        });

      expect(res.statusCode).toBe(200);
    });
  });
})
```

Define `.selectFavorite` to use in this test and the controller later:

It is not possible to use one method from another due to some TS limitations, so the way to do it is to define a standalone function.

```ts
// src/app/article/article.repo.ts

// define selectFavorite as a standalone function to use in multiple methods:
const selectFavorited = (currentUserId: number | undefined) => {
  return currentUserId
    ? (q: typeof db.article) =>
      q.favorites.where({ userId: currentUserId }).exists()
    : db.article.raw((t) => t.boolean(), 'false');
};

export const articleRepo = createRepo(db.article, {
  queryMethods: {
    selectDto(q, currentUserId: number | undefined) {
      return q.select(
        'slug',
        'title',
        'body',
        'favoritesCount',
        'createdAt',
        'updatedAt',
        {
          tags: (q) => q.tags.order('name').pluck('name'),
          // use selectFavorited from above
          favorited: selectFavorited(currentUserId),
          author: (q) => userRepo(q.author).selectDto(currentUserId),
        }
      );
    },
    selectFavorited(q, currentUserId: number | undefined) {
      return q.select({ favorited: selectFavorited(currentUserId) });
    },
    // ...snip
  },
  // ...snip
})
```

Controller code:

```ts
export const toggleArticleFavoriteRoute = routeHandler(
  {
    body: z.object({
      favorite: z.boolean(),
    }),
    params: z.object({
      slug: articleSchema.shape.slug,
    }),
  },
  async (req) => {
    const currentUserId = getCurrentUserId(req);
    const { slug } = req.params;
    const { favorite } = req.body;

    // assign favorites query to a variable to use it for different queries later:
    const favoritesQuery = db.article.findBy({ slug }).favorites;
    
    if (favorite) {
      try {
        await favoritesQuery.create({
          userId: currentUserId,
        });
      } catch (err) {
        // ignore case when an article is already favorited
        if (err instanceof db.articleFavorite.error && err.isUnique) {
          return;
        }
        throw err;
      }
    } else {
      await favoritesQuery
        .where({
          userId: currentUserId,
        })
        .delete();
    }
  }
);
```

Add a controller to the router:

```ts
// src/routes.ts
import * as article from './app/article/article.controller';

export const routes = async (app: FastifyInstance) => {
  // ...snip
  app.patch('/articles/:slug', article.updateArticleRoute);
};
```

## delete an article

Tests for the future endpoint:

```ts
// src/app/article/article.controller.test.ts

describe('article controller', () => {
  // ...snip

  describe('DELETE /articles/:slug', () => {
    itShouldRequireAuth(() => testRequest.delete('/articles/article-slug'));

    it('should return unauthorized error when trying to delete article of other user', async () => {
      const [currentUser, author] = await userFactory.createList(2);
      const article = await articleFactory.create({
        userId: author.id,
      });

      const res = await testRequest
        .as(currentUser)
        .delete(`/articles/${article.slug}`);

      expectUnauthorized(res);
    });

    it('should delete article', async () => {
      const currentUser = await userFactory.create();
      const article = await articleFactory.create({
        userId: currentUser.id,
      });

      await testRequest.as(currentUser).delete(`/articles/${article.slug}`);

      const exists = await db.article.find(article.id).exists();
      expect(exists).toBe(false);
    });

    it('should delete unused tags, and leave used tags', async () => {
      const currentUser = await userFactory.create();
      const article = await articleFactory.create({
        userId: currentUser.id,
        articleTags: {
          create: ['one', 'two'].map((name) => ({
            tag: {
              create: {
                name,
              },
            },
          })),
        },
      });

      await articleFactory.create({
        userId: currentUser.id,
        articleTags: {
          create: ['two', 'three'].map((name) => ({
            tag: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
        },
      });

      await testRequest.as(currentUser).delete(`/articles/${article.slug}`);

      const allTagNames = await db.tag.pluck('name');
      expect(allTagNames).toEqual(['two', 'three']);
    });
  });
})
```

Controller code:

```ts
// src/app/article/article.controller.ts

export const deleteArticleRoute = routeHandler(
  {
    params: z.object({
      slug: articleSchema.shape.slug,
    }),
  },
  async (req) => {
    const currentUserId = getCurrentUserId(req);
    const { slug } = req.params;

    // wrapping in the transaction to search for an article and delete it in a single transaction
    await db.$transaction(async (db) => {
      const article = await db.article
        .select('id', 'userId', {
          tagIds: (q) => q.tags.pluck('id'),
        })
        .findBy({ slug });

      if (article.userId !== currentUserId) {
        throw new UnauthorizedError();
      }

      // assign a query to a variable to reuse it
      const articleQuery = db.article.find(article.id);

      if (article.tagIds.length) {
        // before deleting a record need to delete all its related records
        // otherwise there would be an error complaining about a foreign key violation
        await articleQuery.articleTags.delete(true);
      }

      await articleQuery.delete();

      if (article.tagIds.length) {
        // tag repo with `deleteUnused` was defined before, at the step of updating the article
        await tagRepo(db.tag).whereIn('id', article.tagIds).deleteUnused();
      }
    });
  }
);
```
