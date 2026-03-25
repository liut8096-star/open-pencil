<script setup lang="ts">
import { useFileDialog, useObjectUrl } from '@vueuse/core'
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'
import { computed, ref, shallowRef } from 'vue'

import ProviderSettings from '@/components/chat/ProviderSettings.vue'
import { uiButton } from '@/components/ui/button'
import { uiInput } from '@/components/ui/input'
import { selectContent, selectItem, selectTrigger } from '@/components/ui/select'
import { useAIChat } from '@/composables/use-chat'
import { useUII18n } from '@/composables/use-ui-i18n'

import { ACP_AGENTS } from '@open-pencil/core'

const { providerID, providerDef, modelID, customModelID } = useAIChat()
const { t } = useUII18n()

const { status } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
}>()

const emit = defineEmits<{
  submit: [payload: { text: string; files: File[] }]
  stop: []
}>()

const input = ref('')
const imageFile = shallowRef<File | null>(null)
const imagePreviewUrl = useObjectUrl(imageFile)

const { open: pickImage, onChange: onPickImage } = useFileDialog({
  accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif',
  multiple: false,
  reset: true
})

const isStreaming = computed(() => status === 'streaming' || status === 'submitted')
const isACPProvider = computed(() => providerID.value.startsWith('acp:'))
const acpAgentName = computed(() => {
  const agentId = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === agentId)?.name ?? agentId
})
const isCustomProvider = computed(
  () => providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
)

const selectedModelName = computed(() => {
  if (isCustomProvider.value) return customModelID.value || 'No model'
  return providerDef.value.models.find((m) => m.id === modelID.value)?.name ?? modelID.value
})
const canSubmit = computed(() => Boolean(input.value.trim()) || imageFile.value !== null)

onPickImage((files) => {
  imageFile.value = files?.[0] ?? null
})

function clearImage() {
  imageFile.value = null
}

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  const files = imageFile.value ? [imageFile.value] : []
  if (!text && files.length === 0) return
  emit('submit', { text, files })
  input.value = ''
  clearImage()
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border px-3 py-2">
      <!-- Model selector & settings -->
      <div class="mb-1.5 flex items-center gap-1">
        <template v-if="isACPProvider">
          <div class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted">
            <icon-lucide-bot class="size-3" />
            {{ acpAgentName }}
          </div>
        </template>
        <template v-else-if="isCustomProvider">
          <div
            class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted"
            data-test-id="chat-custom-model-label"
          >
            <icon-lucide-bot class="size-3" />
            {{ selectedModelName }}
          </div>
        </template>
        <SelectRoot v-else v-model="modelID">
          <SelectTrigger
            data-test-id="chat-model-selector"
            :class="
              selectTrigger({
                class:
                  'gap-1 rounded border-none bg-transparent px-1.5 py-0.5 text-[10px] text-muted'
              })
            "
          >
            <icon-lucide-bot class="size-3" />
            {{ selectedModelName }}
            <icon-lucide-chevron-down class="size-2.5" />
          </SelectTrigger>
          <SelectPortal>
            <SelectContent
              position="popper"
              side="top"
              :side-offset="4"
              :class="
                selectContent({ radius: 'lg', padding: 'md', class: 'max-h-60 overflow-y-auto' })
              "
            >
              <SelectViewport>
                <SelectItem
                  v-for="model in providerDef.models"
                  :key="model.id"
                  :value="model.id"
                  :class="selectItem({ class: 'gap-2 rounded px-2 py-1.5 text-[11px]' })"
                >
                  <SelectItemText class="flex-1">{{ model.name }}</SelectItemText>
                  <span
                    v-if="model.tag"
                    class="rounded bg-accent/10 px-1 py-px text-[9px] text-accent"
                  >
                    {{ model.tag }}
                  </span>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>

        <div class="ml-auto">
          <ProviderSettings />
        </div>
      </div>

      <div class="rounded-2xl border border-border bg-input/60 p-1.5">
        <div v-if="imageFile && imagePreviewUrl" class="mb-1.5">
          <div
            class="flex items-center gap-2 rounded-xl border border-border bg-panel px-2 py-2"
            data-test-id="chat-image-preview"
          >
            <img
              :src="imagePreviewUrl"
              :alt="imageFile.name"
              class="size-12 shrink-0 rounded-lg border border-border object-cover"
            />
            <div class="min-w-0 flex-1">
              <div class="truncate text-[11px] font-medium text-surface">{{ imageFile.name }}</div>
              <div class="text-[10px] text-muted">{{ t('chat.imageReady') }}</div>
            </div>
            <button
              type="button"
              :class="
                uiButton({
                  tone: 'ghost',
                  shape: 'rounded',
                  size: 'sm',
                  class: 'shrink-0 border border-border px-2 py-1.5'
                })
              "
              :disabled="isStreaming"
              @click="clearImage"
            >
              <icon-lucide-x class="size-3" />
            </button>
          </div>
        </div>

        <!-- Input form -->
        <form class="flex items-center gap-1.5" @submit="handleSubmit">
          <TooltipRoot>
            <TooltipTrigger as-child>
              <button
                type="button"
                data-test-id="chat-image-button"
                :class="
                  uiButton({
                    tone: imageFile ? 'accent' : 'ghost',
                    shape: 'rounded',
                    size: 'sm',
                    class: 'shrink-0 border border-border px-2 py-1.5'
                  })
                "
                :disabled="isStreaming"
                @click="pickImage"
              >
                <icon-lucide-plus class="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="top"
                :side-offset="4"
                class="rounded bg-surface px-2 py-1 text-[10px] text-canvas"
              >
                {{ t('chat.addImage') }}
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>

          <input
            v-model="input"
            type="text"
            data-test-id="chat-input"
            :placeholder="t('chat.inputPlaceholder')"
            :class="
              uiInput({
                class:
                  'min-w-0 flex-1 border-none bg-transparent placeholder:text-muted focus:border-none'
              })
            "
            :disabled="isStreaming"
            @paste.stop
            @copy.stop
            @cut.stop
          />

          <TooltipRoot v-if="isStreaming">
            <TooltipTrigger as-child>
              <button
                type="button"
                data-test-id="chat-stop-button"
                :class="
                  uiButton({
                    tone: 'ghost',
                    shape: 'rounded',
                    size: 'sm',
                    class: 'shrink-0 border border-border px-2 py-1.5'
                  })
                "
                @click="emit('stop')"
              >
                <icon-lucide-square class="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="top"
                :side-offset="4"
                class="rounded bg-surface px-2 py-1 text-[10px] text-canvas"
              >
                {{ t('chat.stopGenerating') }}
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
          <TooltipRoot v-else>
            <TooltipTrigger as-child>
              <button
                type="submit"
                data-test-id="chat-send-button"
                :class="
                  uiButton({
                    tone: 'accent',
                    shape: 'rounded',
                    size: 'sm',
                    class: 'shrink-0 px-2.5 py-1.5 font-medium'
                  })
                "
                :disabled="!canSubmit"
              >
                <icon-lucide-send class="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent
                side="top"
                :side-offset="4"
                class="rounded bg-surface px-2 py-1 text-[10px] text-canvas"
              >
                {{ t('chat.sendMessage') }}
              </TooltipContent>
            </TooltipPortal>
          </TooltipRoot>
        </form>
      </div>
    </div>
  </TooltipProvider>
</template>
