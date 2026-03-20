<script setup lang="ts">
import { computed } from 'vue'

import { useUII18n } from '@/composables/use-ui-i18n'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()
const emit = defineEmits<{ openDialog: [] }>()
const { t } = useUII18n()

const collectionCount = computed(() => {
  void store.state.sceneVersion
  return store.graph.variableCollections.size
})

const variableCount = computed(() => {
  void store.state.sceneVersion
  return store.graph.variables.size
})
</script>

<template>
  <div data-test-id="variables-section" class="border-b border-border px-3 py-2">
    <div class="flex items-center justify-between">
      <label class="text-[11px] font-medium text-surface">{{ t('prop.variables') }}</label>
      <button
        data-test-id="variables-section-open"
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
        :title="t('prop.openVariables')"
        @click="emit('openDialog')"
      >
        <icon-lucide-settings-2 class="size-3.5" />
      </button>
    </div>
    <div v-if="variableCount > 0" class="mt-1 text-[11px] text-muted">
      {{ t('variablesDialog.summary', { variables: variableCount, collections: collectionCount }) }}
    </div>
    <div v-else class="mt-1 text-[11px] text-muted">{{ t('prop.noLocalVariables') }}</div>
  </div>
</template>
