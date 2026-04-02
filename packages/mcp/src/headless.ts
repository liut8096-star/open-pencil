import {randomUUID} from 'node:crypto'

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import {Hono} from 'hono'
import {cors} from 'hono/cors'
import {z} from 'zod'

import {
    ALL_TOOLS,
    buildComponent,
    CODEGEN_PROMPT,
    computeAllLayouts,
    createElement,
    exportFigFile,
    FigmaAPI,
    readFigFile,
    resolveToTree,
    SceneGraph
} from '@open-pencil/core'

import {type BackendDocumentPayload, BackendStoreClient} from './backend-store.js'
import {fail, MCP_VERSION, ok, paramToZod} from './shared.js'

const CHUNK_SIZE = 0x8000

interface HeadlessSessionState {
    figma: FigmaAPI
    documentId: string | null
    documentName: string
}

type MCPTransport = { handleRequest: (request: Request) => Promise<Response> }

export interface HeadlessServerOptions {
    apiBaseUrl: string
    internalToken?: string | null
    authToken?: string | null
    corsOrigin?: string | null
    enableEval?: boolean
    maxSessions?: number
}

function createEmptySession(): HeadlessSessionState {
    const graph = new SceneGraph()
    computeAllLayouts(graph)
    return {
        figma: new FigmaAPI(graph),
        documentId: null,
        documentName: 'Untitled'
    }
}

async function loadGraph(bytes: Uint8Array, filename: string): Promise<FigmaAPI> {
    const file = new File([bytes], filename, {type: 'application/octet-stream'})
    const graph = await readFigFile(file)
    computeAllLayouts(graph)
    return new FigmaAPI(graph)
}

async function saveSessionDocument(
    backend: BackendStoreClient,
    session: HeadlessSessionState,
    nextName?: string
): Promise<BackendDocumentPayload> {
    if (!session.documentId) {
        throw new Error('No active document. Call create_document or open_document first.')
    }
    if (nextName?.trim()) {
        session.documentName = nextName.trim()
    }
    const bytes = new Uint8Array(
        await exportFigFile(session.figma.graph, undefined, undefined, session.figma.currentPageId)
    )
    const payload = await backend.writeContent(session.documentId, session.documentName, bytes)
    session.documentName = payload.document.name
    return payload
}

function preprocessToolArgs(
    toolName: string,
    args: Record<string, unknown>
): Record<string, unknown> {
    if (toolName !== 'render' || !args.jsx) return args
    const Component = buildComponent(args.jsx as string)
    const element = createElement(Component, null)
    const tree = resolveToTree(element)
    return {
        ...args,
        jsx: undefined,
        tree
    }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64')
    }
    let binary = ''
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE)
        binary += String.fromCharCode.apply(null, chunk as unknown as number[])
    }
    return btoa(binary)
}

function describeActiveDocument(session: HeadlessSessionState) {
    return {
        id: session.documentId,
        name: session.documentName,
        currentPageId: session.figma.currentPageId,
        pageCount: session.figma.graph.getPages().length
    }
}

