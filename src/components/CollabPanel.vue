<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  TooltipProvider
} from 'reka-ui'

import { colorToCSS } from '@open-pencil/core'
import { useCollabInjected } from '@/composables/use-collab'
import { useUII18n } from '@/composables/use-ui-i18n'
import { toast } from '@/composables/use-toast'
import { initials } from '@/utils/text'

const route = useRoute()
const router = useRouter()
const collab = useCollabInjected()
const { t } = useUII18n()

const joinInput = ref('')
const nameDraft = ref(collab.state.value.localName)
const copied = ref(false)
const pendingRoomId = (route.params.roomId as string) || null
const popoverOpen = ref(!!pendingRoomId)

const state = computed(() => collab.state.value)
const peers = computed(() => collab.remotePeers.value)
const followingPeer = computed(() => collab.followingPeer.value)

const shareUrl = computed(() => {
  if (!state.value.roomId) return ''
  return `${window.location.origin}/share/${state.value.roomId}`
})

const isJoining = computed(() => !!pendingRoomId && !state.value.connected)

function copyLink() {
  if (!shareUrl.value) return
  navigator.clipboard.writeText(shareUrl.value)
  toast.show(t('collab.linkCopied'))
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function onShare() {
  if (!nameDraft.value.trim()) return
  collab.setLocalName(nameDraft.value.trim())
  const roomId = collab.shareCurrentDoc()
  router.push(`/share/${roomId}`)
  navigator.clipboard.writeText(`${window.location.origin}/share/${roomId}`)
  toast.show(t('collab.linkCopied'))
  popoverOpen.value = false
}

function onJoin() {
  const roomId = pendingRoomId || joinInput.value.trim().replace(/.*\/share\//, '')
  if (!roomId || !nameDraft.value.trim()) return
  collab.setLocalName(nameDraft.value.trim())
  collab.connect(roomId)
  router.push(`/share/${roomId}`)
  popoverOpen.value = false
}

function onDisconnect() {
  collab.disconnect()
  router.push('/')
}
</script>

<template>
  <div class="flex w-full items-center justify-end gap-2">
    <!-- Avatar stack -->
    <TooltipProvider :delay-duration="200">
      <div class="flex -space-x-1.5">
        <TooltipRoot>
          <TooltipTrigger as-child>
            <div
              data-test-id="collab-local-avatar"
              class="flex size-6 items-center justify-center rounded-full border-2 border-panel text-[10px] font-semibold text-white"
              :style="{ background: colorToCSS(state.localColor) }"
            >
              {{ initials(state.localName || t('collab.you')) }}
            </div>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              class="rounded border border-border bg-panel px-2 py-1 text-xs text-surface shadow-lg"
              :side-offset="4"
            >
              {{ state.localName || t('collab.you') }} ({{ t('collab.youTag') }})
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>

        <TooltipRoot v-for="peer in peers" :key="peer.clientId">
          <TooltipTrigger as-child>
            <div
              data-test-id="collab-peer-avatar"
              class="flex size-6 cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white transition-all"
              :class="
                followingPeer === peer.clientId
                  ? 'border-white ring-2 ring-white/40'
                  : 'border-panel'
              "
              :style="{ background: colorToCSS(peer.color) }"
              @click="collab.followPeer(followingPeer === peer.clientId ? null : peer.clientId)"
            >
              {{ initials(peer.name) }}
            </div>
          </TooltipTrigger>
          <TooltipPortal>
            <TooltipContent
              class="rounded border border-border bg-panel px-2 py-1 text-xs text-surface shadow-lg"
              :side-offset="4"
            >
              {{
                followingPeer === peer.clientId
                  ? t('collab.followingPeer', { name: peer.name })
                  : t('collab.followPeer', { name: peer.name })
              }}
            </TooltipContent>
          </TooltipPortal>
        </TooltipRoot>
      </div>
    </TooltipProvider>

    <div class="flex-1" />

    <!-- Share button / popover -->
    <PopoverRoot v-model:open="popoverOpen">
      <PopoverTrigger as-child>
        <button
          data-test-id="collab-share-button"
          class="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-none px-3 text-xs font-medium transition-colors"
          :class="
            state.connected
              ? 'bg-green-600 text-white hover:bg-green-700'
              : isJoining
                ? 'animate-pulse bg-amber-600 text-white'
                : 'bg-accent text-white hover:bg-accent/90'
          "
        >
          <icon-lucide-share-2 class="size-3.5" />
          {{
            state.connected
              ? t('collab.connected')
              : isJoining
                ? t('collab.joinRoom')
                : t('collab.share')
          }}
        </button>
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverContent
          data-test-id="collab-popover"
          class="z-50 w-72 rounded-lg border border-border bg-panel p-3 shadow-xl"
          :side-offset="8"
          side="bottom"
          align="end"
        >
          <!-- Connected state -->
          <template v-if="state.connected">
            <div class="mb-3 text-xs font-medium text-surface">{{ t('collab.roomLink') }}</div>
            <div class="mb-3 flex items-center gap-1.5">
              <input
                :value="shareUrl"
                readonly
                data-test-id="collab-room-link"
                class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button
                data-test-id="collab-copy-link"
                class="flex h-7 cursor-pointer items-center gap-1 rounded border-none bg-accent px-2 text-xs text-white hover:bg-accent/90"
                @click="copyLink"
              >
                <icon-lucide-check v-if="copied" class="size-3" />
                <icon-lucide-copy v-else class="size-3" />
                {{ copied ? t('collab.copied') : t('collab.copy') }}
              </button>
            </div>

            <div class="mb-2 text-xs font-medium text-surface">
              {{ t('collab.peopleCount', { count: peers.length + 1 }) }}
            </div>

            <button
              data-test-id="collab-disconnect"
              class="flex h-7 w-full cursor-pointer items-center justify-center rounded border border-border bg-transparent text-xs text-muted hover:bg-hover hover:text-surface"
              @click="onDisconnect"
            >
              {{ t('collab.disconnect') }}
            </button>
          </template>

          <!-- Joining via /share/ link -->
          <template v-else-if="isJoining">
            <div class="mb-1 text-xs font-medium text-surface">{{ t('collab.joinTitle') }}</div>
            <div class="mb-3 text-[11px] text-muted">
              {{ t('collab.joinDescription') }}
            </div>

            <div class="mb-3">
              <label class="mb-1 block text-xs text-muted">{{ t('collab.yourName') }}</label>
              <input
                v-model="nameDraft"
                data-test-id="collab-name-input"
                class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                :placeholder="t('collab.enterYourName')"
                autofocus
                @keydown.enter="onJoin"
              />
            </div>

            <button
              data-test-id="collab-join-button"
              class="flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded border-none bg-accent text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              :disabled="!nameDraft.trim()"
              @click="onJoin"
            >
              <icon-lucide-users class="size-3.5" />
              {{ t('collab.joinRoom') }}
            </button>
          </template>

          <!-- Not connected: share or join -->
          <template v-else>
            <div class="mb-3">
              <label class="mb-1 block text-xs text-muted">{{ t('collab.yourName') }}</label>
              <input
                v-model="nameDraft"
                data-test-id="collab-name-input"
                class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                :placeholder="t('collab.enterYourName')"
                @keydown.enter="onShare"
              />
            </div>

            <button
              data-test-id="collab-share-file"
              class="mb-3 flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded border-none bg-accent text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              :disabled="!nameDraft.trim()"
              @click="onShare"
            >
              <icon-lucide-share-2 class="size-3.5" />
              {{ t('collab.shareThisFile') }}
            </button>

            <div class="mb-2 flex items-center gap-2">
              <div class="h-px flex-1 bg-border" />
              <span class="text-[11px] text-muted">{{ t('collab.orJoinRoom') }}</span>
              <div class="h-px flex-1 bg-border" />
            </div>

            <div class="flex items-center gap-1.5">
              <input
                v-model="joinInput"
                data-test-id="collab-join-input"
                class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-1 text-xs text-surface"
                :placeholder="t('collab.pasteRoomLink')"
                @keydown.enter="onJoin"
              />
              <button
                data-test-id="collab-join-room-button"
                class="flex h-7 cursor-pointer items-center rounded border-none bg-accent px-3 text-xs text-white hover:bg-accent/90 disabled:opacity-50"
                :disabled="!joinInput.trim() || !nameDraft.trim()"
                @click="onJoin"
              >
                {{ t('collab.join') }}
              </button>
            </div>
          </template>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
