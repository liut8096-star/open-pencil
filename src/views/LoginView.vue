<script lang="ts" setup>
import {computed, onMounted} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useHead} from '@unhead/vue'

import {beginLogin, useAuth} from '@/composables/use-auth'
import {useUII18n} from '@/composables/use-ui-i18n'
import {useUIPreferences} from '@/composables/use-ui-preferences'
import {uiButton} from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const {t, locale, languageOptions} = useUII18n()
const {theme, setTheme, setLocale} = useUIPreferences()
const auth = useAuth()

const nextPath = computed(() => (typeof route.query.next === 'string' ? route.query.next : '/'))
const authReady = computed(() => auth.status.value !== 'checking')
const authDisabled = computed(() => !auth.authEnabled)
const selectedLocaleLabel = computed(
    () => languageOptions.value.find((option) => option.value === locale.value)?.label ?? locale.value
)

const highlights = computed(() => [
  t('auth.highlight.projects'),
  t('auth.highlight.handoff'),
  t('auth.highlight.audit')
])

function cycleTheme() {
  if (theme.value === 'system') setTheme('light')
  else if (theme.value === 'light') setTheme('dark')
  else setTheme('system')
}

function submitLogin() {
  if (authDisabled.value) {
    void router.push(nextPath.value)
    return
  }
  beginLogin(nextPath.value)
}

async function retrySession() {
  const authenticated = await auth.refreshSession()
  if (authenticated) {
    void router.replace(nextPath.value)
  }
}

onMounted(async () => {
  if (!authDisabled.value) {
    const authenticated = await auth.refreshSession()
    if (authenticated) {
      void router.replace(nextPath.value)
    }
  }
})

useHead({title: 'Login'})
</script>

