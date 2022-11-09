# Building a sample app

In this section we will walk through the process of creation of API server.
Here you can get an overall idea of how `Porm` looks and feels,
what problem does it solve and how, see the benefits and possible drawbacks.

We are going to build an API for a blog site with users, articles, tags, users can follow each other.
It is inspired by [realworld](https://github.com/gothinkster/realworld) API spec.

## API routes

- **POST** `/users`: register new user
    * JSON payload:
        - **username**: string
        - **email**: string
        - **password**: string
    * Responds with user object and auth token

- **POST** `/users/auth`: log in
    * JSON payload:
        - **email**: string
        - **password**: string
    * Responds with user object and auth token

- **POST** `/users/:username/follow`: follow a user
    * No payload and no response needed

- **DELETE** `/users/:username/follow`: unfollow a user
    * No payload and no response needed

- **GET** `/articles`: get list of articles
    * URI params:
        - **author**: filter articles by username of author
        - **tag**: filter articles by tag
        - **feed**: list articles only from authors which current user is following
        - **favorite**: list only articles favorited by current user
    * Responds with article data

- **POST** `/articles`: create a new article
    * JSON payload:
        - **title**: string
        - **body**: string
        - **tags**: array of strings
    * Responds with article data

- **PATCH** `/articles/:slug`: update article
    * JSON payload:
        - **title**?: string
        - **body**?: string
        - **tags**?: array of strings
    * Responds with article data

- **DELETE** `/articles/:slug`: delete article
    * No response needed

- **POST** `/articles/:slug/favor`: mark article as favorite or undo that
    * JSON payload:
        - **favorite**: boolean
    * No response needed


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
  // whether requesting user have favorited this article
  favorited: boolean
  tags: string[]
  author: {
    username: string
    // following means if the user who performs request is following this user
    following: boolean
  }
  
  // Postgres is returning dates in such format: `2022-11-04 10:53:02.129306 +00:00`
  // but this format is not supported by all browses
  // As a bonus, both transferring and parsing date as a epoch number is more efficient, so let's use numbers for dates:
  createdAt: number
  udpatedAt: number
}
```

## Initialize the project

Lets init the project:

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

First thing we need in every node.js project is a TypeScript:

```sh
npm i -D typescript @types/node
```

Second thing to do in every node.js project is eslint with prettier, it takes quite a long list of dependencies and few file changes, check this [commit](insert link) for example configuration.

We won't get stuck here on topic of configuring server and test framework, here is a [commit](link to commit) for sample server configuration and here is [commit](link to commit) for configuring tests.

For the sample application I chose [fastify.io](https://www.fastify.io/) as a server framework,
because it is easier to set up (async error handling out of the box, unlike express),
has more concise syntax for routes, and it includes a very nice utility for testing out of the box.
Of course, you can use `Porm` with your favorite framework.

## Setup Porm

Install `Porm` dependencies:

```sh
npm i porm pqb porm-schema-to-zod

# dev dependencies:
npm i -D rake-db porm-test-factory
```

- **porm**: this is the ORM, responsible for defining models, relations
- **pqb**: query builder, used by other parts to build chainable query objects
- **rake-db**: is responsible for migrations
- **porm-schema-to-zod**: convert model columns to a Zod schema to use it for validations
- **porm-test-factory**: for building mock data in tests

Let's also install additional tool for tests, it will wrap each test in transaction, so we won't have to clean db manually:

```sh
npm i -D pg pg-transactional-tests
```

Place database urls to .env.local file (which should be listed in .gitignore), one database for development and second for tests:

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

Now `config` has `DATABASE_URL` for dev database, `DATABASE_URL_TEST` for test database,
and `currentDatabaseUrl` with database for the current environment.

Create a main file for database instance:

```ts
// src/db.ts
import { porm } from 'porm';
import { config } from './config';

export const db = porm(
  {
    connectionString: config.currentDatabaseUrl,
    log: true,
  },
  {
    // models will be listed here
  }
);
```

Define a base `Model` class which will be used later to extend models from:

```ts
// src/lib/model.ts
import { createModel } from 'porm';
import { columnTypes } from 'pqb';

export const Model = createModel({
  columnTypes: {
    ...columnTypes,
  },
});
```

Create a script which we will use from a terminal to generate and run migrations.

```ts
// src/scripts/db.ts
import path from 'path';
import { rakeDb } from 'rake-db';
import { config } from '../config';

