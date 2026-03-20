<script setup lang="ts">
import { onMounted } from 'vue'
import { useHead } from '@unhead/vue'

import AppToast from '@/components/AppToast.vue'
import { initUIPreferences } from '@/composables/use-ui-preferences'
import { toast } from '@/composables/use-toast'

useHead({ titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil') })
initUIPreferences()

onMounted(() => {
  toast.setupGlobalErrorHandler()
})
</script>

<template>
  <RouterView />
  <AppToast />
</template>
