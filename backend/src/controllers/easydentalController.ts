import { Request, Response } from 'express';

const API_URL = process.env.EASYDENTAL_API_URL || 'https://prsrb.onrender.com/v1/rpc';
const API_KEY = process.env.EASYDENTAL_API_KEY || '';
const CLIENT_ID = process.env.EASYDENTAL_CLIENT_ID || '';

async function rpcCall(method: string, params: Record<string, any> = {}) {
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

// RPCGetUnidadeAtendimento - retorna ID e Nome das unidades ativas
export const getUnidadesAtendimento = async (_req: Request, res: Response) => {
    try {
        const data = await rpcCall('RPCGetUnidadeAtendimento');
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching unidades:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// RPCGetAgendamentos - retorna agendamentos filtrados
// Aceita array de unidades para busca paralela
export const getAgendamentos = async (req: Request, res: Response) => {
    try {
        const { dt_inicio, dt_termino, unidades } = req.body;

        if (!dt_inicio || !dt_termino) {
            return res.status(400).json({ error: 'dt_inicio e dt_termino são obrigatórios' });
        }

        if (Array.isArray(unidades) && unidades.length > 0) {
            const promises = unidades.map((nm_unidade: string) =>
                rpcCall('RPCGetAgendamentos', { dt_inicio, dt_termino, nm_unidade })
                    .then(data => (Array.isArray(data) ? data : [data]))
                    .catch(err => {
                        console.error(`Error fetching for unit ${nm_unidade}:`, err.message);
                        return [];
                    })
            );
            const results = await Promise.all(promises);
            return res.json(results.flat());
        }

        const data = await rpcCall('RPCGetAgendamentos', { dt_inicio, dt_termino, nm_unidade: '' });
        res.json(Array.isArray(data) ? data : [data]);
    } catch (error: any) {
        console.error('Error fetching agendamentos:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// RPCGetKPIPrd - retorna dados de produção para o dashboard
export const getKPIPrd = async (req: Request, res: Response) => {
    try {
        const { dt_inicio, dt_termino, nm_unidade, nm_prestador } = req.body;
        const data = await rpcCall('RPCGetKPIPrd', {
            dt_inicio, dt_termino,
            nm_unidade: nm_unidade || '',
            nm_prestador: nm_prestador || '',
        });
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching KPI:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// RPCGetPrestadorCPF - retorna ID e Nome do prestador
export const getPrestadorCPF = async (req: Request, res: Response) => {
    try {
        const { cpf } = req.body;
        if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório' });

        const data = await rpcCall('RPCGetPrestadorCPF', { cpf });
        res.json(data);
    } catch (error: any) {
        console.error('Error fetching prestador:', error.message);
        res.status(500).json({ error: error.message });
    }
};
