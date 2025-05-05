<script setup>
import { ref } from 'vue';
import { useData } from 'vitepress';

import VPButton from 'vitepress/dist/client/theme-default/components/VPButton.vue';

const { theme } = useData();
</script>

<template>
  <div class="container">
    <div class="title">{{ theme.title }}</div>

    <h1 class="text" v-html="theme.description" />

    <ul class="list">
      <li
        v-for="(feature, index) in theme.features"
        :key="index"
        v-html="feature"
      ></li>
    </ul>

    <div class="buttons">
      <VPButton
        :text="theme.buttons.getStarted.text"
        :href="theme.buttons.getStarted.link"
      />
      <VPButton
        theme="alt"
        :text="theme.buttons.starOnGitHub.text"
        :href="theme.buttons.starOnGitHub.link"
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
