<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'

import { IS_BROWSER, IS_TAURI } from '@/constants'
import { useUII18n } from '@/composables/use-ui-i18n'

const dismissed = useLocalStorage('safari-banner-dismissed', false)
const show = !IS_TAURI && IS_BROWSER && !window.showSaveFilePicker
const { t } = useUII18n()
</script>

<template>
  <div
    v-if="show && !dismissed"
    data-test-id="safari-banner"
    class="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200"
  >
    <span class="flex-1">
      {{ t('safari.message') }}
      <a href="https://www.google.com/chrome/" target="_blank" class="underline">{{
        t('safari.useChrome')
      }}</a>
      {{ ` ${t('safari.edgeSupport')}` }}
    </span>
    <button
      data-test-id="safari-banner-dismiss"
      class="shrink-0 rounded px-1.5 py-0.5 text-amber-300 transition-colors hover:bg-amber-500/20"
      @click="dismissed = true"
    >
      {{ t('safari.dismiss') }}
    </button>
  </div>
</template>
