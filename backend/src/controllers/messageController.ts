import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const BOTCONVERSA_URL = process.env.BOTCONVERSA_WEBHOOK_URL || '';
const DEFAULT_DELAY = parseInt(process.env.MESSAGE_DELAY_MS || '1000', 10);
const MAX_CONCURRENT = parseInt(process.env.MESSAGE_CONCURRENT_LIMIT || '5', 10);

// Enviar uma única mensagem para o BotConversa
export const sendMessage = async (req: Request, res: Response) => {
    try {
        const { nome, telefone, unidade, modelo, data_agendamento, dentista, motivo, status, id_agenda_item, tx_codigo_paciente, paciente, celular, data, inicio } = req.body;

        if (!telefone) {
            return res.status(400).json({
                status: 'error',
                error: 'Telefone não informado',
            });
        }

        if (!BOTCONVERSA_URL) {
            return res.status(500).json({
                status: 'error',
                error: 'BOTCONVERSA_WEBHOOK_URL não configurada',
            });
        }

        const response = await fetch(BOTCONVERSA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome: nome || '',
                telefone,
                unidade: unidade || '',
                modelo: modelo || '',
                data_agendamento: data_agendamento || '',
                dentista: dentista || '',
                motivo: motivo || '',
                status: status || '',
                id_agenda_item: id_agenda_item || '',
                tx_codigo_paciente: tx_codigo_paciente || '',
                paciente: paciente || '',
                celular: celular || '',
                data: data || '',
                inicio: inicio || ''
            }),
        });

        let responseText = '';
        if (response.status !== 200) {
            responseText = await response.text().catch(() => '');
        }

        const success = response.status === 200;
        const statusText = success ? 'sent' : 'error';
        const errMsg = success ? null : `BotConversa retornou ${response.status}: ${responseText}`;

        try {
            await prisma.disparoIndividualLog.create({
                data: {
                    type: 'manual',
                    paciente: paciente || nome || '',
                    telefone: telefone,
                    unidade: unidade || 'Sem Unidade',
                    modelo: modelo || '',
                    status: statusText,
                    errorMessage: errMsg,
                }
            });
        } catch (dbErr: any) {
            console.error('Error logging manual message to database:', dbErr.message);
        }

        if (success) {
            return res.json({ status: 'sent' });
        }

        return res.status(response.status).json({
            status: 'error',
            error: errMsg,
        });
    } catch (error: any) {
        console.error('Error sending message:', error.message);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

// Retorna config de rate limiting
export const getMessageConfig = async (_req: Request, res: Response) => {
    res.json({
        delayMs: DEFAULT_DELAY,
        concurrentLimit: MAX_CONCURRENT,
    });
};
