const API_URL = process.env.EASYDENTAL_API_URL || 'https://prsrb.onrender.com/v1/rpc';
const API_KEY = process.env.EASYDENTAL_API_KEY || '';
const CLIENT_ID = process.env.EASYDENTAL_CLIENT_ID || '';

export async function rpcCall(method: string, params: Record<string, any> = {}) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
        },
        body: JSON.stringify({ clientId: CLIENT_ID, method, params }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`RPC ${method} failed (${response.status}): ${text}`);
    }

    return response.json();
}

// Nomes das unidades de atendimento ativas
export async function listUnidades(): Promise<string[]> {
    const data = await rpcCall('RPCGetUnidadeAtendimento');
    if (!Array.isArray(data)) return [];
    return data
        .map((u: any) => u.TX_UNIDADE_ATENDIMENTO)
        .filter((name: any) => typeof name === 'string' && name.trim() !== '');
}

export interface UltimaConsultaRecord {
    PACIENTE: string;
    CODIGO: string;
    ULTIMA_CONSULTA: string | null;
    CELULAR: string | null;
    CONSULTA_AGENDADA: string | null;
    UNIDADE: string;
}

// RPCGetUltimaConsulta em todas as unidades informadas (ou todas as ativas)
export async function fetchUltimaConsulta(
    dt_inicio: string,
    dt_termino: string,
    unidades?: string[]
): Promise<UltimaConsultaRecord[]> {
    const targetUnits = unidades && unidades.length > 0 ? unidades : await listUnidades();
    if (targetUnits.length === 0) return [];

    const results = await Promise.all(
        targetUnits.map((nm_unidade) =>
            rpcCall('RPCGetUltimaConsulta', { dt_inicio, dt_termino, nm_unidade })
                .then((data) => (Array.isArray(data) ? data : data ? [data] : []))
                .catch((err) => {
                    console.error(`Error fetching ultima consulta for unit ${nm_unidade}:`, err.message);
                    return [];
                })
        )
    );
    return results.flat() as UltimaConsultaRecord[];
}
