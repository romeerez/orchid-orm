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

const props = defineProps(['query', 'tables', 'vimMode']);

fetchTypes({
  pqb: 'https://cdn.jsdelivr.net/npm/pqb@latest/dist/index.d.ts',
  'orchid-orm':
    'https://cdn.jsdelivr.net/npm/orchid-orm@latest/dist/index.d.ts',
});

const fetchLibs = {
  pqb: 'https://cdn.jsdelivr.net/npm/pqb@latest/dist/index.js',
  'orchid-orm': 'https://cdn.jsdelivr.net/npm/orchid-orm@latest/dist/index.js',
};

let libsPromise;
for (const name in fetchLibs) {
  libsPromise = libsPromise
    ? libsPromise.then(() => loadLib(name, fetchLibs[name]))
    : loadLib(name, fetchLibs[name]);
}

const collectSQLsTemplateJS = (code) => `exports.__promise = (async () => {
${code}
})()`;
</script>
