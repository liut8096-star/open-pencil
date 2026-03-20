<script setup lang="ts">
import { computed } from 'vue'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuPortal
} from 'reka-ui'
import { selectionToJSX, renderNodesToSVG } from '@open-pencil/core'

import { useUII18n } from '@/composables/use-ui-i18n'
import { useEditorStore } from '@/stores/editor'
import { menuContent, menuItem, menuSeparator } from '@/components/ui/menu'
import { toast } from '@/composables/use-toast'

const store = useEditorStore()
const { t } = useUII18n()

const hasSelection = computed(() => {
  void store.state.sceneVersion
  return store.state.selectedIds.size > 0
})

const singleNode = computed(() => {
  void store.state.sceneVersion
  if (store.state.selectedIds.size !== 1) return null
  const id = [...store.state.selectedIds][0]
  return store.graph.getNode(id) ?? null
})

const multiCount = computed(() => {
  void store.state.sceneVersion
  return store.state.selectedIds.size
})

const isInstance = computed(() => singleNode.value?.type === 'INSTANCE')
const isComponent = computed(() => singleNode.value?.type === 'COMPONENT')
const isGroup = computed(() => singleNode.value?.type === 'GROUP')

const canCreateComponentSet = computed(() => {
  void store.state.sceneVersion
  if (store.state.selectedIds.size < 2) return false
  return [...store.state.selectedIds].every((id) => {
    const n = store.graph.getNode(id)
    return n?.type === 'COMPONENT'
  })
})

const otherPages = computed(() => {
  void store.state.sceneVersion
  return store.graph.getPages().filter((p) => p.id !== store.state.currentPageId)
})

const isVisible = computed(() => {
  void store.state.sceneVersion
  if (!singleNode.value) return true
  return singleNode.value.visible
})

const isLocked = computed(() => {
  void store.state.sceneVersion
  if (!singleNode.value) return false
  return singleNode.value.locked
})

function selectedIds(): string[] {
  return [...store.state.selectedIds]
}

async function copyAsText() {
  const ids = selectedIds()
  const names = ids.map((id) => store.graph.getNode(id)?.name ?? id).join('\n')
  await navigator.clipboard.writeText(names)
  toast.show(t('context.copiedAsText'))
}

async function copyAsSVG() {
  const ids = selectedIds()
  const svg = renderNodesToSVG(store.graph, store.state.currentPageId, ids)
  if (!svg) return
  await navigator.clipboard.writeText(svg)
  toast.show(t('context.copiedAsSvg'))
}

async function copyAsPNG() {
  const ids = selectedIds()
  const data = await store.renderExportImage(ids, 2, 'PNG')
  if (!data) return
  const blob = new Blob([data], { type: 'image/png' })
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  toast.show(t('context.copiedAsPng'))
}

function copyAsJSX() {
  const ids = selectedIds()
  const jsx = selectionToJSX(ids, store.graph)
  if (!jsx) return
  navigator.clipboard.writeText(jsx)
  toast.show(t('context.copiedAsJsx'))
}

const itemClass = menuItem()
const componentItemClass = menuItem({ tone: 'component' })
const menuClass = menuContent({
  class: 'min-w-56 shadow-[0_8px_30px_rgb(0_0_0/0.4)] animate-in fade-in zoom-in-95'
})
const separatorClass = menuSeparator({ class: 'my-1' })
</script>

