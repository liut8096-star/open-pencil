function trimTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value
}

export function parseEnvBoolean(value: string | undefined): boolean {
    return value === '1' || value === 'true'
}

export function resolveApiUrl(path: string): string {
    if (/^https?:\/\//.test(path)) return path

    const apiBase = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL?.trim() ?? '')
    if (!apiBase) return path

    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return new URL(normalizedPath, `${apiBase}/`).toString()
}
