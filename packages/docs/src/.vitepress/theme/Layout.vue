<script setup>
import DefaultTheme from 'vitepress/theme'
import { useRouter } from 'vitepress';
import { watch } from "vue";

const router = useRouter();

// Only run this on the client. Not during build.
if (typeof window !== 'undefined') {
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
        Stand With Ukraine
        <div class='flag'></div>
      </a>
    </template>
  </Layout>
</template>
