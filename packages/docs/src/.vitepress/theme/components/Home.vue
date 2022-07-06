<script setup>
  import VPButton from 'vitepress/client/theme-default/components/VPButton.vue'
</script>

<template>
  <div class="container">
    <img src='/full-logo.svg' alt='Logo' class='logo'>

    <h1 class='text'>Postgres ORM, query builder, migration tool.<br />First-class TypeScript support.</h1>

    <ul class='list'>
      <li>🚀️ productive way to work with models and relations</li>
      <li>🧐️ full control over the database with powerful query builder</li>
      <li>😎️ model schema is based on <a href='https://github.com/colinhacks/zod' target='_blank' class='link'>Zod</a> so it can be reused</li>
      <li>🛳️ migration tools</li>
      <li>💯 100% TypeScript, define a schema and everything else will be inferred</li>
    </ul>

    <div class='buttons'>
      <VPButton
        text="Get Started"
        href="/get-started"
      />
      <VPButton
        theme="alt"
        text="⭐ Star on GitHub"
        href="https://github.com/romeerez/porm"
      />
    </div>
  </div>
</template>

<style scoped>
  .container {
    text-align: center;
  }

  .logo {
    max-width: 100%;
    width: 500px;
    display: inline-block;
    margin: 40px 0;
  }

  .text {
    line-height: 1.5;
    font-size: 36px;
    font-weight: 800;
  }

  .list {
    margin-top: 40px;
    display: inline-block;
    text-align: left;
  }

  .list li {
    margin: 8px 0;
  }

  .link {
    font-weight: 500;
    color: var(--vp-c-brand);
    text-decoration-style: dotted;
    transition: color .25s;
  }

  .code {
    border-radius: 4px;
    padding: 3px 6px;
    color: var(--vp-c-text-code);
    background-color: var(--vp-c-bg-mute);
    transition: color .5s, background-color .5s;
  }

  .buttons {
    margin-top: 40px;
  }

  .buttons a:first-child {
    margin-right: 16px;
  }
</style>
