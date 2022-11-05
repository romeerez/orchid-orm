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
    * Responds with `UserDTO`

- **POST** `/users/auth`: log in
    * JSON payload:
        - **email**: string
        - **password**: string
    * Responds with `UserDTO`

- **GET** `/articles`: get list of articles
    * URI params:
        - **author**: filter articles by username of author
        - **tag**: filter articles by tag
        - **feed**: list articles only from authors which current user is following
        - **favorite**: list only articles favorited by current user
    * Responds with `ArticleDTO`

- **POST** `/articles`: create a new article
    * JSON payload:
        - **title**: string
        - **body**: string
        - **tags**: array of strings
    * Responds with `ArticleDTO`

- **PATCH** `/articles/:slug`: update article
    * JSON payload:
        - **title**?: string
        - **body**?: string
        - **tags**?: array of strings
    * Responds with `ArticleDTO`

- **DELETE** `/articles/:slug`: delete article
    * No response needed

- **POST** `/articles/:slug/favor`: mark article as favorite or undo that
    * JSON payload:
        - **favorite**: boolean
    * No response needed

`UserDTO` and `ArticleDTO` (data transfer object, i.e responses) are:

```ts
type UserDTO = {
  username: string
  // following means if the user who performs request is following this user
  following: boolean
}

type ArticleDto = {
  slug: string
  body: string
  // how much users have favorited this article
  favoritesCount: number
  // whether requesting user have favorited this article
  favorited: boolean
  tags: string[]
  author: UserDTO
  
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
pnpm init # use your favorite packaging tool here
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
pnpm i -D typescript @types/node
```

Second thing to do in every node.js project is eslint with prettier, it takes quite a long list of dependencies and few file changes, check this [commit](insert link) for example configuration.

Installing and configuring server is beyond the narrative, here is a [commit](link to commit) with a with basic preparation.

## Setup Porm
