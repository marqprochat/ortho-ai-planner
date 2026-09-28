import { Request, Response } from 'express';
import { rpcCall, formatCPF, cleanDigits, findPacienteByCPF, findPacienteByCelular, getPacienteByCod, findPrestadorByCPF } from '../lib/easydental';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

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

// POST /api/easydental/paciente/search
// Pesquisa paciente no EasyDental por CPF, Celular ou Código/Número do Cliente
export const searchPaciente = async (req: AuthRequest, res: Response) => {
    try {
        const { cpf, celular, codigo, numeroCliente, numeroPaciente, query } = req.body;
        const { tenantId, clinicId } = req;

        const effectiveCodigo = codigo || numeroCliente || numeroPaciente;

        if (!cpf && !celular && !effectiveCodigo && !query) {
            return res.status(400).json({ error: 'Informe o CPF, Celular ou Código/Número do Paciente para buscar no EasyDental' });
        }

        let match: { ID_PACIENTE?: string | number; CODIGO_PACIENTE?: string } | null = null;
        let details: { NOME: string; DT_NASCIMENTO?: string; CELULAR?: string; CPF?: string } | null = null;

        // 1. Busca direta por Código / Número do Paciente se informado
        if (effectiveCodigo) {
            details = await getPacienteByCod(String(effectiveCodigo));
            if (details) {
                if (details.CPF) {
                    const matchByCpf = await findPacienteByCPF(details.CPF);
                    if (matchByCpf) match = matchByCpf;
                }
                if (!match) {
                    match = { CODIGO_PACIENTE: String(effectiveCodigo) };
                }
            }
        }

        // 2. Busca por CPF se informado e ainda não encontrado
        if (!match && cpf) {
            match = await findPacienteByCPF(cpf);
        }

        // 3. Busca por celular se informado e ainda não encontrado
        if (!match && celular) {
            match = await findPacienteByCelular(celular);
        }

        // 4. Se foi passado query genérica e ainda não encontrou
        if (!match && query && typeof query === 'string' && query.trim() !== '') {
            const trimmedQuery = query.trim();
            const clean = cleanDigits(trimmedQuery);

            // Tenta como código primeiro se tiver até 8 dígitos ou caracteres não estritamente CPF/fone
            if (clean.length > 0 && clean.length <= 8) {
                details = await getPacienteByCod(trimmedQuery);
                if (details) {
                    if (details.CPF) {
                        const matchByCpf = await findPacienteByCPF(details.CPF);
                        if (matchByCpf) match = matchByCpf;
                    }
                    if (!match) {
                        match = { CODIGO_PACIENTE: trimmedQuery };
                    }
                }
            }

            // Tenta como CPF (11 dígitos)
            if (!match && clean.length === 11) {
                match = await findPacienteByCPF(clean);
            }

            // Tenta como Celular (10 ou 11 dígitos)
            if (!match && (clean.length === 10 || clean.length === 11)) {
                match = await findPacienteByCelular(clean);
            }

            // Tenta como código se nada anterior funcionou
            if (!match && !details) {
                details = await getPacienteByCod(trimmedQuery);
                if (details) {
                    if (details.CPF) {
                        const matchByCpf = await findPacienteByCPF(details.CPF);
                        if (matchByCpf) match = matchByCpf;
                    }
                    if (!match) {
                        match = { CODIGO_PACIENTE: trimmedQuery };
                    }
                }
            }
        }

        if (!match && !details) {
            return res.json({
                found: false,
                message: 'Paciente não localizado no sistema EasyDental'
            });
        }

        const codigoPaciente = match?.CODIGO_PACIENTE ? String(match.CODIGO_PACIENTE) : (effectiveCodigo ? String(effectiveCodigo) : '');
        const idPaciente = match?.ID_PACIENTE ? String(match.ID_PACIENTE) : '';

        // Se ainda não buscou os detalhes completos, busca pelo código
        if (!details && codigoPaciente) {
            details = await getPacienteByCod(codigoPaciente);
        }

        // Converte data DD/MM/YYYY do EasyDental para ISO YYYY-MM-DD
        let birthDateFormatted: string | null = null;
        if (details?.DT_NASCIMENTO) {
            const parts = details.DT_NASCIMENTO.split('/');
            if (parts.length === 3) {
                // DD, MM, YYYY -> YYYY-MM-DD
                birthDateFormatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else {
                birthDateFormatted = details.DT_NASCIMENTO;
            }
        }

        // Verifica se o paciente já está cadastrado no Planner na clínica/tenant atual
        let alreadyInPlanner = false;
        let plannerPatient: any = null;

        const orFilters: any[] = [];
        if (codigoPaciente) {
            orFilters.push({ patientNumber: codigoPaciente });
            orFilters.push({ externalId: codigoPaciente });
        }
        if (idPaciente) {
            orFilters.push({ easyDentalId: idPaciente });
        }
        const cleanCpf = cleanDigits(cpf || details?.CPF);
        const formattedCpf = formatCPF(cpf || details?.CPF);
        if (cleanCpf) {
            orFilters.push({ cpf: cleanCpf });
            orFilters.push({ cpf: formattedCpf });
        }

        if (orFilters.length > 0 && tenantId) {
            plannerPatient = await prisma.patient.findFirst({
                where: {
                    tenantId,
                    ...(clinicId ? { clinicId } : {}),
                    OR: orFilters
                }
            });
            if (plannerPatient) {
                alreadyInPlanner = true;
            }
        }

        return res.json({
            found: true,
            alreadyInPlanner,
            plannerPatient,
            easyDental: {
                id: idPaciente,
                codigo: codigoPaciente,
                nome: details?.NOME || '',
                cpf: details?.CPF || (cpf ? formatCPF(cpf) : ''),
                celular: details?.CELULAR || (celular ? cleanDigits(celular) : ''),
                dtNascimento: birthDateFormatted || ''
            }
        });
    } catch (error: any) {
        console.error('Erro ao pesquisar paciente no EasyDental:', error.message);
        return res.status(500).json({ error: error.message || 'Erro ao pesquisar paciente no EasyDental' });
    }
};

// POST /api/easydental/prestador/link
// Consulta prestador pelo CPF e vincula ao usuário logado
export const linkPrestadorCPF = async (req: AuthRequest, res: Response) => {
    try {
        const { cpf } = req.body;
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        if (!cpf) {
            return res.status(400).json({ error: 'CPF é obrigatório para localizar o prestador' });
        }

        const prestador = await findPrestadorByCPF(cpf);

        if (!prestador || !prestador.ID_PRESTADOR) {
            return res.status(404).json({
                error: 'Nenhum prestador foi encontrado no EasyDental com este CPF'
            });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                cpf: formatCPF(cpf),
                easyDentalPrestadorId: String(prestador.ID_PRESTADOR)
            },
            select: {
                id: true,
                name: true,
                email: true,
                cpf: true,
                cro: true,
                easyDentalPrestadorId: true
            }
        });

        return res.json({
            success: true,
            message: `Prestador ${prestador.NOME || ''} vinculado com sucesso!`,
            user: updatedUser,
            prestador
        });
    } catch (error: any) {
        console.error('Erro ao vincular prestador por CPF:', error.message);
        return res.status(500).json({ error: error.message || 'Erro ao vincular prestador' });
    }
};


