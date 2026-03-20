import { computed } from 'vue'

import { LANGUAGE_OPTIONS, MESSAGES } from '@/composables/ui-i18n-messages'
import { useUIPreferences } from '@/composables/use-ui-preferences'

import type { TranslationParams } from '@/composables/ui-i18n-messages'

function translate(locale: keyof typeof MESSAGES, key: string, params?: TranslationParams) {
  const catalog = MESSAGES[locale]
  const fallback = MESSAGES.en
  const value = catalog[key] ?? fallback[key] ?? key

  if (typeof value === 'function') return value(params)
  if (!params) return value

  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

export function useUII18n() {
  const { locale } = useUIPreferences()

  return {
    locale,
    t(key: string, params?: TranslationParams) {
      return translate(locale.value, key, params)
    },
    languageOptions: computed(() =>
      LANGUAGE_OPTIONS.map((option) => ({
        value: option.value,
        label: translate(locale.value, option.labelKey)
      }))
    )
  }
}
