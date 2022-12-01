<script setup>
  import VPButton from 'vitepress/dist/client/theme-default/components/VPButton.vue'
</script>

<template>
  <div class="container">
    <div class="title">
      <img src='/Orchid.png' alt='Logo' class='logo'>
      Orchid ORM
    </div>

    <h1 class='text'>Postgres ORM, query builder, migration tool.<br />First-class TypeScript support.</h1>

    <ul class='list'>
      <li>🚀️ productive way to work with models and relations</li>
      <li>🧐️ full control over the database with powerful query builder</li>
      <li>😎️ model schema can be converted to <a href='https://github.com/colinhacks/zod' target='_blank' class='link'>Zod</a> for validations</li>
      <li>🛳️ migration tools</li>
      <li>💯 100% TypeScript, define a schema and everything else will be inferred</li>
    </ul>

    <div class='buttons'>
      <VPButton
        text="Get Started"
        href="/guide/"
      />
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
  }

  .title {
    margin: 40px 0;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 72px;
    font-weight: bold;
    color: #c04c8b;
    line-height: 0.7;
  }

  .logo {
    position: relative;
    top: -40px;
    margin-right: -105px;
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
