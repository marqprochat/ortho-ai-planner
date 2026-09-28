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

// Helper: Formata CPF no padrão 000.000.000-00 exigido pela EasyDental
export function formatCPF(cpf?: string | null): string {
    if (!cpf) return '';
    const digits = String(cpf).replace(/\D/g, '');
    if (digits.length !== 11) return cpf;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

// Helper: Remove formatação de números
export function cleanDigits(val?: string | null): string {
    if (!val) return '';
    return String(val).replace(/\D/g, '');
}

// RPCGetPrestadorCPF - Busca prestador pelo CPF
export async function findPrestadorByCPF(cpf: string): Promise<{ ID_PRESTADOR?: string | number; NOME?: string } | null> {
    const formatted = formatCPF(cpf);
    try {
        const data = await rpcCall('RPCGetPrestadorCPF', { cpf: formatted });
        if (Array.isArray(data) && data.length > 0) {
            return data[0];
        }
        const raw = cleanDigits(cpf);
        if (raw !== formatted) {
            const dataRaw = await rpcCall('RPCGetPrestadorCPF', { cpf: raw });
            if (Array.isArray(dataRaw) && dataRaw.length > 0) {
                return dataRaw[0];
            }
        }
    } catch (err: any) {
        console.error('Erro ao buscar prestador por CPF:', err.message);
    }
    return null;
}

// RPCGetPacienteCPF - Busca paciente pelo CPF
export async function findPacienteByCPF(cpf: string): Promise<{ ID_PACIENTE?: string | number; CODIGO_PACIENTE?: string } | null> {
    const formatted = formatCPF(cpf);
    const data = await rpcCall('RPCGetPacienteCPF', { cpf: formatted });
    if (Array.isArray(data) && data.length > 0) {
        return data[0];
    }
    const raw = cleanDigits(cpf);
    if (raw !== formatted) {
        const dataRaw = await rpcCall('RPCGetPacienteCPF', { cpf: raw });
        if (Array.isArray(dataRaw) && dataRaw.length > 0) {
            return dataRaw[0];
        }
    }
    return null;
}

// RPCGetPacienteCelular - Busca paciente pelo Celular (somente números com DDD)
export async function findPacienteByCelular(celular: string): Promise<{ ID_PACIENTE?: string | number; CODIGO_PACIENTE?: string } | null> {
    const digits = cleanDigits(celular);
    const data = await rpcCall('RPCGetPacienteCelular', { celular: digits });
    if (Array.isArray(data) && data.length > 0) {
        return data[0];
    }
    return null;
}

// RPCGetPacienteCOD - Busca dados detalhados do paciente pelo código
// Retorna Nome, Dt Nasc., CPF e Celular
export async function getPacienteByCod(codigo: string): Promise<{ NOME: string; DT_NASCIMENTO?: string; CELULAR?: string; CPF?: string } | null> {
    const code = String(codigo).trim();
    let data;
    try {
        // A procedure no banco espera 'cod'
        data = await rpcCall('RPCGetPacienteCOD', { cod: code, codigo: code });
    } catch (err: any) {
        data = await rpcCall('RPCGetPacienteCOD', { cod: code });
    }
    if (Array.isArray(data) && data.length > 0) {
        return data[0];
    }
    return null;
}

export interface CreateEasyDentalPatientInput {
    name: string;
    cpf: string;
    birthDate?: string;
    phone?: string;
    prestadorId?: string;
    rg?: string;
    obs?: string;
}

// RPCPutPaciente + RPCPutPacienteFone - Cadastra novo paciente no EasyDental
export async function createEasyDentalPatient(input: CreateEasyDentalPatientInput): Promise<{ id_paciente: string; codigo_paciente?: string }> {
    const defaultPrestador = process.env.EASYDENTAL_DEFAULT_PRESTADOR || '6274';
    const prestadorId = input.prestadorId || defaultPrestador;
    const formattedCpf = formatCPF(input.cpf);

    let dtNascimento = input.birthDate || '';
    if (dtNascimento.includes('T')) {
        dtNascimento = dtNascimento.split('T')[0];
    }

    const params: Record<string, any> = {
        id_codigo: '',
        id_prestador_res: String(prestadorId),
        id_situacao: '1',
        tx_cpf_res: '',
        tx_nome_res: '',
        id_tipo_indicacao: '0',
        tx_indicacao: '',
        tx_prontuario: '',
        tx_apelido: '',
        tx_nome: input.name.trim(),
        tx_cpf: formattedCpf,
        dt_nascimento: dtNascimento,
        id_sexo: '1',
        tx_nome_mae: '',
        tx_nome_pai: '',
        id_doc_tipo: '1',
        tx_doc_nro: input.rg || '',
        id_estado_civil: '1',
        tx_nome_conjuge: '',
        tx_observ: input.obs || 'Cadastrado via OrtoPlan Planner',
        tx_portal: '',
        fl_publico: '1',
    };

    const result = await rpcCall('RPCPutPaciente', params);

    let id_paciente = '';
    let codigo_paciente = '';

    if (Array.isArray(result) && result.length > 0) {
        id_paciente = String(result[0].ID_PACIENTE || result[0].id_paciente || '');
        codigo_paciente = String(result[0].CODIGO_PACIENTE || result[0].TX_CODIGO_PACIENTE || result[0].codigo || '');
    } else if (result && typeof result === 'object') {
        id_paciente = String(result.ID_PACIENTE || result.id_paciente || '');
        codigo_paciente = String(result.CODIGO_PACIENTE || result.TX_CODIGO_PACIENTE || result.codigo || '');
    }

    if (!id_paciente) {
        throw new Error(`EasyDental retornou resposta sem ID_PACIENTE: ${JSON.stringify(result)}`);
    }

    // Se possui telefone, cadastra via RPCPutPacienteFone
    if (input.phone) {
        const digits = cleanDigits(input.phone);
        if (digits.length >= 10) {
            const ddd = digits.slice(0, 2);
            const nro = digits.slice(2);
            try {
                await rpcCall('RPCPutPacienteFone', {
                    id_paciente: String(id_paciente),
                    id_tipo_fone: '8', // celular
                    tx_fone_ddd: ddd,
                    tx_fone_nro: nro,
                    tx_fone_ram: '',
                    tx_complemento: '',
                });
            } catch (foneErr: any) {
                console.error('Aviso ao cadastrar telefone no EasyDental:', foneErr.message);
            }
        }
    }

    // Se o código do paciente não veio de imediato, busca pelo CPF
    if (!codigo_paciente && formattedCpf) {
        try {
            const found = await findPacienteByCPF(formattedCpf);
            if (found && found.CODIGO_PACIENTE) {
                codigo_paciente = String(found.CODIGO_PACIENTE);
            }
        } catch (fetchErr: any) {
            console.error('Aviso ao buscar código gerado no EasyDental:', fetchErr.message);
        }
    }

    return { id_paciente, codigo_paciente };
}

