export interface Unidade {
    id?: string | number;
    ID_UNIDADE_ATENDIMENTO?: number;
    nm_unidade?: string;
    TX_UNIDADE_ATENDIMENTO?: string;
    nome?: string;
    [key: string]: any;
}

export interface Agendamento {
    cd_paciente?: string | number;
    nm_paciente?: string;
    nr_fone?: string;
    telefone?: string;
    nr_celular?: string;
    nm_unidade?: string;
    nm_prestador?: string;
    dt_agendamento?: string;
    hr_agendamento?: string;
    ds_status?: string;
    status_agendamento?: string;
    ds_intervencao?: string;
    dt_nascimento?: string;
    ds_motivo?: string;
    [key: string]: any;
}

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'error';

export interface MessageItem {
    id: string;
    nome: string;
    nomeCompleto: string;
    telefone: string;
    unidade: string;
    codPaciente: string;
    data: string;
    hora: string;
    status: MessageStatus;
    errorMessage?: string;
    sentAt?: string;
}

export interface Filters {
    dtInicio: string;
    dtTermino: string;
    unidades: string[];
    agendas: string[];
    statusAgendamento: string[];
    periodos: string[];
    motivo: string;
}

export interface SendConfig {
    delayMs: number;
    concurrentLimit: number;
}
