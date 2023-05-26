# ORCHID-ORM docs

[Read docs here](https://orchid-orm.netlify.app/)

## Contributing

Install and start:

```sh
npm i
npm start
## pnpm also works for start
pnpm start
```

Docs are in the [src/guide](./src/guide), sidebar docs navigation in the [src/.vitepress/config.ts](./src/.vitepress/config.ts).

This markdown command indicates that this method is also has documentation in the code comments,
and when updating info in the docs, need to also update it in the method's comment.

```
[//]: # 'has JSDoc'
```

When editing docs, make sure you have enabled Prettier to format `md` files on save.

Methods starting with `_` such as `_select` are "private" and perhaps will be removed in future for the sake of bundle size,
because bundle size is important for the serverless.
