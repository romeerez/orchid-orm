<script setup>
  import { defineAsyncComponent } from 'vue';
  import { inBrowser } from 'vitepress';

  const CompareWithKysely = inBrowser
    ? defineAsyncComponent(() => import('../.vitepress/theme/components/CompareWithKysely.vue'))
    : () => null;
</script>

# Comparing with Kysely

[Kysely](https://kysely.dev/) is a query builder, not an ORM, in a sense that it is not responsible for relations by design.
Yet, it makes sense to compare **OrchidORM** with it because both libraries provide ability to construct complex queries,
with a big respect to type-safety.

**OrchidORM** took inspiration from **Kysely**. Being not less flexible and type-safe than **Kysely** is one of the project goals.
Not all features of **Kysely** are covered yet, for example, `case-when` SQL builder.

<CompareWithKysely />
