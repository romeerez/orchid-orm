<script setup>
  import OrchidORMEditor from './OrchidORMEditor.vue';
  import KyselyEditor from './KyselyEditor.vue';
  import {
    compareWithKyselyCodeExamples,
    tables,
  } from './compare-with-kysely-code-examples';
  import { ref, watch, onMounted, onUnmounted } from 'vue';

  const orms = ['orchid', 'kysely'];

  for (const key in compareWithKyselyCodeExamples) {
    for (const example of compareWithKyselyCodeExamples[key]) {
      example.id = `${key.toLocaleLowerCase()}-${example.name.toLowerCase().replaceAll(' ', '-')}`

      for (const orm of orms) {
        if (typeof example[orm] === 'string') {
          example[orm] = { query: example[orm] };
        }

        example[orm].tables ??= tables[orm];
      }
    }
  }

  const anchor = ref(null);
  const example = ref(null);

  const findExample = () => {
    for (const key in compareWithKyselyCodeExamples) {
      for (const example of compareWithKyselyCodeExamples[key]) {
        if (example.id === anchor.value) {
          return example;
        }
      }
    }
  }

  const updateAnchor = () => {
    anchor.value = window.location.hash.slice(1) || compareWithKyselyCodeExamples.Select[0].id
    example.value = findExample()

    const arr = orms.map((orm) => ({
      orm,
      lines: example.value[orm].query.split('\n'),
    }))

    const max = Math.max(...arr.map((x) => x.lines.length))
    for (const x of arr) {
      if (x.lines.length < max) {
        x.lines.push(...Array.from({ length: max - x.lines.length }).fill(''))
        example.value[x.orm].query = x.lines.join('\n');
      }
    }
  };
  updateAnchor();

  onMounted(() => {
    window.addEventListener('hashchange', updateAnchor);
    updateAnchor();
  });

  onUnmounted(() => {
    window.removeEventListener('hashchange', updateAnchor);
  });

  const vimMode = ref(localStorage.getItem('vimMode') === 'true');

  watch(vimMode, (value) => {
    localStorage.setItem('vimMode', String(value));
  });
</script>

<template>
<div class="all-examples">
  <div v-for="(examples, key) in compareWithKyselyCodeExamples" class="examples-set">
    <h3 class="examples-title">{{key}}</h3>
    <span v-for="example in examples" :class="{ 'example-link': true, active: example.id === anchor }">
      <a :href="`#${example.id}`">{{example.name}}</a>
    </span>
  </div>
</div>

<div class="example-text" v-html="example.text?.trim().replace(/\n\s*\n/g, '<br/><br/>')"></div>

<div class="editors">
  <div class="editor">
    <OrchidORMEditor :query='example.orchid.query' :tables="example.orchid.tables" :vimMode="vimMode" />
  </div>
  <div class="editor">
    <KyselyEditor :query='example.kysely.query' :tables="example.kysely.tables" :vimMode="vimMode" />
  </div>
</div>

<div style="display: flex; justify-content: flex-end">
  <div id="vimStatus"></div>
  <label><input type="checkbox" v-model="vimMode" /> VIM mode</label>
</div>
</template>

<style>
.main {
  max-width: 1150px;
}

.example-text {
  margin: 32px 0 16px;
  line-height: 28px;
}

.editors {
  display: flex;
  gap: 24px;
}

.editor {
  width: 50%;
}

.all-examples {
  gap: 32px;
  column-width: 200px;
}

.examples-set {
  page-break-inside: avoid;
  break-inside: avoid-column;
  display: flex;
  flex-direction: column;
}

.examples-set h3 {
  margin-bottom: 12px
}

.example-link {
  padding: 4px 0;
  color: rgba(199, 195, 205, 0.67);
}

.example-link a {
  text-decoration: none;
}

.example-link + .example-link {
  border-top: 0;
}

.example-link a {
  color: inherit;
}

.example-link.active a {
  color: var(--vp-c-brand)
}

@media (max-width: 1050px) {
  .VPSidebar {
    width: calc(100vw - 64px) !important;
    max-width: 320px !important;
    background-color: var(--vp-sidebar-bg-color) !important;
    opacity: 0 !important;
    transform: translateX(-100%) !important;
  }

  .VPNav {
    position: relative !important;
  }

  .VPLocalNav {
    display: block !important;
    padding-left: 0 !important;
    top: 0 !important;
  }

  .menu {
    display: flex !important;
    padding: 12px 24px 11px !important;
  }

  .VPContent.has-sidebar {
    margin: 0 !important;
    padding-left: 0 !important;
  }
}

@media (max-width: 780px) {
  .editors {
    flex-direction: column;
  }

  .editor {
    width: 100%;
  }
}
</style>
