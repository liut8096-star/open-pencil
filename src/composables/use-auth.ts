import {computed, ref} from 'vue'

import {IS_TAURI} from '@/constants'
import {parseEnvBoolean, resolveApiUrl} from '@/utils/api'

export interface AuthenticatedUser {
    email: string
    name?: string
    avatarUrl?: string
}

interface AuthSessionPayload {
    authenticated?: boolean
    user?: AuthenticatedUser
    loginUrl?: string
    logoutUrl?: string
}

type AuthStatus = 'unknown' | 'checking' | 'authenticated' | 'unauthenticated'

const authEnabled = !IS_TAURI && parseEnvBoolean(import.meta.env.VITE_AUTH_ENABLED)
const sessionUrl = resolveApiUrl(import.meta.env.VITE_AUTH_SESSION_URL || '/api/auth/session')
const loginUrl = resolveApiUrl(import.meta.env.VITE_AUTH_LOGIN_URL || '/oauth2/sign_in')
const logoutUrl = resolveApiUrl(import.meta.env.VITE_AUTH_LOGOUT_URL || '/oauth2/sign_out')

const status = ref<AuthStatus>(authEnabled ? 'unknown' : 'authenticated')
const user = ref<AuthenticatedUser | null>(null)
const resolvedLoginUrl = ref(loginUrl)
const resolvedLogoutUrl = ref(logoutUrl)
const lastError = ref<string | null>(null)
let pendingSessionCheck: Promise<boolean> | null = null

function withRedirect(target: string, redirectTo: string): string {
    try {
        const url = new URL(target, window.location.origin)
        url.searchParams.set('rd', redirectTo)
        return url.toString()
    } catch {
        const separator = target.includes('?') ? '&' : '?'
        return `${target}${separator}rd=${encodeURIComponent(redirectTo)}`
    }
}

async function requestSession(): Promise<boolean> {
    if (!authEnabled) return true
    status.value = 'checking'
    lastError.value = null

    try {
        const response = await fetch(sessionUrl, {
            credentials: 'include',
            headers: {Accept: 'application/json'}
        })

        if (response.status === 401) {
            status.value = 'unauthenticated'
            user.value = null
            return false
        }

        if (!response.ok) {
            throw new Error(`Session request failed with status ${response.status}`)
        }

        const payload = (await response.json()) as AuthSessionPayload
        const authenticated = payload.authenticated !== false
        user.value = authenticated ? (payload.user ?? null) : null
        resolvedLoginUrl.value = payload.loginUrl || loginUrl
        resolvedLogoutUrl.value = payload.logoutUrl || logoutUrl
        status.value = authenticated ? 'authenticated' : 'unauthenticated'
        return authenticated
    } catch (error) {
        status.value = 'unauthenticated'
        user.value = null
        lastError.value = error instanceof Error ? error.message : String(error)
        return false
    }
}

export async function ensureAuthSession(force = false): Promise<boolean> {
    if (!authEnabled) return true
    if (!force && status.value === 'authenticated') return true
    if (!force && status.value === 'unauthenticated') return false
    if (pendingSessionCheck) return pendingSessionCheck
    pendingSessionCheck = requestSession().finally(() => {
        pendingSessionCheck = null
    })
    return pendingSessionCheck
}

export function beginLogin(nextPath?: string) {
    const redirectTo = new URL(nextPath || '/', window.location.origin).toString()
    window.location.href = withRedirect(resolvedLoginUrl.value, redirectTo)
}

export function beginLogout(nextPath = '/login') {
    const redirectTo = new URL(nextPath, window.location.origin).toString()
    window.location.href = withRedirect(resolvedLogoutUrl.value, redirectTo)
}

export function useAuth() {
    return {
        authEnabled,
        status: computed(() => status.value),
        user: computed(() => user.value),
        lastError: computed(() => lastError.value),
        loginUrl: computed(() => resolvedLoginUrl.value),
        logoutUrl: computed(() => resolvedLogoutUrl.value),
        ensureSession: ensureAuthSession,
        refreshSession: () => ensureAuthSession(true),
        beginLogin,
        beginLogout
    }
}