const migrationsPath = path.resolve(__dirname, '..', 'migrations');

const options = [{ connectionString: config.DATABASE_URL }];

// when running in production we don't need test database
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

Now we can create databases from command line:

```sh
npm run db create
```

If database user specified in `.env.local` is not a superuser, this command will ask for a superuser username/password to create databases.

After successfully running it will print:

```text
Database blog-api successfully created
Created versions table
Database blog-api-test successfully created
Created versions table
```

So we can see it created two databases.
Each of them has a special table to track which migration where already applied and which were not.

Add a `jest-setup.ts` to the root of the project.
This will make every test case which makes db queries wrapped in a transaction with rollback,
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

## User endpoints

Let's begin from writing a user model.
Every model must have a table name and a set of columns.

Usually each model should have a primary key column.
We will use `t.serial().primaryKey()` for this purpose, it is autoincrementing integer type.
Other available option for primary keys is to use `t.uuid().primaryKey()`.

It is a good idea to have `createdAt` and `updatedAt` columns in every model, even if it is not asked in requirements,
these columns may come in hand later, for displaying, sorting by them, `updatedAt` may be used for cache invalidation.
Add them to model by writing: `...t.timestamps()`.

Each column has a type, which is used to get a TypeScript type and a database type when running a migration.
Some column methods have effect only in migration, some methods are for validation.

### Writing a model

```ts
// src/app/user/user.model.ts
import { Model } from '../../lib/model';
import { modelToZod } from 'porm-schema-to-zod';

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

// will be used later in controller to validate parameters
export const userSchema = modelToZod(UserModel);
```

Consider `email` column:

```ts
t.text() // this is a column type
  .unique() // has effect only in migration
  .email() // validates email
```

After defining a model, place it into `db` models list:

```ts
// src/db.ts
import { porm } from 'porm';
import { config } from './config';
import { UserModel } from './app/user/user.model';

export const db = porm(
  {
    connectionString: config.currentDatabaseUrl,
    log: true,
  },
  {
    user: UserModel,
  }
);
```

Now `user` is defined on `db`, we can write queries like `db.user.count()`, `db.user.select(...)` and many others.

Define a test factory which we will use very soon:

```ts
// src/lib/test/testFactories.ts
import { createFactory } from 'porm-test-factory';
import { db } from '../../db';

export const userFactory = createFactory(db.user);
```

### Add migration

Generate a new migration file by running:

```sh
npm run db g createUser
```

In newly added file we can see such content:

```ts
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

Note that `min`, `max`, `email` have no effect in the migration, these methods are only for validation that we will use later.

`Porm` will probably gain a feature of auto-generated migrations in the future, but for now they are written manually.

### Writing tests for register user endpoint

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

      // check that user was saved to the database with correct fields
      const savedUser = await db.user.findBy({ username: data.username });
      expect(savedUser).toMatchObject({
        username: data.username,
        email: data.email,
      });

      // ensure that we don't store plain text password to the database
      expect(savedUser.password).not.toBe(data.password);
    });

    it('should return error when username is taken', async () => {
      // build new randomly generated params
      const data = params.build();
      // create a new user with this specific username
      await userFactory.create({ username: data.username });

      // perform request
      const res = await testRequest.post('/users', data);

      // expect error because user with such username was created before the request
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

`testRequest` is a custom helper around `app.inject` from fastify to perform a fake requests without app running.

`express` doesn't have such tools and can be tested with real requests, it's recommended to use `axios` for this purpose.

We can freely create database records thanks to `pg-transactional-tests` which was configured earlier in a `jest-setup.ts`.

### Implementing register user endpoint

On real projects the auth will be more sophisticated, but for demo purposes lets do a simplistic token based auth.

Add `JWT_SECRET` to `.env` file and to `config.ts`:

```ts
// src/config.ts

const env = z
  .object({
    // ...snip
    JWT_SECRET: z.string(),
  })

```

Here are utility functions for json web token:

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

Utility functions for hashing and comparing password:

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

And, finally, the register endpoint itself:

```ts
// src/app/user/user.controller.ts

import { routeHandler } from '../../lib/routeHandler';
import { z } from 'zod';
import { db } from '../../db';
import { encryptPassword } from '../../lib/password';
import { createToken } from '../../lib/jwt';
import { userSchema } from './user.model';
import { ApiError } from '../../lib/errors';

