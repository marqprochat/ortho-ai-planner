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

// RPCGetUltimaConsulta - retorna dados de última consulta e consulta agendada
// Aceita array de unidades para busca paralela. Se não informado, busca todas as unidades.
export const getUltimaConsulta = async (req: Request, res: Response) => {
    try {
        const { dt_inicio, dt_termino, unidades } = req.body;

        if (!dt_inicio || !dt_termino) {
            return res.status(400).json({ error: 'dt_inicio e dt_termino são obrigatórios' });
        }

        let targetUnits: string[] = [];

        if (Array.isArray(unidades) && unidades.length > 0) {
            targetUnits = unidades;
        } else if (typeof unidades === 'string' && unidades.trim() !== '') {
            targetUnits = [unidades];
        } else {
            // Fetch all active units
            try {
                const unitsData = await rpcCall('RPCGetUnidadeAtendimento');
                if (Array.isArray(unitsData)) {
                    targetUnits = unitsData
                        .map((u: any) => u.TX_UNIDADE_ATENDIMENTO)
                        .filter((name: any) => typeof name === 'string' && name.trim() !== '');
                }
            } catch (err: any) {
                console.error('Error fetching units for fallback:', err.message);
                return res.status(500).json({ error: 'Falha ao recuperar unidades para consulta: ' + err.message });
            }
        }

        if (targetUnits.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const promises = targetUnits.map((nm_unidade: string) =>
            rpcCall('RPCGetUltimaConsulta', { dt_inicio, dt_termino, nm_unidade })
                .then(data => (Array.isArray(data) ? data : (data ? [data] : [])))
                .catch(err => {
                    console.error(`Error fetching ultima consulta for unit ${nm_unidade}:`, err.message);
                    return [];
                })
        );
        const results = await Promise.all(promises);
        res.json({ success: true, data: results.flat() });
    } catch (error: any) {
        console.error('Error fetching ultima consulta:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// RPCGetAniversarios - retorna aniversariantes do período
export const getAniversarios = async (req: Request, res: Response) => {
    try {
        const { dt_inicio, dt_termino, unidades } = req.body;

        if (!dt_inicio || !dt_termino) {
            return res.status(400).json({ error: 'dt_inicio e dt_termino são obrigatórios' });
        }

        // Format dates from YYYY-MM-DD to MM-DD if they are in YYYY-MM-DD format
        const formatToMMDD = (dateStr: string) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr.substring(5); // "YYYY-MM-DD" -> "MM-DD"
            }
            return dateStr;
        };

        const dtInicioFormatted = formatToMMDD(dt_inicio);
        const dtTerminoFormatted = formatToMMDD(dt_termino);

        let targetUnits: string[] = [];

        if (Array.isArray(unidades) && unidades.length > 0) {
            targetUnits = unidades;
        } else if (typeof unidades === 'string' && unidades.trim() !== '') {
            targetUnits = [unidades];
        } else {
            // Fetch all active units
            try {
                const unitsData = await rpcCall('RPCGetUnidadeAtendimento');
                if (Array.isArray(unitsData)) {
                    targetUnits = unitsData
                        .map((u: any) => u.TX_UNIDADE_ATENDIMENTO)
                        .filter((name: any) => typeof name === 'string' && name.trim() !== '');
                }
            } catch (err: any) {
                console.error('Error fetching units for fallback:', err.message);
                return res.status(500).json({ error: 'Falha ao recuperar unidades para consulta: ' + err.message });
            }
        }

        if (targetUnits.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const promises = targetUnits.map((nm_unidade: string) =>
            rpcCall('RPCGetAniversarios', { dt_inicio: dtInicioFormatted, dt_termino: dtTerminoFormatted, nm_unidade })
                .then(data => (Array.isArray(data) ? data : (data ? [data] : [])))
                .catch(err => {
                    console.error(`Error fetching aniversarios for unit ${nm_unidade}:`, err.message);
                    return [];
                })
        );
        const results = await Promise.all(promises);
        res.json({ success: true, data: results.flat() });
    } catch (error: any) {
        console.error('Error fetching aniversarios:', error.message);
        res.status(500).json({ error: error.message });
    }
};


