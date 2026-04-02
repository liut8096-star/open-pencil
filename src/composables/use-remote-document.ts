import {onMounted, onUnmounted, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'

import {toast} from '@/composables/use-toast'
import {IS_TAURI} from '@/constants'
import {parseEnvBoolean, resolveApiUrl} from '@/utils/api'

import type {EditorStore} from '@/stores/editor'

interface RemoteDocumentMeta {
    id: string
    name: string
}

interface RemoteDocumentPayload {
    document: RemoteDocumentMeta
    contentUrl: string
}

const SAVE_DEBOUNCE_MS = 1200

function isRemoteDocsEnabled(): boolean {
    return !IS_TAURI && parseEnvBoolean(import.meta.env.VITE_REMOTE_DOCS_ENABLED)
}

export function useRemoteDocument(store: EditorStore) {
    const route = useRoute()
    const router = useRouter()

    const ready = ref(false)
    const saving = ref(false)
    const documentId = ref<string | null>(null)
    const remoteEnabled = isRemoteDocsEnabled()

    let initializing = false
    let lastSavedSceneVersion = -1
    let saveTimer: ReturnType<typeof setTimeout> | null = null

    const shouldSkip = () =>
        !remoteEnabled || !!route.meta.demo || typeof route.params.roomId === 'string'

    async function requestDocument(path: string, init?: RequestInit): Promise<Response> {
        return fetch(resolveApiUrl(path), {
            credentials: 'include',
            ...init
        })
    }

    async function createDocument(): Promise<RemoteDocumentPayload> {
        const response = await requestDocument('/api/documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                name: store.state.documentName || 'Untitled'
            })
        })
        if (!response.ok) {
            throw new Error(`Failed to create document: ${response.status}`)
        }
        return (await response.json()) as RemoteDocumentPayload
    }

    async function getDocument(id: string): Promise<RemoteDocumentPayload> {
        const response = await requestDocument(`/api/documents/${id}`, {
            headers: {Accept: 'application/json'}
        })
        if (!response.ok) {
            throw new Error(`Failed to load document: ${response.status}`)
        }
        return (await response.json()) as RemoteDocumentPayload
    }

    async function ensureDocumentId(): Promise<string> {
        const existingId = typeof route.query.doc === 'string' ? route.query.doc.trim() : ''
        if (existingId) {
            documentId.value = existingId
            return existingId
        }

        const payload = await createDocument()
        documentId.value = payload.document.id
        await router.replace({
            query: {
                ...route.query,
                doc: payload.document.id
            }
        })
        return payload.document.id
    }

    async function saveDocument(force = false, keepalive = false) {
        if (shouldSkip() || !documentId.value) return
        if (!force && (initializing || !ready.value || store.state.loading)) return
        if (!force && store.state.sceneVersion === lastSavedSceneVersion) return

        saving.value = true
        try {
            const bytes = await store.exportFigBytes()
            const response = await requestDocument(`/api/documents/${documentId.value}/content`, {
                method: 'PUT',
                keepalive,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-Document-Name': store.state.documentName || 'Untitled'
                },
                body: new Blob([bytes], {type: 'application/octet-stream'})
            })
            if (!response.ok) {
                throw new Error(`Failed to save document: ${response.status}`)
            }
            lastSavedSceneVersion = store.state.sceneVersion
        } catch (error) {
            console.error('Failed to save remote document:', error)
            if (force) {
                toast.show('Failed to save remote document', 'error')
            }
        } finally {
            saving.value = false
        }
    }

    async function loadDocument() {
        if (shouldSkip()) {
            ready.value = true
            return
        }

        initializing = true
        ready.value = false

        try {
            const id = await ensureDocumentId()
            const payload = await getDocument(id)
            documentId.value = payload.document.id

            const response = await requestDocument(`/api/documents/${id}/content`, {
                headers: {Accept: 'application/octet-stream'}
            })

            if (response.status === 204) {
                await saveDocument(true)
            } else if (response.ok) {
                const bytes = new Uint8Array(await response.arrayBuffer())
                await store.openFigBytes(bytes, `${payload.document.name || 'Untitled'}.fig`)
            } else {
                throw new Error(`Failed to load document content: ${response.status}`)
            }

            lastSavedSceneVersion = store.state.sceneVersion
            ready.value = true
        } catch (error) {
            console.error('Failed to initialize remote document:', error)
            toast.show('Failed to open remote document', 'error')
        } finally {
            initializing = false
        }
    }

    function scheduleSave() {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
            void saveDocument()
        }, SAVE_DEBOUNCE_MS)
    }

    function flushBeforeLeave() {
        if (saveTimer) {
            clearTimeout(saveTimer)
            saveTimer = null
        }
        void saveDocument(true, true)
    }

    watch(
        () => store.state.sceneVersion,
        () => {
            if (shouldSkip() || initializing || !ready.value) return
            scheduleSave()
        }
    )

    onMounted(() => {
        void loadDocument()
        window.addEventListener('pagehide', flushBeforeLeave)
    })

    onUnmounted(() => {
        if (saveTimer) clearTimeout(saveTimer)
        window.removeEventListener('pagehide', flushBeforeLeave)
    })

    return {
        remoteEnabled,
        ready,
        saving,
        documentId
    }
}
