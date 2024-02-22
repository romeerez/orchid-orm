<script setup>
import VPButton from 'vitepress/dist/client/theme-default/components/VPButton.vue';
</script>

<template>
  <div class="container">
    <div class="title">Orchid ORM</div>

    <h1 class="text">
      Postgres ORM, query builder, migration tool.<br />First-class TypeScript
      support.
    </h1>

    <ul class="list">
      <li>🚀️ productive way to work with models and relations</li>
      <li>🧐️ full control over the database with powerful query builder</li>
      <li>
        😎️ tables can be converted to
        <a href="https://github.com/colinhacks/zod" target="_blank" class="link"
          >Zod</a
        >
        or
        <a href="https://valibot.dev/" target="_blank" class="link"
        >Valibot</a
        >
        for validations
      </li>
      <li>🛳️ migration tools</li>
      <li>
        💯 100% TypeScript, define a schema and everything else will be inferred
      </li>
    </ul>

    <div class="buttons">
      <VPButton text="Get Started" href="/guide/" />
      <VPButton
        theme="alt"
        text="⭐ Star on GitHub"
        href="https://github.com/romeerez/orchid-orm"
      />
    </div>
  </div>
</template>

<style scoped>
.container {
  text-align: center;
  padding: 0 20px;
}

.title {
  margin: 32px 0 16px;
  font-size: 52px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  color: #c04c8b;
  line-height: 1;
  background: -webkit-linear-gradient(#c04c8b, var(--vp-button-brand-bg));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.text {
  line-height: 1.3;
  font-size: 28px;
  font-weight: 800;
}

.list {
  display: inline-block;
  text-align: left;
}

.list li {
  margin: 16px 0;
}

.link {
  font-weight: 500;
  color: var(--vp-c-brand);
  text-decoration-style: dotted;
  transition: color 0.25s;
}

.buttons {
  margin-top: 12px;
}

.buttons a:first-child {
  margin-right: 16px;
}

@media (min-width: 480px) {
  .title {
    margin: 60px 0;
    font-size: 72px;
  }

  .text {
    line-height: 1.5;
    font-size: 36px;
  }

  .list,
  .buttons {
    margin-top: 40px;
  }

  .list li {
    margin: 8px 0;
  }
}
</style>
