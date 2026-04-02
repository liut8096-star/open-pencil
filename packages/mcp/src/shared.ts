import {createRequire} from 'node:module'

import {z} from 'zod'

import type {ParamDef, ParamType} from '@open-pencil/core'

const require = createRequire(import.meta.url)

export const MCP_VERSION: string = (require('../package.json') as { version: string }).version

type MCPContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

export type MCPResult = { content: MCPContent[]; isError?: boolean }

export function ok(data: unknown): MCPResult {
    return {content: [{type: 'text', text: JSON.stringify(data, null, 2)}]}
}

export function fail(error: unknown): MCPResult {
    const message = error instanceof Error ? error.message : String(error)
    return {
        content: [{type: 'text', text: JSON.stringify({error: message})}],
        isError: true
    }
}

export function paramToZod(param: ParamDef): z.ZodType {
    const typeMap: Record<ParamType, () => z.ZodType> = {
        string: () =>
            param.enum
                ? z.enum(param.enum as [string, ...string[]]).describe(param.description)
                : z.string().describe(param.description),
        number: () => {
            let schema = z.number()
            if (param.min !== undefined) schema = schema.min(param.min)
            if (param.max !== undefined) schema = schema.max(param.max)
            return schema.describe(param.description)
        },
        boolean: () => z.boolean().describe(param.description),
        color: () => z.string().describe(param.description),
        'string[]': () => z.array(z.string()).min(1).describe(param.description)
    }

    const schema = typeMap[param.type]()
    return param.required ? schema : schema.optional()
}