<template>
  <ContextMenuContent :class="menuClass" :side-offset="2" align="start">
    <ContextMenuItem
      data-test-id="context-copy"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="document.execCommand('copy')"
    >
      <span>{{ t('menu.edit.copy') }}</span>
      <span class="text-[11px] text-muted">⌘C</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-cut"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="document.execCommand('cut')"
    >
      <span>{{ t('menu.edit.cut') }}</span>
      <span class="text-[11px] text-muted">⌘X</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-paste"
      :class="itemClass"
      @select="document.execCommand('paste')"
    >
      <span>{{ t('context.pasteHere') }}</span>
      <span class="text-[11px] text-muted">⌘V</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-duplicate"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="store.duplicateSelected()"
    >
      <span>{{ t('menu.edit.duplicate') }}</span>
      <span class="text-[11px] text-muted">⌘D</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-delete"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="store.deleteSelected()"
    >
      <span>{{ t('menu.edit.delete') }}</span>
      <span class="text-[11px] text-muted">⌫</span>
    </ContextMenuItem>

    <ContextMenuSeparator :class="separatorClass" />

    <ContextMenuSub v-if="otherPages.length > 0 && hasSelection">
      <ContextMenuSubTrigger data-test-id="context-move-to-page" :class="itemClass">
        <span>{{ t('context.moveToPage') }}</span>
        <span class="text-sm text-muted">›</span>
      </ContextMenuSubTrigger>
      <ContextMenuPortal>
        <ContextMenuSubContent :class="menuClass">
          <ContextMenuItem
            v-for="page in otherPages"
            :key="page.id"
            :class="itemClass"
            @select="store.moveToPage(page.id)"
          >
            {{ page.name }}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuPortal>
    </ContextMenuSub>

    <ContextMenuItem
      data-test-id="context-bring-to-front"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="store.bringToFront()"
    >
      <span>{{ t('menu.object.bringToFront') }}</span>
      <span class="text-[11px] text-muted">]</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-send-to-back"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="store.sendToBack()"
    >
      <span>{{ t('menu.object.sendToBack') }}</span>
      <span class="text-[11px] text-muted">[</span>
    </ContextMenuItem>

    <ContextMenuSeparator :class="separatorClass" />

    <ContextMenuItem
      data-test-id="context-group"
      :class="itemClass"
      :disabled="multiCount < 2"
      @select="store.groupSelected()"
    >
      <span>{{ t('menu.object.group') }}</span>
      <span class="text-[11px] text-muted">⌘G</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isGroup"
      data-test-id="context-ungroup"
      :class="itemClass"
      @select="store.ungroupSelected()"
    >
      <span>{{ t('menu.object.ungroup') }}</span>
      <span class="text-[11px] text-muted">⇧⌘G</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="hasSelection"
      data-test-id="context-auto-layout"
      :class="itemClass"
      @select="store.wrapInAutoLayout()"
    >
      <span>{{ t('menu.arrange.addAutoLayout') }}</span>
      <span class="text-[11px] text-muted">⇧A</span>
    </ContextMenuItem>

    <ContextMenuSeparator :class="separatorClass" />

    <ContextMenuItem
      data-test-id="context-create-component"
      :class="componentItemClass"
      :disabled="!hasSelection"
      @select="store.createComponentFromSelection()"
    >
      <span>{{ t('menu.object.createComponent') }}</span>
      <span class="text-[11px] text-component/60">⌥⌘K</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="canCreateComponentSet"
      data-test-id="context-create-component-set"
      :class="componentItemClass"
      @select="store.createComponentSetFromComponents()"
    >
      <span>{{ t('menu.object.createComponentSet') }}</span>
      <span class="text-[11px] text-component/60">⇧⌘K</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isComponent"
      data-test-id="context-create-instance"
      :class="componentItemClass"
      @select="store.createInstanceFromComponent(singleNode!.id)"
    >
      <span>{{ t('menu.object.createInstance') }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isInstance"
      data-test-id="context-go-to-component"
      :class="componentItemClass"
      @select="store.goToMainComponent()"
    >
      <span>{{ t('design.goToMainComponent') }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isInstance"
      data-test-id="context-detach-instance"
      :class="itemClass"
      @select="store.detachInstance()"
    >
      <span>{{ t('menu.object.detachInstance') }}</span>
      <span class="text-[11px] text-muted">⌥⌘B</span>
    </ContextMenuItem>

    <template v-if="hasSelection">
      <ContextMenuSeparator :class="separatorClass" />

      <ContextMenuItem
        data-test-id="context-toggle-visibility"
        :class="itemClass"
        @select="store.toggleVisibility()"
      >
        <span>{{ isVisible ? t('context.hide') : t('context.show') }}</span>
        <span class="text-[11px] text-muted">⇧⌘H</span>
      </ContextMenuItem>
      <ContextMenuItem
        data-test-id="context-toggle-lock"
        :class="itemClass"
        @select="store.toggleLock()"
      >
        <span>{{ isLocked ? t('context.unlock') : t('menu.object.lock') }}</span>
        <span class="text-[11px] text-muted">⇧⌘L</span>
      </ContextMenuItem>

      <ContextMenuSeparator :class="separatorClass" />

      <ContextMenuSub>
        <ContextMenuSubTrigger data-test-id="context-copy-paste-as" :class="itemClass">
          <span>{{ t('context.copyPasteAs') }}</span>
          <span class="text-sm text-muted">›</span>
        </ContextMenuSubTrigger>
        <ContextMenuPortal>
          <ContextMenuSubContent :class="menuClass">
            <ContextMenuItem
              data-test-id="context-copy-as-text"
              :class="itemClass"
              @select="copyAsText"
            >
              {{ t('context.copyAsText') }}
            </ContextMenuItem>
            <ContextMenuItem
              data-test-id="context-copy-as-svg"
              :class="itemClass"
              @select="copyAsSVG"
            >
              {{ t('context.copyAsSvg') }}
            </ContextMenuItem>
            <ContextMenuItem
              data-test-id="context-copy-as-png"
              :class="itemClass"
              @select="copyAsPNG"
            >
              <span>{{ t('context.copyAsPng') }}</span>
              <span class="text-[11px] text-muted">⇧⌘C</span>
            </ContextMenuItem>
            <ContextMenuItem
              data-test-id="context-copy-as-jsx"
              :class="itemClass"
              @select="copyAsJSX"
            >
              {{ t('context.copyAsJsx') }}
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuPortal>
      </ContextMenuSub>
    </template>
  </ContextMenuContent>
</template>
