<template>
  <div class="tabs">
    <h4>{{name}}</h4>
    <button
      v-for="(file, index) in files"
      :key="index"
      @click="selectFile(index)"
      :class="{ active: currentFileIndex === index }"
    >
      {{ file.name }}
    </button>
  </div>
  <div ref="monacoContainer" class="monaco-editor-container"></div>
  <div class="vim-status"></div>
  <div class="sql">
    <div class="language-sql" v-if="sqlHtml" v-html="sqlHtml" />
    <div class="language-sql" v-if="!sqlHtml">
      <Loader />
    </div>
  </div>
</template>

<script setup>
import Loader from './Loader.vue' ;
import { languages, editor as monacoEditor, Uri, KeyCode } from 'monaco-editor';
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { codeToHtml } from 'shiki'
import { esmToCommonjs, execFile, mockAdapter } from './editor.utils';
import { formatDialect, postgresql } from 'sql-formatter';

const getWorker = () => import("monaco-editor/esm/vs/language/typescript/ts.worker?worker").then((m) => new m.default())

window.MonacoEnvironment = {
  getWorker,
};

const getTsWorker = async () => {
  await getWorker()
  return languages.typescript.getTypeScriptWorker();
}

languages.typescript.typescriptDefaults.setCompilerOptions({
  strict: true,
  noImplicitAny: true,
  moduleResolution: languages.typescript.ModuleResolutionKind.NodeJs,
  target: languages.typescript.ScriptTarget.ESNext,
  module: languages.typescript.ModuleKind.ESNext,
  allowNonTsExtensions: true,
});

const props = defineProps([
  'name',
  'dir',
  'query',
  'tables',
  'libsPromise',
  'collectSQLsTemplateJS',
  'vimMode',
]);

let {
  dir,
  query,
  tables,
  libsPromise,
  collectSQLsTemplateJS,
} = props;

if (!query.endsWith('\n')) query += '\n'
if (!tables.endsWith('\n')) tables += '\n'

const files = ref([
  { name: 'Query', code: query, file: `/${dir}/query.ts` },
  { name: 'Tables', code: tables, file: `/${dir}/tables.ts` },
])
const currentFileIndex = ref(0);
const models = files.value.map(({ code, file }) => monacoEditor.createModel(code, 'typescript', Uri.file(file)));

const monacoContainer = ref(null);
const sqlHtml = ref();
let editor

setupEditor()
handlePropsContentChange()
setupVim()

const updateEditorContent = () => {
  editor.setModel(models[currentFileIndex.value])
};

const selectFile = (index) => {
  currentFileIndex.value = index
  if (editor) {
    updateEditorContent();
  }
};

function setupEditor() {
  onMounted(async () => {
    const container = monacoContainer.value

    editor = monacoEditor.create(container, {
      model: models[0],
      theme: 'vs-dark',
      minimap: { enabled: false },
      folding: false,
      lineNumbersMinChars: 3,
      automaticLayout: true,
      glyphMargin: false,
      showFoldingControls: "never",
      overviewRulerLanes: 0,
      padding: { top: 12, bottom: 12 },
      contextmenu: false,
      scrollbar: {
        verticalScrollbarSize: 8,
        verticalSliderSize: 8,
        useShadows: true,
      },
      tabSize: 2,
      scrollBeyondLastLine: false,
    });

    editor.container = container

    // disable F1/F2
    editor.addCommand(KeyCode.F1, () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F1" }));
    });
    editor.addCommand(KeyCode.F2, () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F2" }));
    });

    let filesJS
    const queriesExports = {}
    const updateSql = async () => {
      await libsPromise

      execFile('./tables', filesJS[1])

      mockAdapter.queries.length = 0
      execFile('./queries', collectSQLsTemplateJS(filesJS[0]), queriesExports)

      await queriesExports.__promise;

      const html = await codeToHtml(
        mockAdapter.queries.map(({ sql, values }) => {
          let code = formatDialect(sql, { dialect: postgresql })
          if (!code.endsWith(';')) code += ';'

          if (values?.length) {
            code += `\n-- Parameters:\n${values.map((value, i) => `-- $${i + 1}: ${JSON.stringify(value)}`).join('\n')}\n`;
          }

          return code
        }).join('\n\n'),
        {
          lang: 'sql',
          theme: 'one-dark-pro'
        }
      )

      sqlHtml.value = `<span class="lang">sql</span>${html}`
    }

    editor.onDidChangeModelContent(async () => {
      if (!filesJS) return;

      const worker = await getTsWorker()
      const index = currentFileIndex.value
      const { uri } = models[index]
      const tsFile = await worker(uri)
      const out = await tsFile.getEmitOutput(uri.toString())
      filesJS[index] = esmToCommonjs(out.outputFiles[0].text)
      await updateSql()
    });

    const updateHeight = () => {
      const contentHeight = Math.min(666, editor.getContentHeight());
      container.style.height = `${contentHeight}px`;
      editor.layout()
    };
    editor.onDidContentSizeChange(updateHeight);
    updateHeight();

    const worker = await getTsWorker();

    filesJS = await Promise.all(models.map(async ({ uri }) => {
      const tsFile = await worker(uri)
      const out = await tsFile.getEmitOutput(uri.toString())
      return esmToCommonjs(out.outputFiles[0].text)
    }));

    await updateSql()
  })

  onBeforeUnmount(() => {
    if (editor) {
      editor.dispose()
    }

    for (const model of monacoEditor.getModels()) {
      model.dispose()
    }
  })
}

function handlePropsContentChange() {
  watch(() => props.query, () => {
    const query = props.query.endsWith('\n') ? props.query : `${props.query}\n`
    const tables = props.tables.endsWith('\n') ? props.tables : `${props.tables}\n`

    files.value[0].code = query
    files.value[1].code = tables
    currentFileIndex.value = 0

    for (const model of monacoEditor.getModels()) {
      if (model.uri.path === `/${dir}/query.ts`) {
        model.setValue(query)
      } else if (model.uri.path === `/${dir}/tables.ts`) {
        model.setValue(tables)
      }
    }
  })
}

function setupVim() {
  if (props.vimMode) startVim();

  watch(() => props.vimMode, () => (props.vimMode ? startVim : stopVim)());

  let vimInstance;

  async function startVim() {
    const { initVimMode } = await import('monaco-vim');
    if (props.vimMode) {
      vimInstance = initVimMode(editor, editor.container.parentNode.querySelector('.vim-status'));
    }
  }

  function stopVim() {
    if (vimInstance) {
      vimInstance.dispose();
    }
  }
}
</script>

<style>
.monaco-editor-container {
  width: 100%;
}

.monaco-editor {
  width: 100% !important;
}

.tabs {
  display: flex;
  align-items: center;
}

.tabs h4 {
  margin: 0;
  padding: 0 12px;
}

.tabs button {
  padding: 10px 20px;
  cursor: pointer;
  border: none;
  background: none;
  outline: none;
}

.tabs button.active {
  border-bottom: 2px solid #007acc;
}

.sql > .language-sql {
  margin-top: 0 !important;
  border-top-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
}

.vim-status {
  background: #1e1e1e;
  font-size: 13px;
  text-align: right;
  padding-right: 8px;
}
</style>
