import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { CANAL_WAHA, getTemplateText, normalizeCanal, renderTemplate, sendText } from '../services/waha';

const BOTCONVERSA_URL = process.env.BOTCONVERSA_WEBHOOK_URL || '';
const DEFAULT_DELAY = parseInt(process.env.MESSAGE_DELAY_MS || '1000', 10);
const MAX_CONCURRENT = parseInt(process.env.MESSAGE_CONCURRENT_LIMIT || '5', 10);

// Enviar uma única mensagem pelo BotConversa (webhook) ou por uma sessão do Waha
export const sendMessage = async (req: Request, res: Response) => {
    try {
        const { canal: canalRaw, wahaSession, nome, telefone, unidade, modelo, data_agendamento, dentista, motivo, status, id_agenda_item, Id_agenda_item, tx_codigo_paciente, paciente, celular, data, inicio, ...rest } = req.body;

        if (!telefone) {
            return res.status(400).json({
                status: 'error',
                error: 'Telefone não informado',
            });
        }

        const canal = normalizeCanal(canalRaw);

        if (canal === CANAL_WAHA) {
            const vars = {
                ...rest,
                nome: nome || '', telefone, unidade: unidade || '', modelo: modelo || '',
                data_agendamento: data_agendamento || '', dentista: dentista || '', motivo: motivo || '',
                status: status || '', tx_codigo_paciente: tx_codigo_paciente || '', paciente: paciente || nome || '',
                celular: celular || '', data: data || '', inicio: inicio || '',
            };
            let errMsg: string | null = null;
            try {
                const text = renderTemplate(await getTemplateText(modelo || ''), vars);
                await sendText(String(wahaSession || ''), telefone, text);
            } catch (err: any) {
                errMsg = `Waha: ${err.message}`;
            }
            try {
                await prisma.disparoIndividualLog.create({
                    data: {
                        type: 'manual',
                        paciente: paciente || nome || '',
                        telefone,
                        unidade: unidade || 'Sem Unidade',
                        modelo: modelo || '',
                        canal,
                        wahaSession: wahaSession ? String(wahaSession) : null,
                        status: errMsg ? 'error' : 'sent',
                        errorMessage: errMsg,
                    },
                });
            } catch (dbErr: any) {
                console.error('Error logging manual Waha message to database:', dbErr.message);
            }
            if (errMsg) return res.status(502).json({ status: 'error', error: errMsg });
            return res.json({ status: 'sent' });
        }

        if (!BOTCONVERSA_URL) {
            return res.status(500).json({
                status: 'error',
                error: 'BOTCONVERSA_WEBHOOK_URL não configurada',
            });
        }

        const payload: Record<string, any> = {
            nome: nome || '',
            telefone,
            unidade: unidade || '',
            modelo: modelo || '',
            data_agendamento: data_agendamento || '',
            dentista: dentista || '',
            motivo: motivo || '',
            status: status || '',
            id_agenda_item: id_agenda_item || Id_agenda_item || '',
            tx_codigo_paciente: tx_codigo_paciente || '',
            paciente: paciente || '',
            celular: celular || '',
            data: data || '',
            inicio: inicio || '',
            ...rest
        };

        const response = await fetch(BOTCONVERSA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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
