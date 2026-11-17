import express, { Request, Response } from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { prisma } from './lib/prisma';
import { registerClinicTools } from './tools/clinicTools';
import { registerDentistTools } from './tools/dentistTools';
import { registerPatientTools } from './tools/patientTools';
import { registerPlanningTools } from './tools/planningTools';
import { registerTreatmentTools } from './tools/treatmentTools';
import { registerContractTools } from './tools/contractTools';
import { registerReportTools } from './tools/reportTools';

export const createMcpServer = () => {
    const server = new McpServer({
        name: 'ortho-ai-planner',
        version: '1.0.0',
    });

    registerClinicTools(server);
    registerDentistTools(server);
    registerPatientTools(server);
    registerPlanningTools(server);
    registerTreatmentTools(server);
    registerContractTools(server);
    registerReportTools(server);

    server.registerResource(
        'schema-overview',
        'planner://schema-overview',
        {
            description: 'Visão geral das entidades e relacionamentos do Ortho AI Planner',
            mimeType: 'application/json',
        },
        async (uri) => ({
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify(
                        {
                            entities: {
                                Clinic: 'Unidade odontológica com dentistas cadastrados (Dentist) e pacientes (Patient).',
                                Dentist: 'Cadastro oficial de dentista por clínica (name, cro, easyDentalId, isActive).',
                                Patient: 'Paciente vinculado a tenantId, clinicId e userId.',
                                Planning: 'Planejamento ortodôntico vinculado a Patient e opcionalmente a Dentist (dentistId + structuredPlan.nomeOrtodontista/croOrtodontista).',
                                Treatment: 'Tratamento vinculado a Patient/Planning e opcionalmente a Dentist (dentistId, dentistCro, doctorName).',
                                Contract: 'Termo/contrato em texto (content) vinculado a Patient e opcionalmente a Planning (isSigned, signedAt).',
                            },
                            standardizationWorkflow: [
                                '1. list_clinics -> identificar clinicId',
                                '2. list_dentists -> identificar dentistId padrão',
                                '3. preview_dentist_standardization -> revisar todos os tratamentos, planejamentos e contratos encontrados',
                                '4. apply_dentist_standardization -> aplicar apenas os IDs aprovados com confirm=true',
                            ],
                        },
                        null,
                        2
                    ),
                },
            ],
        })
    );

    server.registerResource(
        'clinics',
        'planner://clinics',
        {
            description: 'Lista atual de clínicas do Planner',
            mimeType: 'application/json',
        },
        async (uri) => {
            const clinics = await prisma.clinic.findMany({
                select: { id: true, name: true, nickname: true, cro: true, city: true, state: true, tenantId: true },
                orderBy: { name: 'asc' },
            });
            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: JSON.stringify(clinics, null, 2),
                    },
                ],
            };
        }
    );

    return server;
};

const isSseMode =
    process.argv.includes('--sse') ||
    process.env.MCP_TRANSPORT === 'sse' ||
    Boolean(process.env.MCP_PORT) ||
    Boolean(process.env.PORT);

const startStdio = async () => {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[ortho-ai-planner-mcp] Servidor MCP conectado via stdio');
};

const startSse = async () => {
    const app = express();
    const port = Number(process.env.MCP_PORT || process.env.PORT || 3001);
    const expectedApiKey = process.env.MCP_API_KEY?.trim() || '';

    app.use(cors({ origin: '*' }));
    app.use(express.json({ limit: '10mb' }));

    // Auth middleware (apenas se MCP_API_KEY estiver configurado)
    const authMiddleware = (req: Request, res: Response, next: () => void) => {
        if (!expectedApiKey) return next();

        const queryKey = typeof req.query.apiKey === 'string' ? req.query.apiKey : '';
        const headerKey = req.headers['x-api-key'];
        const authHeader = req.headers.authorization;
        const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

        const token = queryKey || headerKey || bearerKey;
        if (token === expectedApiKey) return next();

        res.status(401).json({
            error: 'Não autorizado. Forneça ?apiKey=..., header x-api-key ou Authorization: Bearer <key>',
        });
    };

    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', transport: 'sse', timestamp: new Date() });
    });

    const sessions = new Map<string, { transport: SSEServerTransport; server: McpServer }>();

    // Endpoint SSE para o cliente iniciar conexão por URL
    app.get('/sse', authMiddleware, async (_req: Request, res: Response) => {
        const transport = new SSEServerTransport('/messages', res);
        const server = createMcpServer();

        sessions.set(transport.sessionId, { transport, server });

        transport.onclose = () => {
            sessions.delete(transport.sessionId);
        };

        await server.connect(transport);
    });

    // Endpoint para troca de mensagens JSON-RPC do protocolo MCP
    app.post('/messages', async (req: Request, res: Response) => {
        const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
        const session = sessions.get(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Sessão MCP não encontrada ou expirada. Reconecte via /sse.' });
            return;
        }

        await session.transport.handlePostMessage(req, res, req.body);
    });

    app.listen(port, '0.0.0.0', () => {
        console.log(`[ortho-ai-planner-mcp] Servidor HTTP/SSE ativo na porta ${port}`);
        console.log(`[ortho-ai-planner-mcp] Endpoint MCP URL: http://localhost:${port}/sse`);
        if (expectedApiKey) {
            console.log(`[ortho-ai-planner-mcp] Autenticação ativa via MCP_API_KEY`);
        }
    });
};

const shutdown = async () => {
    await prisma.$disconnect();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const main = async () => {
    if (isSseMode) {
        await startSse();
    } else {
        await startStdio();
    }
};

main().catch(async (error) => {
    console.error('[ortho-ai-planner-mcp] Erro fatal:', error);
    await prisma.$disconnect();
    process.exit(1);
});