export const registerUserRoute = routeHandler(
  {
    body: userSchema.pick({
      username: true,
      email: true,
      password: true,
    }),
    result: {
      user: userSchema.pick({
        id: true,
        username: true,
        email: true,
      }),
      token: z.string(),
    },
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

I'm using a custom utility `routeHandler` to validate parameters and result by using `zod` schemas.

Every node.js framework and even specific project usually has own custom way of validating request parameters,
some use middlewares, some use decorators. It can be anything, but it should serve the purposes of:

- request query, body, route params must be validated properly
- validated query, body, params should have proper types
- it is nice to have response validation in dev/test environment, so you won't leak sensitive data by accident and no need to write a tedious tests for this

Consider the code for creating a user:

```ts
const user = await db.user.select('username', 'email').create({
  ...req.body,
  password: await encryptPassword(req.body.password),
});
```

`select` before `create` changes `RETURNING` SQL statement, if we use `create` without `select` it will return a full record.

It is safe to use `...req.body` because `body` was validated and all unknown keys were stripped out of it.

Inside of error handler, first we check `err instanceof db.user.error` to know if this error belong to the user model,
then we check `err.isUnique` to ensure this is unique violation error.
And then we check `err.columns.username` and `err.columns.email` to determine which column has failed uniqueness to throw corresponding error.

Add the route function to the router:

```ts
// src/routes.ts
import { FastifyInstance } from 'fastify';
import * as userController from './app/user/user.controller';

export const routes = async (app: FastifyInstance) => {
  app.post('/users', userController.registerUserRoute);
};
```

I'm skipping some framework specific details: how to configure server, configure routing, this depends on the framework and your preferences.

### Implementing login endpoint

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
    result: {
      user: userSchema.pick({
        id: true,
        username: true,
        email: true,
      }),
      token: z.string(),
    },
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

There is a similar `findBy` method which would throw a `NotFoundError` when not found, but here we want to check it manually.

Add the route function to the router:

```ts
// src/routes.ts
import { FastifyInstance } from 'fastify';
import * as userController from './app/user/user.controller';

export const routes = async (app: FastifyInstance) => {
  app.post('/users', userController.registerUserRoute);
  app.post('/users/auth', userController.loginUserRoute);
};
```

### Implementing follow and unfollow

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
Both these columns have `foreignKey` which connects it with an `id` of `UserModel` to ensure that value always points to existing user record.

With such syntax `...t.primaryKey([column1, column2])` we define a composite primary key.
Internally Postgres will add a multi-column unique index and ensure that all of these columns are not null.

Add this model to list of models in db:

```ts
// src/db.ts
// ...snip
import { UserFollowModel } from './app/user/userFollow.model';

export const db = porm(
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

Tests for follow/unfollow endpoints:

```ts
// src/app/user/user.controller.test.ts

  describe('POST /users/:username/follow', () => {
    it('should follow a user', async () => {
      // create a user to perform request from
      const currentUser = await userFactory.create();
      // create a user to follow
      const userToFollow = await userFactory.create();

      // perform request as a provided user
      await testRequest
        .as(currentUser)
        .post(`/users/${userToFollow.username}/follow`);

      
      // check that userFollow record exists in the database
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

      // check that such userFollow record doesn't exists
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

`getCurrentUserId` is a function to get user id form `JWT` token, leaving it beyond this tutorial, here is its [source](link to user.service).

After defining `follows` relation in user model, `db.user` receives a `follows` property which allows to do different queries, and the code above shows the use of such chained `create` method.

If there is a need to do multiple queries it will wrap them in a transaction to prevent unexpected race conditions.

`Porm` strives to perform as few queries as possible to gain maximum performance, and in this case it does a single `INSERT ... SELECT ...` query, so it inserts `userFollow` from selecting `user` record to use user id.

`findBy` method will throw `NotFoundError` in case if record is not found, add such section to the global error handler of your app to report such errors to user:

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

`Porm` will perform one `DELETE` query by this code.

Add route functions to the router:

```ts
// src/routes.ts
import { FastifyInstance } from 'fastify';
import * as userController from './app/user/user.controller';

export const routes = async (app: FastifyInstance) => {
  // ...snip
  app.post('/users/:username/follow', userController.followUserRoute);
  app.delete('/users/:username/follow', userController.unfollowUserRoute);
};
```

