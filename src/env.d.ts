/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />
/// <reference types="unplugin-icons/types/vue" />

declare module '*.vue' {
    import type {DefineComponent} from 'vue'
    const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string
    readonly VITE_AUTH_ENABLED?: string
    readonly VITE_AUTH_SESSION_URL?: string
    readonly VITE_AUTH_LOGIN_URL?: string
    readonly VITE_AUTH_LOGOUT_URL?: string
    readonly VITE_REMOTE_DOCS_ENABLED?: string
    readonly VITE_TRYSTERO_RELAY_URLS?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
