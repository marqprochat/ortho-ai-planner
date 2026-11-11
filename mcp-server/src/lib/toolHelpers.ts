import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export type ToolTextResult = {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
};

export const ok = (data: unknown): ToolTextResult => ({
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});

export const err = (message: string, details?: unknown): ToolTextResult => ({
    isError: true,
    content: [
        {
            type: 'text',
            text: JSON.stringify(
                details !== undefined ? { error: message, details } : { error: message },
                null,
                2
            ),
        },
    ],
});

export const parseOptionalDate = (value: string | null | undefined, fieldName: string): Date | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value.trim() === '') return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Data inválida em "${fieldName}": ${value}`);
    }
    return parsed;
};

/**
 * Registers an MCP tool with strict Zod inference and unified error handling.
 */
export const addTool = <TShape extends z.ZodRawShape>(
    server: McpServer,
    name: string,
    description: string,
    shape: TShape,
    handler: (args: z.infer<z.ZodObject<TShape>>) => Promise<ToolTextResult>
) => {
    const schema = z.object(shape);
    // Cast avoids exponential z3|z4 union type checking in @modelcontextprotocol/sdk's zod-compat layer.
    (server as unknown as {
        registerTool: (
            n: string,
            cfg: { description: string; inputSchema: unknown },
            cb: (args: unknown) => Promise<ToolTextResult>
        ) => void;
    }).registerTool(name, { description, inputSchema: schema }, async (rawArgs: unknown) => {
        try {
            const parsed = schema.parse(rawArgs ?? {});
            return await handler(parsed);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro inesperado ao executar ferramenta MCP';
            console.error(`[MCP Tool Error:${name}]`, error);
            return err(message);
        }
    });
};
