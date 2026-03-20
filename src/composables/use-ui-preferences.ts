import { useLocalStorage, usePreferredDark } from '@vueuse/core'
import { computed, watch } from 'vue'

import { IS_BROWSER } from '@/constants'

export type UITheme = 'system' | 'light' | 'dark'
export type UILocale = 'en' | 'zh-CN'

function detectDefaultLocale(): UILocale {
  if (!IS_BROWSER) return 'en'
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

const theme = useLocalStorage<UITheme>('op-ui-theme', 'system')
const locale = useLocalStorage<UILocale>('op-ui-locale', detectDefaultLocale())
const preferredDark = usePreferredDark()

const resolvedTheme = computed<'light' | 'dark'>(() => {
  if (theme.value === 'system') return preferredDark.value ? 'dark' : 'light'
  return theme.value
})

let initialized = false

export function initUIPreferences() {
  if (!IS_BROWSER || initialized) return
  initialized = true

  watch(
    [resolvedTheme, locale],
    ([nextTheme, nextLocale]) => {
      document.documentElement.dataset.theme = nextTheme
      document.documentElement.lang = nextLocale
      document.documentElement.style.colorScheme = nextTheme
    },
    { immediate: true }
  )
}

export function useUIPreferences() {
  return {
    theme,
    locale,
    resolvedTheme,
    setTheme(nextTheme: UITheme) {
      theme.value = nextTheme
    },
    setLocale(nextLocale: UILocale) {
      locale.value = nextLocale
    }
  }
}
