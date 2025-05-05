<script setup>
  import { defineAsyncComponent } from 'vue';
  import { inBrowser } from 'vitepress';

  const CompareWithKysely = inBrowser
    ? defineAsyncComponent(() => import('../../.vitepress/theme/components/CompareWithKysely.vue'))
    : () => null;
</script>

# 与 Kysely 的比较

[Kysely](https://kysely.dev/) 是一个查询构建器，而不是 ORM，从设计上来说，它不负责处理关系和其他 ORM 中常见的功能。
然而，将 **OrchidORM** 与其进行比较是有意义的，因为这两个库都提供了构建复杂查询的能力，并且非常注重类型安全。

**OrchidORM** 从 **Kysely** 中汲取了灵感。与 **Kysely** 一样灵活且类型安全是该项目的目标之一。
目前尚未覆盖 **Kysely** 的所有功能，例如 `case-when` SQL 构建器。

**OrchidORM** 仅支持 PostgreSQL 数据库，而 **Kysely** 支持[许多不同的数据库](https://kysely.dev/docs/dialects)。

<CompareWithKysely />