export function startHeadlessServer(options: HeadlessServerOptions) {
    const backend = new BackendStoreClient(
        options.apiBaseUrl,
        options.internalToken?.trim() || null
    )
    const authToken = options.authToken?.trim() || null
    const corsOrigin = options.corsOrigin?.trim() || null
    const enableEval = options.enableEval ?? false
    const maxSessions = options.maxSessions ?? 20

    const app = new Hono()
    const sessions = new Map<string, MCPTransport>()

    if (corsOrigin) {
        app.use(
            '*',
            cors({
                origin: corsOrigin,
                allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
                allowHeaders: [
                    'Content-Type',
                    'Authorization',
                    'x-mcp-token',
                    'mcp-session-id',
                    'Last-Event-ID',
                    'mcp-protocol-version'
                ],
                exposeHeaders: ['mcp-session-id', 'mcp-protocol-version']
            })
        )
    } else {
        app.use('*', cors())
    }

    app.get('/health', (c) =>
        c.json({
            status: 'ok',
            mode: 'headless'
        })
    )

    function createSession(id: string): MCPTransport {
        const session = createEmptySession()
        const server = new McpServer({name: 'open-pencil-remote', version: MCP_VERSION})
        const register = server.registerTool.bind(server) as (...args: unknown[]) => void

        register(
            'create_document',
            {
                description: 'Create a new persistent remote document and bind this MCP session to it.',
                inputSchema: z.object({
                    name: z.string().optional()
                })
            },
            async ({name}: { name?: string }) => {
                try {
                    const payload = await backend.createDocument(name?.trim() || session.documentName)
                    session.documentId = payload.document.id
                    session.documentName = payload.document.name
                    session.figma = createEmptySession().figma
                    await saveSessionDocument(backend, session)
                    return ok(describeActiveDocument(session))
                } catch (error) {
                    return fail(error)
                }
            }
        )

        register(
            'open_document',
            {
                description: 'Open an existing remote document by ID into the current MCP session.',
                inputSchema: z.object({
                    id: z.string().min(1)
                })
            },
            async ({id: documentId}: { id: string }) => {
                try {
                    const payload = await backend.getDocument(documentId)
                    const bytes = await backend.readContent(documentId)
                    session.documentId = payload.document.id
                    session.documentName = payload.document.name
                    session.figma = bytes
                        ? await loadGraph(bytes, `${payload.document.name}.fig`)
                        : createEmptySession().figma
                    return ok(describeActiveDocument(session))
                } catch (error) {
                    return fail(error)
                }
            }
        )

        register(
            'save_document',
            {
                description: 'Persist the current in-memory document back to the backend store.',
                inputSchema: z.object({
                    name: z.string().optional()
                })
            },
            async ({name}: { name?: string }) => {
                try {
                    await saveSessionDocument(backend, session, name)
                    return ok(describeActiveDocument(session))
                } catch (error) {
                    return fail(error)
                }
            }
        )

        register(
            'get_active_document',
            {
                description: 'Return the active remote document bound to this MCP session.',
                inputSchema: z.object({})
            },
            async () => ok(describeActiveDocument(session))
        )

        for (const def of ALL_TOOLS) {
            if (!enableEval && def.name === 'eval') continue
            const shape: Record<string, z.ZodType> = {}
            for (const [key, param] of Object.entries(def.params)) {
                shape[key] = paramToZod(param)
            }

            register(
                def.name,
                {description: def.description, inputSchema: z.object(shape)},
                async (args: Record<string, unknown>) => {
                    try {
                        const result = await def.execute(session.figma, preprocessToolArgs(def.name, args))
                        if (def.mutates) {
                            computeAllLayouts(session.figma.graph, session.figma.currentPageId)
                            if (session.documentId) {
                                await saveSessionDocument(backend, session)
                            }
                        }

                        const payload = result as Record<string, unknown> | undefined
                        if (payload && 'base64' in payload && 'mimeType' in payload) {
                            return {
                                content: [
                                    {
                                        type: 'image' as const,
                                        data: payload.base64 as string,
                                        mimeType: payload.mimeType as string
                                    }
                                ]
                            }
                        }

                        if (result instanceof Uint8Array) {
                            return ok({base64: uint8ArrayToBase64(result)})
                        }

                        return ok(result)
                    } catch (error) {
                        return fail(error)
                    }
                }
            )
        }

        register(
            'get_codegen_prompt',
            {
                description: 'Get design-to-code generation guidelines. Call before generating frontend code.',
                inputSchema: z.object({})
            },
            async () => ok({prompt: CODEGEN_PROMPT})
        )

        const transport = new WebStandardStreamableHTTPServerTransport({
            sessionIdGenerator: () => id
        })
        void server.connect(transport)
        sessions.set(id, transport)
        return transport
    }

    app.all('/mcp', async (c) => {
        if (authToken) {
            const authorization = c.req.header('authorization')
            const token = authorization?.startsWith('Bearer ')
                ? authorization.slice('Bearer '.length)
                : c.req.header('x-mcp-token')
            if (token !== authToken) {
                return c.json({error: 'Unauthorized'}, 401)
            }
        }

        const sessionId = c.req.header('mcp-session-id') ?? undefined
        const existing = sessionId ? sessions.get(sessionId) : undefined
        if (!existing && sessions.size >= maxSessions) {
            return c.json(
                {error: 'Too many active MCP sessions'},
                {status: 503, headers: {'Retry-After': '5'}}
            )
        }

        const transport = existing ?? createSession(sessionId ?? randomUUID())
        const response = await transport.handleRequest(c.req.raw)
        if (c.req.method === 'DELETE' && sessionId) {
            sessions.delete(sessionId)
        }
        return response
    })

    return {app}
}
