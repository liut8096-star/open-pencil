<script setup lang="ts">
import {useFileDialog} from '@vueuse/core'
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
import {computed, onBeforeUnmount, ref, shallowRef, watch} from 'vue'

import ProviderSettings from '@/components/chat/ProviderSettings.vue'
import {uiInput} from '@/components/ui/input'
import {selectContent, selectItem, selectTrigger} from '@/components/ui/select'
import {useAIChat} from '@/composables/use-chat'
import {useUII18n} from '@/composables/use-ui-i18n'

import {ACP_AGENTS} from '@open-pencil/core'

import type {FileUIPart} from 'ai'

const { providerID, providerDef, modelID, customModelID } = useAIChat()
const { t } = useUII18n()

const { status } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
}>()

const emit = defineEmits<{
  submit: [payload: { text: string; files: FileUIPart[] }]
  stop: []
}>()

const input = ref('')
const imageFiles = shallowRef<File[]>([])
const imagePreviewUrls = ref<string[]>([])

const { open: pickImage, onChange: onPickImage } = useFileDialog({
  accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif',
  multiple: true,
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
const canSubmit = computed(() => Boolean(input.value.trim()) || imageFiles.value.length > 0)

onPickImage((files) => {
  if (!files?.length) return
  const next = Array.from(files)
  imageFiles.value = dedupeFiles([...imageFiles.value, ...next])
})

watch(
    imageFiles,
    (files) => {
      for (const url of imagePreviewUrls.value) URL.revokeObjectURL(url)
      imagePreviewUrls.value = files.map((file) => URL.createObjectURL(file))
    },
    {immediate: true}
)

onBeforeUnmount(() => {
  for (const url of imagePreviewUrls.value) URL.revokeObjectURL(url)
})

function removeImage(index: number) {
  imageFiles.value = imageFiles.value.filter((_, i) => i !== index)
}

function clearImages() {
  imageFiles.value = []
}

async function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  const files =
      imageFiles.value.length > 0
          ? await Promise.all(imageFiles.value.map((file) => fileToUIPart(file)))
          : []
  if (!text && files.length === 0) return
  emit('submit', { text, files })
  input.value = ''
  clearImages()
}

function fileToUIPart(file: File): Promise<FileUIPart> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        type: 'file',
        mediaType: file.type || 'application/octet-stream',
        filename: file.name,
        url: String(reader.result ?? '')
      })
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read image file'))
    }
    reader.readAsDataURL(file)
  })
}

function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>()
  return files.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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

      <div
          class="rounded-[28px] border border-border/80 bg-panel px-2 py-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
      >
        <div v-if="imageFiles.length > 0" class="mb-2 space-y-1.5">
          <div class="px-1 text-[10px] text-muted">
            {{ t('chat.imagesReady', {count: imageFiles.length}) }}
          </div>
          <div class="flex flex-wrap gap-2" data-test-id="chat-image-preview">
            <div
                v-for="(file, index) in imageFiles"
                :key="`${file.name}-${file.lastModified}-${file.size}`"
                class="group relative"
            >
              <img
                  :alt="file.name"
                  :src="imagePreviewUrls[index]"
                  class="size-14 rounded-xl border border-border bg-panel object-cover"
              />
              <button
                  :disabled="isStreaming"
                  class="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-surface text-canvas shadow-sm transition-opacity group-hover:opacity-100 md:opacity-0"
                  type="button"
                  @click="removeImage(index)"
              >
                <icon-lucide-x class="size-3"/>
              </button>
            </div>
          </div>
        </div>

        <!-- Input form -->
        <form class="flex items-center gap-1" @submit="handleSubmit">
          <TooltipRoot>
            <TooltipTrigger as-child>
              <button
                type="button"
                data-test-id="chat-image-button"
                class="flex size-8 shrink-0 items-center justify-center rounded-full border-none bg-transparent p-0 text-surface transition-colors hover:bg-hover/60"
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
                  'min-w-0 flex-1 border-none bg-transparent px-1 text-[13px] placeholder:text-muted focus:border-none'
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
                class="flex size-8 shrink-0 items-center justify-center rounded-full border-none bg-transparent p-0 text-muted transition-colors hover:bg-hover/60 hover:text-surface"
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
                  canSubmit
                    ? 'bg-surface text-panel shadow-[0_6px_16px_rgba(15,23,42,0.16)] hover:scale-[1.03]'
                    : 'bg-transparent text-muted'
                "
                class="flex size-8 shrink-0 items-center justify-center rounded-full border-none p-0 transition-all"
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
