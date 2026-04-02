export interface BackendDocumentMeta {
    id: string
    name: string
    createdAt: string
    updatedAt: string
    size: number
}

export interface BackendDocumentPayload {
    document: BackendDocumentMeta
    contentUrl: string
}

export class BackendStoreClient {
    constructor(
        private readonly baseUrl: string,
        private readonly internalToken: string | null
    ) {
    }

    async createDocument(name: string): Promise<BackendDocumentPayload> {
        const response = await this.request('/api/documents', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Accept: 'application/json'},
            body: JSON.stringify({name})
        })
        return this.readJSON(response)
    }

    async getDocument(id: string): Promise<BackendDocumentPayload> {
        const response = await this.request(`/api/documents/${id}`, {
            headers: {Accept: 'application/json'}
        })
        return this.readJSON(response)
    }

    async readContent(id: string): Promise<Uint8Array | null> {
        const response = await this.request(`/api/documents/${id}/content`, {
            headers: {Accept: 'application/octet-stream'}
        })
        if (response.status === 204) return null
        return new Uint8Array(await response.arrayBuffer())
    }

    async writeContent(id: string, name: string, data: Uint8Array): Promise<BackendDocumentPayload> {
        const response = await this.request(`/api/documents/${id}/content`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-Document-Name': name
            },
            body: data
        })
        return this.readJSON(response)
    }

    private async request(path: string, init?: RequestInit): Promise<Response> {
        const headers = new Headers(init?.headers)
        if (this.internalToken) {
            headers.set('X-Internal-Token', this.internalToken)
        }

        const response = await fetch(new URL(path, this.baseUrl).toString(), {
            ...init,
            headers
        })

        if (!response.ok) {
            throw new Error(`Backend request failed: ${response.status} ${response.statusText}`)
        }

        return response
    }

    private async readJSON(response: Response): Promise<BackendDocumentPayload> {
        return (await response.json()) as BackendDocumentPayload
    }
}
