<template>
  <CodeEditor
    name="Kysely"
    dir="kysely"
    :query="query"
    :tables="tables"
    :libsPromise="libsPromise"
    :collectSQLsTemplateJS="collectSQLsTemplateJS"
    :vimMode="vimMode"
  />
</template>
<script setup>
import CodeEditor from './CodeEditor.vue';
import { fetchJSON, fetchText, fetchType, loadLib } from './editor.utils';
import { languages } from 'monaco-editor';

const props = defineProps(['query', 'tables', 'vimMode'])

const libsPromise = new Promise(async (resolve, reject) => {
  Promise.all(
    [
      fetchType('pg', 'https://cdn.jsdelivr.net/npm/@types/pg@latest/index.d.ts'),
      fetchJSON('https://api.github.com/repos/wirekang/minified-kysely/git/refs/heads/main').then(async (branchInfo) => {
        const rootURL = `https://cdn.jsdelivr.net/gh/wirekang/minified-kysely@${branchInfo.object.sha}`
        const info = await fetchJSON(`${rootURL}/dist/info.json`)
        const { dir, files } = info.tags[info.tags.length - 1]

        const baseURL = `${rootURL}/${dir}`

        const sqlFile = files.find((file) => file.startsWith('sql') && file.endsWith('.js'))

        await Promise.all([
          await loadLib(`kysely/${sqlFile}`, `${baseURL}/${sqlFile}`, true)
            .then(() =>
              Promise.all(
                files
                  .filter((file) =>
                    file.endsWith('.js') &&
                    file !== sqlFile &&
                    file !== 'index.js' &&
                    (file === 'helpers/postgres.js' || !file.startsWith('helpers/'))
                  )
                  .map((file) =>
                    loadLib(`kysely/${file}`, `${baseURL}/${file}`, true)
                  )
              )
            )
            .then(() =>
              loadLib('kysely', `${baseURL}/index.js`, true)
            )
            .then(resolve),
          ...files
            .filter((file) => file.endsWith('.d.ts'))
            .map(async (file) => {
              const code = await fetchText(`${baseURL}/${file}`)
              languages.typescript.typescriptDefaults.addExtraLib(
                code,
                `file:///node_modules/kysely/${file}`
              )
            })
        ])
      }),
    ]
  ).catch(reject)
})

const collectSQLsTemplateJS = (code) => `exports.__promise = (async () => {
${code}
})()`;
</script>
