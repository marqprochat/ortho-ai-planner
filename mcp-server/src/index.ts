import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { prisma } from './lib/prisma';
import { registerClinicTools } from './tools/clinicTools';
import { registerDentistTools } from './tools/dentistTools';
import { registerPatientTools } from './tools/patientTools';
import { registerPlanningTools } from './tools/planningTools';
import { registerTreatmentTools } from './tools/treatmentTools';
import { registerContractTools } from './tools/contractTools';
import { registerReportTools } from './tools/reportTools';

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

const main = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[ortho-ai-planner-mcp] Servidor MCP conectado via stdio');
};

const shutdown = async () => {
    await prisma.$disconnect();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch(async (error) => {
    console.error('[ortho-ai-planner-mcp] Erro fatal:', error);
    await prisma.$disconnect();
    process.exit(1);
});
