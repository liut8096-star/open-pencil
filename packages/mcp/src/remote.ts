#!/usr/bin/env node
import {serve} from '@hono/node-server'

import {startHeadlessServer} from './headless.js'

const host = process.env.HOST ?? '127.0.0.1'
const port = parseInt(process.env.PORT ?? '7700', 10)
const apiBaseUrl = process.env.OPENPENCIL_API_BASE_URL ?? 'http://127.0.0.1:8080'

const {app} = startHeadlessServer({
    apiBaseUrl,
    internalToken: process.env.OPENPENCIL_INTERNAL_API_TOKEN?.trim() || null,
    authToken: process.env.OPENPENCIL_MCP_AUTH_TOKEN?.trim() || null,
    corsOrigin: process.env.OPENPENCIL_MCP_CORS_ORIGIN?.trim() || null,
    enableEval: process.env.OPENPENCIL_MCP_EVAL === '1'
})

serve({fetch: app.fetch, port, hostname: host})

console.log('OpenPencil remote MCP server')
console.log(`  HTTP:  http://${host}:${port}`)
console.log(`  MCP:   http://${host}:${port}/mcp`)
console.log(`  API:   ${apiBaseUrl}`)
