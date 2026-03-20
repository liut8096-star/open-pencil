<script setup lang="ts">
import {
  PopoverClose,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import ProviderSelect from '@/components/chat/ProviderSelect.vue'
import { uiInput } from '@/components/ui/input'
import { useAIChat } from '@/composables/use-chat'
import { useUII18n } from '@/composables/use-ui-i18n'

const {
  providerID,
  providerDef,
  apiKey,
  setAPIKey,
  customBaseURL,
  customModelID,
  customAPIType,
  maxOutputTokens,
  pexelsApiKey,
  unsplashAccessKey
} = useAIChat()
const { t } = useUII18n()

const isACP = computed(() => providerID.value.startsWith('acp:'))

const keyInput = ref('')
const pexelsKeyInput = ref('')
const unsplashKeyInput = ref('')
const baseURLInput = ref(customBaseURL.value)
const customModelInput = ref(customModelID.value)
const hasExistingKey = ref(!!apiKey.value)
const hasExistingPexelsKey = ref(!!pexelsApiKey.value)
const hasExistingUnsplashKey = ref(!!unsplashAccessKey.value)

watch(providerID, () => {
  keyInput.value = ''
  hasExistingKey.value = !!apiKey.value
  baseURLInput.value = customBaseURL.value
  customModelInput.value = customModelID.value
})

function save() {
  if (keyInput.value.trim()) {
    setAPIKey(keyInput.value.trim())
    hasExistingKey.value = true
    keyInput.value = ''
  }
  if (pexelsKeyInput.value.trim()) {
    pexelsApiKey.value = pexelsKeyInput.value.trim()
    hasExistingPexelsKey.value = true
    pexelsKeyInput.value = ''
  }
  if (unsplashKeyInput.value.trim()) {
    unsplashAccessKey.value = unsplashKeyInput.value.trim()
    hasExistingUnsplashKey.value = true
    unsplashKeyInput.value = ''
  }
  if (providerDef.value.supportsCustomBaseURL) {
    customBaseURL.value = baseURLInput.value.trim()
  }
  if (providerDef.value.supportsCustomModel) {
    customModelID.value = customModelInput.value.trim()
  }
}

function clearKey() {
  setAPIKey('')
  keyInput.value = ''
  hasExistingKey.value = false
}

function clearPexelsKey() {
  pexelsApiKey.value = ''
  pexelsKeyInput.value = ''
  hasExistingPexelsKey.value = false
}

function clearUnsplashKey() {
  unsplashAccessKey.value = ''
  unsplashKeyInput.value = ''
  hasExistingUnsplashKey.value = false
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger
      data-test-id="provider-settings-trigger"
      class="rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
      :title="t('provider.settings')"
    >
      <icon-lucide-settings class="size-3" />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="end"
        :collision-padding="16"
        :avoid-collisions="true"
        class="isolate z-[51] w-64 rounded-lg border border-border bg-panel p-3 shadow-lg"
        @interact-outside="
          (e: Event) => {
            const target = e.target as HTMLElement | null
            if (target?.closest('[role=listbox], [data-reka-popper-content-wrapper]')) {
              e.preventDefault()
              return
            }
            save()
          }
        "
      >
        <div class="flex flex-col gap-2.5">
          <h3 class="text-[11px] font-semibold text-surface">{{ t('provider.title') }}</h3>

          <ProviderSelect test-id="provider-settings-provider" />

          <!-- Max output tokens -->
          <div v-if="!isACP" class="flex flex-col gap-1">
            <label class="text-[10px] text-muted">{{ t('provider.maxOutputTokens') }}</label>
            <input
              v-model.number="maxOutputTokens"
              type="number"
              data-test-id="provider-settings-max-tokens"
              :min="1024"
              :max="128000"
              :step="1024"
              :class="uiInput({ size: 'sm' })"
            />
          </div>

          <!-- Pexels stock photos -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <label class="text-[10px] text-muted">{{ t('provider.pexelsKey') }}</label>
              <button
                v-if="pexelsApiKey"
                class="cursor-pointer text-[10px] text-muted hover:text-surface"
                data-test-id="provider-settings-clear-pexels-key"
                @click="clearPexelsKey"
              >
                {{ t('provider.clear') }}
              </button>
            </div>
            <input
              v-model="pexelsKeyInput"
              type="password"
              data-test-id="provider-settings-pexels-key"
              :placeholder="
                hasExistingPexelsKey ? t('provider.savedReplace') : t('provider.pexelsPlaceholder')
              "
              :class="uiInput({ size: 'sm' })"
              @change="save"
            />
            <a
              href="https://www.pexels.com/api/"
              target="_blank"
              class="text-[9px] text-muted underline hover:text-surface"
            >
              {{ t('provider.getPexelsKey') }}
            </a>
          </div>

          <!-- Unsplash stock photos -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <label class="text-[10px] text-muted">{{ t('provider.unsplashKey') }}</label>
              <button
                v-if="unsplashAccessKey"
                class="cursor-pointer text-[10px] text-muted hover:text-surface"
                data-test-id="provider-settings-clear-unsplash-key"
                @click="clearUnsplashKey"
              >
                {{ t('provider.clear') }}
              </button>
            </div>
            <input
              v-model="unsplashKeyInput"
              type="password"
              data-test-id="provider-settings-unsplash-key"
              :placeholder="
                hasExistingUnsplashKey
                  ? t('provider.savedReplace')
                  : t('provider.unsplashPlaceholder')
              "
              :class="uiInput({ size: 'sm' })"
              @change="save"
            />
            <a
              href="https://unsplash.com/oauth/applications"
              target="_blank"
              class="text-[9px] text-muted underline hover:text-surface"
            >
              {{ t('provider.getUnsplashKey') }}
            </a>
          </div>

          <template v-if="!isACP">
            <!-- Base URL (OpenAI-compatible only) -->
            <div v-if="providerDef.supportsCustomBaseURL" class="flex flex-col gap-1">
              <label class="text-[10px] text-muted">{{ t('provider.baseUrl') }}</label>
              <input
                v-model="baseURLInput"
                type="text"
                data-test-id="provider-settings-base-url"
                :placeholder="t('provider.baseUrlPlaceholder')"
                :class="uiInput({ size: 'sm' })"
                @change="save"
              />
            </div>

            <!-- Custom model ID (OpenAI-compatible only) -->
            <div v-if="providerDef.supportsCustomModel" class="flex flex-col gap-1">
              <label class="text-[10px] text-muted">{{ t('provider.modelId') }}</label>
              <input
                v-model="customModelInput"
                type="text"
                data-test-id="provider-settings-custom-model"
                :placeholder="t('provider.modelPlaceholder')"
                :class="uiInput({ size: 'sm' })"
                @change="save"
              />
            </div>

            <!-- API type (OpenAI-compatible only) -->
            <div v-if="providerID === 'openai-compatible'" class="flex flex-col gap-1">
              <label class="text-[10px] text-muted">{{ t('provider.apiType') }}</label>
              <TabsRoot
                :model-value="customAPIType"
                data-test-id="provider-settings-api-type"
                class="flex flex-col"
                @update:model-value="
                  (v: string) => {
                    customAPIType = v as 'completions' | 'responses'
                    save()
                  }
                "
              >
                <TabsList class="flex rounded bg-canvas">
                  <TabsTrigger
                    value="completions"
                    class="flex-1 rounded px-2 py-1 text-[10px] text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
                  >
                    {{ t('provider.completions') }}
                  </TabsTrigger>
                  <TabsTrigger
                    value="responses"
                    class="flex-1 rounded px-2 py-1 text-[10px] text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
                  >
                    {{ t('provider.responses') }}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="completions" />
                <TabsContent value="responses" />
              </TabsRoot>
            </div>

            <!-- API key -->
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <label class="text-[10px] text-muted">{{ t('provider.apiKey') }}</label>
                <button
                  v-if="apiKey"
                  class="cursor-pointer text-[10px] text-muted hover:text-surface"
                  data-test-id="provider-settings-clear-key"
                  @click="clearKey"
                >
                  {{ t('provider.clear') }}
                </button>
              </div>
              <input
                v-model="keyInput"
                type="password"
                data-test-id="provider-settings-api-key"
                :placeholder="
                  hasExistingKey ? t('provider.savedReplace') : providerDef.keyPlaceholder
                "
                :class="uiInput({ size: 'sm' })"
                @change="save"
              />
              <a
                v-if="providerDef.keyURL"
                :href="providerDef.keyURL"
                target="_blank"
                class="text-[9px] text-muted underline hover:text-surface"
              >
                {{ t('provider.getApiKey') }}
              </a>
            </div>
          </template>

          <PopoverClose
            class="mt-1 w-full rounded bg-accent px-2 py-1 text-center text-[11px] font-medium text-white hover:bg-accent/90"
            data-test-id="provider-settings-done"
            @click="save"
          >
            {{ t('provider.done') }}
          </PopoverClose>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
