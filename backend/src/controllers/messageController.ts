import { Request, Response } from 'express';

const BOTCONVERSA_URL = process.env.BOTCONVERSA_WEBHOOK_URL || '';
const DEFAULT_DELAY = parseInt(process.env.MESSAGE_DELAY_MS || '1000', 10);
const MAX_CONCURRENT = parseInt(process.env.MESSAGE_CONCURRENT_LIMIT || '5', 10);

// Enviar uma única mensagem para o BotConversa
export const sendMessage = async (req: Request, res: Response) => {
    try {
        const { nome, telefone, unidade } = req.body;

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
            }),
        });

        if (response.status === 200) {
            return res.json({ status: 'sent' });
        }

        const text = await response.text();
        return res.status(response.status).json({
            status: 'error',
            error: `BotConversa retornou ${response.status}: ${text}`,
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
