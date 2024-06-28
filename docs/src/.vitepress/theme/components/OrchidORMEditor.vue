<template>
  <CodeEditor
    name="OrchidORM"
    dir="orchid"
    :query="query"
    :tables="tables"
    :libsPromise="libsPromise"
    :collectSQLsTemplateJS="collectSQLsTemplateJS"
    :vimMode="vimMode"
  />
</template>

<script setup>
import CodeEditor from './CodeEditor.vue';
import { fetchText, fetchTypes, loadLib } from './editor.utils';

const props = defineProps(['query', 'tables', 'vimMode'])

// TODO: unhardcode versions
fetchTypes({
  'orchid-core': 'https://cdn.jsdelivr.net/npm/orchid-core@latest/dist/index.d.ts',
  'pqb': 'https://cdn.jsdelivr.net/npm/pqb@0.36.5/dist/index.d.ts',
  'orchid-orm': 'https://cdn.jsdelivr.net/npm/orchid-orm@1.32.6/dist/index.d.ts',
})

const fetchLibs = {
  'orchid-core': 'https://cdn.jsdelivr.net/npm/orchid-core@latest/dist/index.js',
  'pqb': 'https://cdn.jsdelivr.net/npm/pqb@0.36.5/dist/index.js',
  'orchid-orm': 'https://cdn.jsdelivr.net/npm/orchid-orm@1.32.6/dist/index.js',
}

let libsPromise
for (const name in fetchLibs) {
  libsPromise = libsPromise
    ? libsPromise.then(() => loadLib(name, fetchLibs[name]))
    : loadLib(name, fetchLibs[name])
}

const collectSQLsTemplateJS = (code) => `exports.__promise = (async () => {
${code}
})()`
</script>
