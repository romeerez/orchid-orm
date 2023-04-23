<script setup>
import DefaultTheme from 'vitepress/theme'
import { useRouter } from 'vitepress';
import { watch } from "vue";

// localStorage and window are not available during the build
const isBuild = typeof window === 'undefined'

if (!isBuild && !localStorage.getItem('vitepress-theme-appearance')) {
  document.documentElement.classList.add('dark')
  localStorage.setItem('vitepress-theme-appearance', 'dark')
}

const router = useRouter();

// Only run this on the client. Not during build.
if (!isBuild) {
  window.dataLayer = window.dataLayer || []
  function gtag(){ dataLayer.push(arguments) }
  gtag('js', new Date())

  const analyticsId = 'G-PV4PL9TK79'
  gtag('config', analyticsId)

  watch(() => router.route.data.relativePath, () => {
    setTimeout(() => {
      gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
        send_to: analyticsId,
      });
    })
  }, { immediate: true });
}

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template v-slot:nav-bar-content-before>
      <a
        href='https://stand-with-ukraine.pp.ua/'
        class='stand-with-ukraine'
      >
        <div class='flag'></div>
        <div class='text'>
          <span class='stand-with'>Stand With </span>
          <span class='Ukraine'>Ukraine</span>
        </div>
      </a>
    </template>
  </Layout>
</template>