<template>
  <main class="relative min-h-screen overflow-auto bg-canvas text-surface">
    <div class="absolute inset-0 overflow-hidden">
      <div
          class="absolute inset-x-0 top-0 h-72 bg-linear-to-br from-[#4F46E5]/18 via-[#6366F1]/10 to-transparent"
      />
      <div class="absolute -top-24 right-[-6rem] size-80 rounded-full bg-[#F97316]/16 blur-3xl"/>
      <div
          class="absolute bottom-[-8rem] left-[-5rem] size-96 rounded-full bg-[#4F46E5]/16 blur-3xl"
      />
      <div
          class="absolute inset-0 opacity-[0.08]"
          style="
          background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0);
          background-size: 22px 22px;
        "
      />
    </div>

    <section
        class="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10"
    >
      <header class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
              class="flex size-11 items-center justify-center rounded-2xl bg-white/90 text-[#312E81] shadow-[0_18px_50px_rgba(79,70,229,0.18)] ring-1 ring-white/60"
          >
            <img alt="Wanbu UI" class="size-6" src="/favicon-32.png"/>
          </div>
          <div>
            <div class="text-sm font-semibold tracking-[0.18em] text-[#6366F1] uppercase">
              WANBU UI
            </div>
            <div class="text-xs text-muted">{{ t('auth.brandSubtitle') }}</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
              :class="
              uiButton({
                tone: 'panel',
                size: 'sm',
                shape: 'pill',
                bordered: true,
                class: 'cursor-pointer gap-2 px-3'
              })
            "
              type="button"
              @click="cycleTheme"
          >
            <icon-lucide-sun-moon class="size-3.5"/>
            <span>{{ t(`theme.${theme}`) }}</span>
          </button>
          <button
              :class="
              uiButton({
                tone: 'panel',
                size: 'sm',
                shape: 'pill',
                bordered: true,
                class: 'cursor-pointer gap-2 px-3'
              })
            "
              type="button"
              @click="setLocale(locale === 'en' ? 'zh-CN' : 'en')"
          >
            <icon-lucide-languages class="size-3.5"/>
            <span>{{ selectedLocaleLabel }}</span>
          </button>
        </div>
      </header>

      <div
          class="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,1.2fr)_440px] lg:py-14"
      >
        <section class="max-w-2xl">
          <div
              class="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1 text-[11px] font-medium text-[#4338CA] shadow-sm backdrop-blur-xl"
          >
            <icon-lucide-shield-check class="size-3.5"/>
            <span>{{ t('auth.badge') }}</span>
          </div>

          <h1
              class="mt-5 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-surface sm:text-5xl"
          >
            {{ t('auth.title') }}
          </h1>
          <p class="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            {{ t('auth.subtitle') }}
          </p>

          <div class="mt-8 grid gap-4 sm:grid-cols-3">
            <article
                v-for="item in highlights"
                :key="item"
                class="rounded-3xl border border-white/45 bg-white/72 p-4 shadow-[0_20px_45px_rgba(79,70,229,0.08)] backdrop-blur-xl"
            >
              <div
                  class="mb-3 flex size-10 items-center justify-center rounded-2xl bg-[#4F46E5]/12 text-[#4F46E5]"
              >
                <icon-lucide-sparkles class="size-4"/>
              </div>
              <p class="text-sm leading-6 text-surface">{{ item }}</p>
            </article>
          </div>

          <div
              class="mt-8 rounded-[28px] border border-white/45 bg-white/72 p-5 shadow-[0_28px_60px_rgba(49,46,129,0.08)] backdrop-blur-xl"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-semibold tracking-[0.18em] text-[#F97316] uppercase">
                  {{ t('auth.previewLabel') }}
                </div>
                <div class="mt-2 text-lg font-semibold text-surface">
                  {{ t('auth.previewTitle') }}
                </div>
              </div>
              <div
                  class="rounded-full bg-[#F97316]/12 px-3 py-1 text-xs font-medium text-[#C2410C]"
              >
                {{ t('auth.previewPill') }}
              </div>
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-3">
              <div class="rounded-2xl border border-border/70 bg-panel/40 p-4">
                <div class="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
                  {{ t('auth.metric.workspace') }}
                </div>
                <div class="mt-2 text-2xl font-semibold text-surface">12</div>
                <div class="mt-1 text-xs text-muted">{{ t('auth.metric.workspaceHint') }}</div>
              </div>
              <div class="rounded-2xl border border-border/70 bg-panel/40 p-4">
                <div class="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
                  {{ t('auth.metric.delivery') }}
                </div>
                <div class="mt-2 text-2xl font-semibold text-surface">24h</div>
                <div class="mt-1 text-xs text-muted">{{ t('auth.metric.deliveryHint') }}</div>
              </div>
              <div class="rounded-2xl border border-border/70 bg-panel/40 p-4">
                <div class="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
                  {{ t('auth.metric.coverage') }}
                </div>
                <div class="mt-2 text-2xl font-semibold text-surface">3</div>
                <div class="mt-1 text-xs text-muted">{{ t('auth.metric.coverageHint') }}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="relative">
          <div class="absolute inset-x-8 top-6 -z-10 h-20 rounded-full bg-[#4F46E5]/20 blur-2xl"/>
          <article
              class="rounded-[32px] border border-white/50 bg-white/82 p-6 shadow-[0_30px_90px_rgba(49,46,129,0.18)] backdrop-blur-2xl sm:p-7"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-xs font-semibold tracking-[0.2em] text-[#6366F1] uppercase">
                  {{ t('auth.signInLabel') }}
                </div>
                <h2 class="mt-2 text-2xl font-semibold text-surface">{{ t('auth.cardTitle') }}</h2>
                <p class="mt-2 text-sm leading-6 text-muted">{{ t('auth.cardSubtitle') }}</p>
              </div>
              <div
                  class="rounded-2xl border border-[#4F46E5]/15 bg-[#4F46E5]/10 px-3 py-1.5 text-xs font-medium text-[#4338CA]"
              >
                {{ authDisabled ? t('auth.modeDisabled') : t('auth.modeSSO') }}
              </div>
            </div>

            <div class="mt-6 space-y-3">
              <div class="rounded-2xl border border-border/70 bg-panel/35 p-4">
                <div class="flex items-center gap-3">
                  <div
                      class="flex size-11 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4338CA]"
                  >
                    <icon-lucide-building-2 class="size-5"/>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-surface">{{ t('auth.ssoTitle') }}</div>
                    <div class="text-xs leading-5 text-muted">{{ t('auth.ssoHint') }}</div>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl border border-border/70 bg-panel/35 p-4">
                <div class="flex items-center gap-3">
                  <div
                      class="flex size-11 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#C2410C]"
                  >
                    <icon-lucide-shield-ellipsis class="size-5"/>
                  </div>
                  <div>
                    <div class="text-sm font-medium text-surface">{{ t('auth.policyTitle') }}</div>
                    <div class="text-xs leading-5 text-muted">{{ t('auth.policyHint') }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div
                v-if="auth.lastError.value"
                class="mt-5 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-surface"
            >
              <div class="flex items-start gap-3">
                <icon-lucide-triangle-alert class="mt-0.5 size-4 shrink-0 text-amber-500"/>
                <div>
                  <div class="font-medium">{{ t('auth.errorTitle') }}</div>
                  <div class="text-muted">{{ auth.lastError.value }}</div>
                </div>
              </div>
            </div>

            <div class="mt-6 space-y-3">
              <button
                  :class="
                  uiButton({
                    tone: 'accent',
                    size: 'md',
                    shape: 'rounded',
                    class:
                      'h-12 w-full cursor-pointer justify-between rounded-2xl px-4 text-sm font-semibold shadow-[0_18px_40px_rgba(79,70,229,0.25)] disabled:cursor-wait disabled:opacity-70'
                  })
                "
                  :disabled="!authReady"
                  type="button"
                  @click="submitLogin"
              >
                <span class="flex items-center gap-3">
                  <icon-lucide-log-in class="size-4"/>
                  <span>{{ authDisabled ? t('auth.openEditor') : t('auth.continueSSO') }}</span>
                </span>
                <icon-lucide-arrow-right class="size-4"/>
              </button>

              <button
                  v-if="!authDisabled"
                  :class="
                  uiButton({
                    tone: 'ghost',
                    size: 'md',
                    shape: 'rounded',
                    class:
                      'h-11 w-full cursor-pointer rounded-2xl border border-border bg-panel/35 text-sm font-medium hover:bg-hover/60'
                  })
                "
                  type="button"
                  @click="retrySession"
              >
                {{ t('auth.retry') }}
              </button>

              <RouterLink
                  v-if="authDisabled"
                  :class="
                  uiButton({
                    tone: 'ghost',
                    size: 'md',
                    shape: 'rounded',
                    class:
                      'h-11 w-full cursor-pointer rounded-2xl border border-border bg-panel/35 text-sm font-medium hover:bg-hover/60'
                  })
                "
                  to="/demo"
              >
                {{ t('auth.tryDemo') }}
              </RouterLink>
            </div>

            <div class="mt-5 text-xs leading-6 text-muted">
              {{ authDisabled ? t('auth.disabledHint') : t('auth.nextHint') }}
            </div>
          </article>
        </section>
      </div>
    </section>
  </main>
</template>
